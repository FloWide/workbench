import asyncio
from typing import Any, Optional

import aiodocker
from aiohttp import ClientWebSocketResponse, WSMsgType

from ....app.config import config as app_config
from ....db.models.app import App
from ....db.models.user import User
from ....docker.utils import (
    connect_container_to_networks,
    setup_container_routing,
    setup_environ,
    setup_labels,
    setup_volumes,
)
from ....jsonrpc import jsonrpc
from ....utils.proxy import hash_path, proxy_url, wait_service_up
from ....utils.session_manager import SessionManager


class AppRunnerRpc(jsonrpc.JsonRpc):

    def __init__(self, session_manager: SessionManager, session_id: str, app: App, user: User) -> None:
        super().__init__()
        self.app = app
        self.user = user
        self.session_id = session_id
        self.session_manager = session_manager
        self.docker = aiodocker.Docker()
        self.container: Optional[aiodocker.docker.DockerContainer] = None
        self.attach_ws: Optional[ClientWebSocketResponse] = None
        self._attach_ws_receiver_task: Optional[asyncio.Task[Any]] = None
        self._watcher_task: Optional[asyncio.Task[Any]] = None
        self.path_hash: Optional[str] = None
        self.traefik_name: str

    async def close(self) -> None:
        if self.attach_ws:
            await self.attach_ws.close()
        if self._attach_ws_receiver_task:
            self._attach_ws_receiver_task.cancel()
        if self.container:
            await self.container.stop()
            await self.container.delete(force=True)
        await self.docker.close()

    @jsonrpc.register
    async def init(self) -> Optional[str]:
        await self.notify('status',state='init')
        if not self.app.ready:
            await self.notify('status',state='error', message="App is not ready")
            return None

        self.traefik_name = f"{self.user.username.replace('.','-')}{self.app.name.replace('.','-')}{self.app.release.name.replace('.','-')}"
        self.path_hash = hash_path(self.user.id, self.app,self.session_id)
        config = self.app.app_config.create_container_config(
            self.app.release.docker_image,
            self.traefik_name,
            app_config.APPS_DOCKER_NETWORK,
            self.path_hash
        ).hostname(f"{self.app.name}-runner").tty(True).network_alias(app_config.APPS_DOCKER_NETWORK,f'{self.user.username}.{self.app.name}.{self.app.release.name}')

        config = setup_volumes(config, self.user, self.app)
        config = setup_environ(config, self.user, self.app)
        config = setup_labels(config, self.app)

        self.container = await self.docker.containers.create_or_replace(
            self.container_name(),
            config
        )
        if not self.container:
            return None

        if self.app.workbench_config.networks:
            await connect_container_to_networks(self.container, self.user, self.app.workbench_config.networks)
        await self.notify('status', state='created')
        if self.app.app_config.proxy:
            await self.session_manager.add_proxy_hash_to_session(self.session_id, self.path_hash)
            return proxy_url(self.path_hash)
        else:
            return None

    @jsonrpc.register
    async def run(self) -> None:
        await self.notify('status', state='starting')
        if self._watcher_task:
            self._watcher_task.cancel()

        if not self.container:
            return

        await self.container.start()
        await setup_container_routing(self.container.id)
        self._watcher_task = asyncio.create_task(self._watch())
        self.attach_ws = await self.container.websocket()
        self._attach_ws_receiver_task = asyncio.create_task(self._attach_ws_receiver())
        if self.app.app_config.proxy:
            await wait_service_up(f"{self.traefik_name}@docker")
            await asyncio.sleep(5)
        await self.notify('status', state='active')

    @jsonrpc.register
    async def stop(self) -> None:
        if self.container:
            await self.container.stop()

    @jsonrpc.register
    async def stream_write(self, data: str) -> None:
        if self.attach_ws:
            await self.attach_ws.send_bytes(data.encode())

    @jsonrpc.register
    async def resize(self, cols: int, rows: int) -> None:
        if not self.container:
            return
        try:
            await self.container.resize(h=rows,w=cols)
        except Exception:
            pass

    async def _attach_ws_receiver(self) -> None:
        assert self.attach_ws
        async for msg in self.attach_ws:
            if msg.type == WSMsgType.text:
                await self.notify('on_stream',data=msg.data)
            elif msg.type == WSMsgType.binary:
                await self.notify('on_stream', data=msg.data.decode())

    async def _watch(self) -> None:
        if not self.container:
            return
        await self.container.wait()
        await self.notify('status', state='inactive')
        if self.path_hash and self.app.app_config.proxy:
            await self.session_manager.add_proxy_hash_to_session(self.session_id, self.path_hash)

    def container_name(self) -> str:
        return f"{self.user.username}-{self.app.name}-{self.app.release.name}-runner"
