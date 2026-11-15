"""HTTP and WebSocket server exposing the in-container process & LSP API."""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import signal
import subprocess
from typing import Any, Optional

from aiohttp import WSMsgType, web

from .process import Process
from .utils import Disposable

PORT = 3000

_APP_PROCESSES = web.AppKey("processes", dict[int, Process])
_APP_NOTIF_QUEUES = web.AppKey("notification_queues", set[asyncio.Queue[Optional[str]]])
_APP_LSP_PROC = web.AppKey("lsp_process", Optional[subprocess.Popen[bytes]])


def _broadcast_notification(app: web.Application, event: dict[str, Any]) -> None:
    """Queue a JSON notification payload for all connected /notifications clients."""
    payload = json.dumps(event)
    for queue in list(app[_APP_NOTIF_QUEUES]):
        queue.put_nowait(payload)


def _kill_lsp(app: web.Application) -> None:
    """Terminate the running lsp-ws-proxy process group if active."""
    lsp_proc = app.get(_APP_LSP_PROC)
    if lsp_proc is not None and lsp_proc.poll() is None:
        try:
            os.killpg(lsp_proc.pid, signal.SIGKILL)
        except OSError:
            try:
                lsp_proc.kill()
            except OSError:
                pass
    app[_APP_LSP_PROC] = None


def _get_process_or_404(request: web.Request) -> tuple[Optional[Process], Optional[web.Response]]:
    raw_id = request.match_info.get("id", "")
    try:
        pid = int(raw_id)
    except ValueError:
        pid = -1
    proc = request.app[_APP_PROCESSES].get(pid)
    if proc is None:
        return None, web.json_response({"error": f"Not found {raw_id}"}, status=404)
    return proc, None


async def handle_list_processes(request: web.Request) -> web.Response:
    """GET / - return map of active managed processes."""
    procs = request.app[_APP_PROCESSES]
    return web.json_response({str(pid): proc.to_dict() for pid, proc in procs.items()})


async def handle_notifications_ws(request: web.Request) -> web.WebSocketResponse:
    """GET /notifications - WebSocket stream for process/port/open notifications."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    queues = request.app[_APP_NOTIF_QUEUES]
    queues.add(queue)

    async def _sender() -> None:
        try:
            while True:
                msg = await queue.get()
                if msg is None or ws.closed:
                    break
                await ws.send_str(msg)
        except (asyncio.CancelledError, ConnectionResetError):
            pass

    sender_task = asyncio.create_task(_sender())
    try:
        async for _ in ws:
            pass
    finally:
        queues.discard(queue)
        queue.put_nowait(None)
        sender_task.cancel()
        try:
            await sender_task
        except asyncio.CancelledError:
            pass
    return ws


async def handle_start_lsp(request: web.Request) -> web.Response:
    """POST /startLsp - launch lsp-ws-proxy on port 63070 for configured languages."""
    lsp_args = await request.json()
    _kill_lsp(request.app)

    command_args: list[str] = []
    for name, cmd in lsp_args.items():
        command_args.extend(["--", f"{name}=run {cmd}"])

    cmd_str = " ".join(["lsp-ws-proxy", "--listen", "63070", *command_args])
    request.app[_APP_LSP_PROC] = subprocess.Popen(
        cmd_str,
        shell=True,
        start_new_session=True,
    )
    return web.json_response({"port": 63070, "lsps": list(lsp_args.keys())}, status=200)


async def handle_open_request(request: web.Request) -> web.Response:
    """POST /openRequest - broadcast an OPEN_FILE_REQUEST notification."""
    body = await request.json()
    print("Open request", body, flush=True)
    full_path = str(body["fullPath"])
    rel_src = str(body["path"])
    mime_type, _ = mimetypes.guess_type(full_path)

    data = {
        "type": "OPEN_FILE_REQUEST",
        "pid": None,
        "data": {
            "name": os.path.basename(rel_src),
            "path": os.path.relpath(full_path, os.getcwd()),
            "isDirectory": False,
            "absolutePath": full_path,
            "mimeType": mime_type or False,
        },
    }
    _broadcast_notification(request.app, data)
    return web.Response(status=200)


async def handle_spawn_process(request: web.Request) -> web.Response:
    """POST / - spawn a paused PTY process and return its serialized metadata."""
    try:
        body = await request.json()
    except Exception:
        body = None
    if body is None or not isinstance(body, dict):
        return web.json_response({"detail": "Invalid request"}, status=400)

    print(body, flush=True)
    app = request.app
    new_proc = Process.spawn(body)
    new_proc.pause()

    notify_listener = new_proc.on_notify(
        lambda event: _broadcast_notification(app, event)
    )
    exit_listener: Optional[Disposable] = None

    def _on_exit(_: dict[str, Any]) -> None:
        new_proc.dispose()
        if exit_listener is not None:
            exit_listener.dispose()
        notify_listener.dispose()
        app[_APP_PROCESSES].pop(new_proc.pid, None)

    exit_listener = new_proc.on_exit(_on_exit)
    app[_APP_PROCESSES][new_proc.pid] = new_proc
    return web.json_response(new_proc.to_dict(), status=201)


async def handle_resize(request: web.Request) -> web.Response:
    """POST /{id}/resize - resize the PTY terminal window."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]
    body = await request.json()
    proc.resize(int(body["cols"]), int(body["rows"]))
    return web.Response(status=200)


async def handle_kill(request: web.Request) -> web.Response:
    """POST /{id}/kill - signal the process and await its exit status."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]

    sig = request.query.get("signal") or "SIGTERM"
    if proc.exited and proc.exit_result is not None:
        return web.json_response(proc.exit_result, status=200)

    loop = asyncio.get_running_loop()
    exit_fut: asyncio.Future[dict[str, Any]] = loop.create_future()

    def _on_exit(data: dict[str, Any]) -> None:
        if not exit_fut.done():
            exit_fut.set_result(data)

    listener = proc.on_exit(_on_exit)
    try:
        proc.kill(sig)
        result = await exit_fut
    finally:
        listener.dispose()
    return web.json_response(result, status=200)


async def handle_pause(request: web.Request) -> web.Response:
    """POST /{id}/pause - pause reading PTY output."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]
    proc.pause()
    return web.Response(status=200)


async def handle_resume(request: web.Request) -> web.Response:
    """POST /{id}/resume - resume reading PTY output."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]
    proc.resume()
    return web.Response(status=200)


async def handle_clear(request: web.Request) -> web.Response:
    """POST /{id}/clear - clear PTY terminal buffer."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]
    proc.clear()
    return web.Response(status=200)


async def handle_wait(request: web.Request) -> web.Response:
    """GET /{id}/wait - wait for process exit with optional millisecond timeout."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        return err  # type: ignore[return-value]

    raw_timeout = request.query.get("timeout")
    timeout: Optional[float] = None
    if raw_timeout not in (None, "", "None", "null"):
        try:
            timeout = float(raw_timeout)
        except ValueError:
            timeout = None

    result = await proc.wait(timeout)
    return web.json_response(result, status=200)


async def handle_attach_ws(request: web.Request) -> web.WebSocketResponse:
    """GET /{id}/attach - WebSocket terminal stream attached to process PTY."""
    proc, err = _get_process_or_404(request)
    if err is not None or proc is None:
        raise web.HTTPNotFound(
            text=json.dumps({"error": f"Not found {request.match_info.get('id', '')}"}),
            content_type="application/json",
        )

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    send_queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    data_listener = proc.on_data(send_queue.put_nowait)
    exit_listener = proc.on_exit(lambda _: send_queue.put_nowait(None))
    proc.resume()
    if proc.exited:
        send_queue.put_nowait(None)

    async def _sender() -> None:
        try:
            while True:
                chunk = await send_queue.get()
                if chunk is None:
                    if not ws.closed:
                        await ws.close()
                    break
                if not ws.closed:
                    await ws.send_str(chunk)
        except (asyncio.CancelledError, ConnectionResetError):
            pass

    sender_task = asyncio.create_task(_sender())
    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                proc.write(msg.data)
            elif msg.type == WSMsgType.BINARY:
                proc.write(msg.data.decode("utf-8", errors="replace"))
    finally:
        data_listener.dispose()
        exit_listener.dispose()
        send_queue.put_nowait(None)
        sender_task.cancel()
        try:
            await sender_task
        except asyncio.CancelledError:
            pass
    return ws


async def _on_shutdown(app: web.Application) -> None:
    _kill_lsp(app)
    for proc in list(app[_APP_PROCESSES].values()):
        proc.dispose()
    app[_APP_PROCESSES].clear()
    for queue in list(app[_APP_NOTIF_QUEUES]):
        queue.put_nowait(None)


def create_app() -> web.Application:
    """Create and configure the aiohttp web Application."""
    app = web.Application()
    app[_APP_PROCESSES] = {}
    app[_APP_NOTIF_QUEUES] = set()
    app[_APP_LSP_PROC] = None

    app.router.add_get("/", handle_list_processes)
    app.router.add_get("/notifications", handle_notifications_ws)
    app.router.add_post("/startLsp", handle_start_lsp)
    app.router.add_post("/openRequest", handle_open_request)
    app.router.add_post("/", handle_spawn_process)
    app.router.add_post("/{id}/resize", handle_resize)
    app.router.add_post("/{id}/kill", handle_kill)
    app.router.add_post("/{id}/pause", handle_pause)
    app.router.add_post("/{id}/resume", handle_resume)
    app.router.add_post("/{id}/clear", handle_clear)
    app.router.add_get("/{id}/wait", handle_wait)
    app.router.add_get("/{id}/attach", handle_attach_ws)

    app.on_shutdown.append(_on_shutdown)
    return app


def main() -> None:
    """CLI entrypoint for `workbench-service`."""
    os.environ["PWD"] = os.getcwd()
    print(f"Workdir: {os.getcwd()}", flush=True)
    print(f"Server running at http://localhost:{PORT}", flush=True)
    app = create_app()
    web.run_app(app, host="0.0.0.0", port=PORT, handle_signals=True, print=None)


if __name__ == "__main__":
    main()
