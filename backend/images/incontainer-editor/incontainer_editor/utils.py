"""Event emitter, process tree inspection, and /proc listening-port helpers."""

from __future__ import annotations

import asyncio
import os
import re
from typing import Any, Callable, Generic, Optional, TypeVar

T = TypeVar("T")

SOCKET_TARGET_RE = re.compile(r"socket:\[(\d+)\]")
SS_LISTEN_RE = re.compile(r"LISTEN\s+\d+\s+\d+\s+\S+:(\d+)\s+.*pid=(\d+)")


class Disposable:
    """Handle for unregistering an event listener."""

    def __init__(self, dispose_fn: Callable[[], None]) -> None:
        self._dispose_fn = dispose_fn
        self._disposed = False

    def dispose(self) -> None:
        """Unregister the associated listener (idempotent)."""
        if not self._disposed:
            self._disposed = True
            self._dispose_fn()


class EventEmitter(Generic[T]):
    """Lightweight typed event emitter with Disposable subscriptions."""

    def __init__(self) -> None:
        self._listeners: list[Callable[[T], Any]] = []

    def event(self, listener: Callable[[T], Any]) -> Disposable:
        """Subscribe a listener callback and return a Disposable handle."""
        self._listeners.append(listener)

        def _remove() -> None:
            for idx, existing in enumerate(self._listeners):
                if existing is listener:
                    self._listeners.pop(idx)
                    return

        return Disposable(_remove)

    def fire(self, data: T) -> None:
        """Dispatch an event payload to a snapshot of registered listeners."""
        for listener in list(self._listeners):
            listener(data)


def _load_connection_table(stdout: str) -> list[dict[str, str]]:
    """Parse /proc/<pid>/net/tcp content into row dictionaries."""
    lines = stdout.strip().splitlines()
    if not lines:
        return []
    # In /proc/net/tcp, tx_queue:rx_queue and tr:tm->when share colon-joined columns in data rows.
    headers = [
        name
        for name in lines[0].strip().split()
        if name not in ("rx_queue", "tm->when")
    ]
    rows: list[dict[str, str]] = []
    for line in lines[1:]:
        values = line.strip().split()
        if not values:
            continue
        row: dict[str, str] = {}
        for idx, value in enumerate(values):
            key = headers[idx] if idx < len(headers) else str(idx)
            row[key] = value
        rows.append(row)
    return rows


def _parse_ip_address(hex_str: str) -> str:
    """Convert little-endian hex IP address from /proc/net/tcp to string."""
    if len(hex_str) == 8:
        return ".".join(
            str(int(hex_str[i : i + 2], 16))
            for i in range(len(hex_str) - 2, -1, -2)
        )
    return ":".join(
        format(int(hex_str[i : i + 4], 16), "x")
        for i in range(len(hex_str) - 4, -1, -4)
    )


def _load_listening_ports(*tables: str) -> list[dict[str, Any]]:
    """Extract unique TCP_LISTEN (st == '0A') entries from /proc/net/tcp dumps."""
    entries: dict[str, dict[str, Any]] = {}
    for content in tables:
        for row in _load_connection_table(content):
            if row.get("st") != "0A":
                continue
            local_addr = row.get("local_address", "")
            inode_str = row.get("inode", "")
            if ":" not in local_addr or not inode_str:
                continue
            hex_ip, hex_port = local_addr.split(":", 1)
            ip = _parse_ip_address(hex_ip)
            port = int(hex_port, 16)
            entries[f"{ip}:{port}"] = {
                "socket": int(inode_str, 10),
                "ip": ip,
                "port": port,
            }
    return list(entries.values())


def _get_socket_inodes_for_pid(pid: int) -> set[int]:
    """Read /proc/<pid>/fd symlink targets and collect socket inode numbers."""
    fd_dir = f"/proc/{pid}/fd"
    inodes: set[int] = set()
    try:
        fds = os.listdir(fd_dir)
    except OSError:
        return inodes
    for fd_name in fds:
        try:
            target = os.readlink(os.path.join(fd_dir, fd_name))
        except OSError:
            continue
        match = SOCKET_TARGET_RE.search(target)
        if match:
            inodes.add(int(match.group(1), 10))
    return inodes


def _parse_columns(
    stdout: str, coercion: Optional[dict[str, Callable[[str], Any]]] = None
) -> list[dict[str, Any]]:
    """Parse tabular CLI output such as `ps --ppid=<pid>` into dicts."""
    lines = [line for line in stdout.strip().splitlines() if line.strip()]
    if len(lines) < 2:
        return []
    headers = lines[0].strip().split()
    coercers = coercion or {}
    results: list[dict[str, Any]] = []
    for line in lines[1:]:
        cols = line.strip().split(None, len(headers) - 1)
        if len(cols) < len(headers):
            continue
        row: dict[str, Any] = {}
        for idx, header in enumerate(headers):
            val = cols[idx]
            if header in coercers:
                row[header] = coercers[header](val)
            else:
                row[header] = val
        results.append(row)
    return results


async def get_child_processes(pid: int) -> list[dict[str, Any]]:
    """Return immediate child processes of `pid` using `ps --ppid=<pid>`."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ps",
            f"--ppid={pid}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout_bytes, _ = await proc.communicate()
    except OSError:
        return []
    stdout = stdout_bytes.decode("utf-8", errors="replace")
    try:
        return _parse_columns(stdout, {"PID": int})
    except ValueError:
        return []


async def get_all_descendants(pid: int) -> list[dict[str, Any]]:
    """Recursively collect all descendant processes of `pid`."""
    descendants: list[dict[str, Any]] = []
    visited: set[int] = {pid}

    async def walk(current_pid: int) -> None:
        children = await get_child_processes(current_pid)
        for child in children:
            child_pid = child.get("PID")
            if not isinstance(child_pid, int) or child_pid in visited:
                continue
            visited.add(child_pid)
            descendants.append(child)
            await walk(child_pid)

    await walk(pid)
    return descendants


async def get_listening_ports_via_ss(pid: int) -> list[int]:
    """Query `ss -plnt` for TCP ports opened by `pid` or any of its descendants."""
    descendants = await get_all_descendants(pid)
    descendant_pids = {pid, *(d["PID"] for d in descendants if "PID" in d)}
    try:
        proc = await asyncio.create_subprocess_exec(
            "ss",
            "-plnt",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout_bytes, _ = await proc.communicate()
    except OSError:
        return []
    ports: list[int] = []
    lines = stdout_bytes.decode("utf-8", errors="replace").splitlines()[1:]
    for line in lines:
        match = SS_LISTEN_RE.search(line)
        if not match:
            continue
        port = int(match.group(1), 10)
        owner_pid = int(match.group(2), 10)
        if owner_pid in descendant_pids:
            ports.append(port)
    return ports


async def get_ports_for_pid(pid: int, check_descendants: bool = False) -> list[int]:
    """Return TCP listening ports owned by `pid` (and optionally its descendants)."""
    proc_tcp_path = f"/proc/{pid}/net/tcp"
    try:
        with open(proc_tcp_path, "r", encoding="utf-8") as f:
            data = f.read()
    except OSError:
        return []
    if not data:
        return []

    listening = _load_listening_ports(data)
    sockets = _get_socket_inodes_for_pid(pid)
    ports = [entry["port"] for entry in listening if entry["socket"] in sockets]

    if not ports and check_descendants:
        descendants = await get_all_descendants(pid)
        if not descendants:
            return []
        descendant_port_lists = await asyncio.gather(
            *(get_listening_ports_via_ss(d["PID"]) for d in descendants)
        )
        merged: list[int] = []
        for plist in descendant_port_lists:
            merged.extend(plist)
        return list(dict.fromkeys(merged))

    return ports
