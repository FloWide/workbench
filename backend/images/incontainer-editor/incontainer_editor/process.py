"""PTY-backed process wrapper matching node-pty lifecycle and notifications."""

from __future__ import annotations

import asyncio
import codecs
import fcntl
import os
import pty
import shutil
import signal
import struct
import subprocess
import termios
from typing import Any, Callable, Optional

from .utils import Disposable, EventEmitter, get_child_processes, get_ports_for_pid


def _read_proc_name(pid: int, fallback: str) -> str:
    """Read process short name from /proc/<pid>/comm, falling back to basename."""
    try:
        with open(f"/proc/{pid}/comm", "r", encoding="utf-8", errors="replace") as f:
            name = f.read().strip()
            if name:
                return name
    except OSError:
        pass
    return os.path.basename(fallback) or fallback


def _resolve_signal(sig_name: Optional[str]) -> int:
    """Resolve a signal name (e.g. 'SIGTERM') or numeric string to a signal int."""
    if not sig_name:
        return int(signal.SIGTERM)
    if sig_name.isdigit():
        return int(sig_name)
    sig_obj = getattr(signal, sig_name, None)
    if isinstance(sig_obj, signal.Signals):
        return int(sig_obj)
    return int(signal.SIGTERM)


class Process:
    """Manages a PTY-attached child process, port discovery, and event streams."""

    def __init__(
        self,
        proc: subprocess.Popen[bytes],
        master_fd: int,
        cmd: str,
        args: list[str],
    ) -> None:
        self._loop = asyncio.get_running_loop()
        self._proc = proc
        self._master_fd: Optional[int] = master_fd
        self.pid: int = proc.pid
        self.cmd: str = cmd
        self.args: list[str] = args
        self.name: str = _read_proc_name(self.pid, cmd)
        self.ports: list[int] = []
        self.children: dict[int, dict[str, Any]] = {}

        self._notify: EventEmitter[dict[str, Any]] = EventEmitter()
        self._data_emitter: EventEmitter[str] = EventEmitter()
        self._exit_emitter: EventEmitter[dict[str, Any]] = EventEmitter()
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

        self._paused = False
        self._pty_eof = False
        self._exit_result: Optional[dict[str, Any]] = None
        self._exited = False

        # Register before returning so PROCESS_EXITED fires ahead of server cleanup.
        self.on_exit(self._emit_exit_notifications)
        self._loop.add_reader(self._master_fd, self._on_master_readable)

        self._notify.fire(
            {
                "pid": self.pid,
                "type": "PROCESS_STARTED",
                "data": self.to_dict(),
            }
        )
        print("New process", self.to_dict(), flush=True)

        self._ports_watcher: asyncio.Task[None] = self._loop.create_task(
            self._refresh_loop()
        )
        self._wait_task: asyncio.Task[None] = self._loop.create_task(
            self._wait_for_process()
        )

    @property
    def exited(self) -> bool:
        """Whether final exit cleanup and notifications have already run."""
        return self._exited

    @property
    def exit_result(self) -> Optional[dict[str, Any]]:
        """Exit code/signal dict if the child has exited, else None."""
        return self._exit_result

    @classmethod
    def spawn(cls, data: dict[str, Any]) -> Process:
        """Spawn a command in a new PTY session from HTTP POST / JSON payload."""
        cmd = str(data.get("cmd") or "run")
        raw_args = data.get("args")
        args = [str(a) for a in raw_args] if isinstance(raw_args, list) else []
        term = str(data.get("term") or data.get("name") or "xterm-color")
        cols = int(data.get("cols") or 80)
        rows = int(data.get("rows") or 30)
        cwd = str(data.get("cwd") or os.getcwd())

        env = dict(os.environ)
        raw_env = data.get("env")
        if isinstance(raw_env, dict):
            for key, val in raw_env.items():
                if val is not None:
                    env[str(key)] = str(val)
        env["TERM"] = term

        master_fd, slave_fd = pty.openpty()
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
        os.set_blocking(master_fd, False)

        executable = shutil.which(cmd, path=env.get("PATH")) or cmd

        def _setup_ctty() -> None:
            try:
                fcntl.ioctl(0, termios.TIOCSCTTY, 0)
            except OSError:
                pass

        try:
            proc = subprocess.Popen(
                [executable, *args],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=cwd,
                env=env,
                start_new_session=True,
                preexec_fn=_setup_ctty,
                close_fds=True,
            )
        except Exception:
            os.close(slave_fd)
            os.close(master_fd)
            raise

        os.close(slave_fd)
        return cls(proc, master_fd, cmd, args)

    def _close_master_fd(self) -> None:
        fd = self._master_fd
        if fd is None:
            return
        self._master_fd = None
        self._pty_eof = True
        try:
            self._loop.remove_reader(fd)
        except Exception:
            pass
        try:
            os.close(fd)
        except OSError:
            pass
        tail = self._decoder.decode(b"", final=True)
        if tail:
            self._data_emitter.fire(tail)

    def _read_master(self, drain_all: bool = False) -> None:
        if self._master_fd is None or self._paused:
            return
        total_read = 0
        while self._master_fd is not None and (drain_all or total_read < 65536):
            try:
                chunk = os.read(self._master_fd, 4096)
            except BlockingIOError:
                break
            except OSError:
                self._close_master_fd()
                break
            if not chunk:
                self._close_master_fd()
                break
            total_read += len(chunk)
            text = self._decoder.decode(chunk, final=False)
            if text:
                self._data_emitter.fire(text)

    def _on_master_readable(self) -> None:
        if self._paused:
            return
        if self._exit_result is not None:
            self._read_master(drain_all=True)
            self._finalize_exit()
            return
        self._read_master(drain_all=False)
        if self._pty_eof and self._exit_result is not None:
            self._finalize_exit()

    def _on_resume_tick(self) -> None:
        if self._paused:
            return
        if self._exit_result is not None:
            self._read_master(drain_all=True)
            self._finalize_exit()
        else:
            self._read_master(drain_all=False)

    async def _wait_for_process(self) -> None:
        try:
            rc = await asyncio.to_thread(self._proc.wait)
        except asyncio.CancelledError:
            return
        if rc >= 0:
            self._exit_result = {"exitCode": rc, "signal": 0}
        else:
            self._exit_result = {"exitCode": 0, "signal": -rc}

        # Defer final exit emission while paused so fast commands buffer output until /attach.
        if not self._paused:
            self._read_master(drain_all=True)
            self._finalize_exit()

    def _emit_exit_notifications(self, result: dict[str, Any]) -> None:
        for cproc in list(self.children.values()):
            try:
                os.kill(cproc["pid"], signal.SIGTERM)
            except OSError:
                pass
            self._notify.fire(
                {
                    "type": "CHILD_PROCESS_EXITED",
                    "pid": self.pid,
                    "data": cproc,
                }
            )
        self._notify.fire(
            {
                "pid": self.pid,
                "type": "PROCESS_EXITED",
                "data": result,
            }
        )

    def _finalize_exit(self) -> None:
        if self._exited or self._exit_result is None:
            return
        self._exited = True
        self._ports_watcher.cancel()
        self._close_master_fd()
        self._exit_emitter.fire(self._exit_result)

    async def _refresh_loop(self) -> None:
        try:
            while not self._exited:
                await asyncio.sleep(2.0)
                if self._exited:
                    break
                await self._refresh()
        except asyncio.CancelledError:
            return

    async def _refresh(self) -> None:
        self.ports = await self._check_for_ports(self.pid, self.ports)
        procs = await get_child_processes(self.pid)
        child_pids: set[int] = set()
        for proc in procs:
            cpid = proc.get("PID")
            if not isinstance(cpid, int):
                continue
            child_pids.add(cpid)
            if cpid not in self.children:
                self.children[cpid] = {
                    "pid": cpid,
                    "ppid": self.pid,
                    "name": proc.get("CMD", ""),
                    "ports": [],
                }
                print("New child process:", self.children[cpid], flush=True)
                self._notify.fire(
                    {
                        "type": "CHILD_PROCESS_STARTED",
                        "pid": self.pid,
                        "data": self.children[cpid],
                    }
                )

        for cproc in list(self.children.values()):
            cpid = cproc["pid"]
            if cpid not in child_pids:
                del self.children[cpid]
                print("Child process exited:", cproc, flush=True)
                self._notify.fire(
                    {
                        "type": "CHILD_PROCESS_EXITED",
                        "pid": self.pid,
                        "data": cproc,
                    }
                )
            else:
                cproc["ports"] = await self._check_for_ports(
                    cpid, cproc.get("ports") or [], True, self.pid
                )

    async def _check_for_ports(
        self,
        pid: int,
        old_ports: list[int],
        check_descendants: bool = False,
        ppid: Optional[int] = None,
    ) -> list[int]:
        ports = await get_ports_for_pid(pid, check_descendants)
        if ports != old_ports:
            print("Ports", ports, "opened on process", pid, flush=True)
            event: dict[str, Any] = {
                "type": "PORTS_CHANGED",
                "pid": pid,
                "data": ports,
            }
            if ppid is not None:
                event["ppid"] = ppid
            self._notify.fire(event)
        return ports

    def pause(self) -> None:
        """Pause reading output from the PTY master fd."""
        if self._paused:
            return
        self._paused = True
        if self._master_fd is not None:
            try:
                self._loop.remove_reader(self._master_fd)
            except Exception:
                pass

    def resume(self) -> None:
        """Resume reading from the PTY master fd and flush buffered output/exit."""
        if not self._paused:
            return
        self._paused = False
        if self._master_fd is not None and not self._pty_eof:
            self._loop.add_reader(self._master_fd, self._on_master_readable)
        self._loop.call_soon(self._on_resume_tick)

    def resize(self, cols: int, rows: int) -> None:
        """Update PTY terminal window size."""
        if self._master_fd is None:
            return
        winsize = struct.pack("HHHH", int(rows), int(cols), 0, 0)
        try:
            fcntl.ioctl(self._master_fd, termios.TIOCSWINSZ, winsize)
        except OSError:
            pass

    def kill(self, sig_name: Optional[str] = None) -> None:
        """Send signal to the managed process (default SIGTERM)."""
        self.resume()
        sig_num = _resolve_signal(sig_name)
        try:
            os.kill(self.pid, sig_num)
        except OSError:
            pass

    def clear(self) -> None:
        """No-op clear method matching node-pty on POSIX."""

    async def wait(self, timeout: Optional[float] = None) -> dict[str, Any]:
        """Wait for the process to exit, or return {'detail': 'Timeout'} on timeout (ms)."""
        self.resume()
        if self._exited and self._exit_result is not None:
            return self._exit_result

        fut: asyncio.Future[dict[str, Any]] = self._loop.create_future()

        def _resolve(result: dict[str, Any]) -> None:
            if not fut.done():
                fut.set_result(result)

        listener = self.on_exit(_resolve)
        try:
            if timeout is not None:
                return await asyncio.wait_for(fut, timeout=timeout / 1000.0)
            return await fut
        except asyncio.TimeoutError:
            return {"detail": "Timeout"}
        finally:
            listener.dispose()

    def write(self, data: str) -> None:
        """Write UTF-8 input to the PTY master fd."""
        if self._master_fd is None:
            return
        payload = data.encode("utf-8", errors="replace")
        offset = 0
        while offset < len(payload):
            try:
                written = os.write(self._master_fd, payload[offset:])
            except BlockingIOError:
                break
            except OSError:
                break
            if written <= 0:
                break
            offset += written

    def on_data(self, listener: Callable[[str], Any]) -> Disposable:
        """Subscribe to decoded PTY output strings."""
        return self._data_emitter.event(listener)

    def on_exit(self, listener: Callable[[dict[str, Any]], Any]) -> Disposable:
        """Subscribe to process exit events ({exitCode, signal})."""
        return self._exit_emitter.event(listener)

    def on_notify(self, listener: Callable[[dict[str, Any]], Any]) -> Disposable:
        """Subscribe to process lifecycle and port-change notifications."""
        return self._notify.event(listener)

    def dispose(self) -> None:
        """Stop background watchers, terminate running child, and close PTY."""
        self._ports_watcher.cancel()
        if self._proc.poll() is None:
            try:
                os.kill(self.pid, signal.SIGTERM)
            except OSError:
                pass
        else:
            self._wait_task.cancel()
        self._close_master_fd()

    def to_dict(self) -> dict[str, Any]:
        """Serialize process state to the JSON shape expected by workbench_backend."""
        return {
            "pid": self.pid,
            "name": self.name,
            "ports": self.ports,
            "cmd": self.cmd,
            "args": self.args,
            "children": {str(k): v for k, v in self.children.items()},
        }
