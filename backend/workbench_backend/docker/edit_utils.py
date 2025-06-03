import asyncio
import json
import logging
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Literal,
    Mapping,
    Optional,
    TypeAlias,
    cast,
)

import aiodocker
import aiohttp
from aiodocker.docker import DockerContainer
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from websockets import exceptions as ws_exceptions
from websockets.legacy import client as ws_client
from websockets.legacy.client import WebSocketClientProtocol

from ..app.config import config as app_config
from ..db.models.repository import Repository
from ..db.models.user import User
from .utils import (
    ContainerConfigBuilder,
    Event,
    EventListener,
    ListenerCallback,
    WorkbenchContainerLabels,
    setup_container_routing,
    setup_environ,
    setup_labels,
    setup_volumes,
)

NotificationType : TypeAlias = (Literal['PORTS_CHANGED'] |
                                Literal['PROCESS_EXITED'] |
                                Literal['PROCESS_STARTED'] |
                                Literal['CHILD_PROCESS_STARTED'] |
                                Literal['CHILD_PROCESS_EXITED'] |
                                Literal['OPEN_FILE_REQUEST']
                               )



class ChildProcess(BaseModel):
    pid: int
    ppid: int
    name: str
    ports: List[int]

class Process(BaseModel):
    pid: int
    name: str
    cmd: str
    args: List[str]
    ports: List[int]
    children: Dict[int, ChildProcess]

class Notification(BaseModel):
    pid: Optional[int] = None
    ppid: Optional[int] = None
    type: NotificationType
    data: Any


class EditStreamHandler:

    ws: Optional[WebSocketClientProtocol]

    def __init__(
        self,
        url: str,
        on_receive: Callable[[str | bytes], Awaitable[None]]
    ) -> None:
        self.url = url
        self.on_receive = on_receive
        self._ready = asyncio.Event()

    def start(self) -> None:
        self.task = asyncio.create_task(self._run())

    async def ready(self) -> Literal[True]:
        return await self._ready.wait()

    def stop(self) -> None:
        if self.task:
            self.task.cancel()

    async def _run(self) -> None:
        async for ws in ws_client.connect(self.url):
            try:
                self.ws = ws
                self._ready.set()
                async for data in ws:
                    await self.on_receive(data)
            except ws_exceptions.ConnectionClosed as e:
                logging.debug("Websocket closing",exc_info=e)
                continue
            except ConnectionRefusedError:
                continue
            except asyncio.CancelledError:
                logging.debug('Process Stream task canceled')
                break
        self.ws = None

    async def send(self, data: Any) -> None:
        await self.ready()
        assert self.ws
        await self.ws.send(data)

class LspServiceHandler:
    def __init__(self,ip: str, port: int, available: set[str]) -> None:
        self.ip = ip
        self.port = port
        self.available = available
        self._handlers: Dict[str, EditStreamHandler] = {}

    async def connect(self, on_receive: Callable[[str | bytes], Awaitable[None]], lang: str) -> EditStreamHandler:
        if lang not in self.available:
            raise Exception(f"{lang} is not available")
        if lang in self._handlers:
            raise Exception(f"{lang} is already running")
        handler = EditStreamHandler(f'ws://{self.ip}:{self.port}/?name={lang}', on_receive)
        handler.start()
        await handler.ready()
        self._handlers[lang] = handler
        return handler

    async def send(self, lang: str, data: Any) -> None:
        if lang not in self._handlers:
            raise Exception(f'{lang} is not running')
        await self._handlers[lang].send(data)

    async def stop(self) -> None:
        for _id, handler in self._handlers.items():
            handler.stop()


class ProcessManager:


    def __init__(
        self,
        ip: str,
        port: int = 3000
    ) -> None:
        self.ip = ip
        self.port = port
        self.client = aiohttp.ClientSession(base_url=f'http://{self.ip}:{self.port}')
        self.docker = aiodocker.Docker()
        self._processes: Dict[int, Process] = {}
        self._notif_task = asyncio.create_task(self._notif_handler())
        self._notif_event = Event[Notification]()

    @property
    def processes(self) -> Dict[int, Process]:
        return self._processes

    @property
    def on_notification(self) -> Callable[[ListenerCallback[Notification]], EventListener[[Notification]]]:
        return self._notif_event.listen

    async def ready(self) -> bool:
        try:
            await self._ready()
            return True
        except Exception:
            return False

    async def run(
        self,
        cmd: str = 'run',
        args: Optional[List[str]] = None,
        cols: Optional[int] = None,
        rows: Optional[int] = None,
        cwd: Optional[str] = None,
        env: Optional[Mapping[str,str]] = None,
        term_type: Optional[str] = None
    ) -> Process:
        data = {
            'cmd':cmd,
            'args':args,
            'cols':cols,
            'rows':rows,
            'cwd':cwd,
            'env':env,
            'name':term_type
        }
        async with self.client.post('/', json=data) as resp:
            if resp.status == 201:
                proc = Process(**(await resp.json()))
                self._processes[proc.pid] = proc
                return proc
            raise Exception("RUN ERROR")

    async def resize(
        self,
        pid: int,
        cols: int,
        rows: int
    ) -> None:
        data = {
            'cols':cols,
            'rows':rows
        }
        async with self.client.post(f'/{pid}/resize',json=data) as resp:
            if resp.status == 200:
                return
            logging.error(await resp.json())
            raise Exception("RESIZE ERROR")

    async def kill(
        self,
        pid: int,
        signal: str = "SIGKILL"
    ) -> Any:
        async with self.client.post(f'/{pid}/kill', params={'signal':signal}) as resp:
            if resp.status == 200:
                return await resp.json()
            else:
                raise Exception("Error")

    async def pause(
        self,
        pid: int
    ) -> Any:
        async with self.client.post(f'/{pid}/pause') as resp:
            if resp.status == 200:
                return
            else:
                raise Exception("Error")

    async def resume(
        self,
        pid: int
    ) -> None:
        async with self.client.post(f'/{pid}/resume') as resp:
            if resp.status == 200:
                return
            else:
                raise Exception("Error")

    async def clear(
        self,
        pid: int,
    ) -> None:
        async with self.client.post(f'/{pid}/clear') as resp:
            if resp.status == 200:
                return
            else:
                raise Exception("Error")

    async def wait(
        self,
        pid: int,
        timeout: Optional[int] = None
    ) -> int:
        async with self.client.get(f'/{pid}/wait',params={'timeout':timeout}) as resp:
            if resp.status == 200:
                data = await resp.json()
                if 'exitCode' in data:
                    return cast(int, data['exitCode'])
                elif 'detail' in data and data['detail'] == 'Timeout':
                    raise Exception('Timeout')
                else:
                    raise Exception('Error')
            else:
                raise Exception('Error')

    async def startLspService(
        self,
        lspArgs: Dict[str, str]
    ) -> LspServiceHandler:
        async with self.client.post('/startLsp',json=lspArgs) as resp:
            if resp.status != 200:
                raise Exception("LSP error")
            data = await resp.json()
            return LspServiceHandler(self.ip, data['port'], set(data['lsps']))

    def get_attach_url(
        self,
        pid: int
    ) -> str:
        return f'ws://{self.ip}:{self.port}/{pid}/attach'

    async def _notif_handler(self) -> None:
        async for ws in ws_client.connect(f'ws://{self.ip}:{self.port}/notifications'):
            try:
                async for data in ws:
                    logging.debug(data)
                    notif = Notification(**json.loads(data))
                    logging.debug(notif)
                    if notif.type == 'PROCESS_EXITED':
                        assert notif.pid
                        del self._processes[notif.pid]
                    elif notif.type == 'PROCESS_STARTED':
                        proc = Process(**notif.data) # who the hell started it anyway?
                        self._processes[proc.pid] = proc
                    elif notif.type == 'CHILD_PROCESS_STARTED':
                        child = ChildProcess(**notif.data)
                        assert notif.pid
                        self._processes[notif.pid].children[child.pid] = child
                    elif notif.type == 'CHILD_PROCESS_EXITED':
                        assert notif.pid
                        self._processes[notif.pid].children.pop(notif.data['pid'])
                    elif notif.type == 'PORTS_CHANGED':
                        if notif.pid in self._processes:
                            self._processes[notif.pid].ports = notif.data
                        else:
                            for key, value in self._processes.items():
                                if notif.pid in value.children:
                                    self._processes[key].children[notif.pid].ports = notif.data
                                    break
                    else:
                        logging.warning(f"Unhandled notification type in from editor container: {notif}")
                    await self._notif_event.fire(notif)
            except ws_exceptions.ConnectionClosed:
                continue
            except ConnectionRefusedError:
                continue
            except asyncio.CancelledError:
                await ws.close()
                break
            except Exception as e:
                logging.error("Notification error", exc_info=e)
                continue

    @retry(
        retry=retry_if_exception_type((aiohttp.ClientConnectionError, ConnectionRefusedError)),
        stop=stop_after_attempt(15),
        wait=wait_exponential(max=5),
        reraise=True
    )
    async def _ready(self) -> None:
        async with self.client.get('/'):
            pass

    async def close(self) -> None:
        self._notif_task.cancel()
        await self.docker.close()
        await self.client.close()

class EditorContainer:

    def __init__(
        self,
        repo: Repository,
        user: User,
    ) -> None:
        self.repo = repo
        self.user = user
        self.client = aiodocker.Docker()
        self.container: DockerContainer
        self._using_existing_container = False

    @property
    def using_existing_container(self) -> bool:
        return self._using_existing_container

    async def start(self) -> None:
        self._using_existing_container = False
        config = ( ContainerConfigBuilder('editor-container:latest')
                    .hostname(f'{self.repo.name}-editor')
                    .network(app_config.APPS_DOCKER_NETWORK)
                    .network_alias(app_config.APPS_DOCKER_NETWORK,f'{self.user.username}.{self.repo.name}.editor')
                    .working_dir(f'/home/runner/{self.repo.name}')
                    .volume(self.repo.path(),f'/home/runner/{self.repo.name}','rw'))
        config = setup_volumes(config,self.user, self.repo)
        config = setup_environ(config, self.user, self.repo)
        config = setup_labels(config, self.repo)
        try:
            existing = await self.client.containers.get(f"{self.repo.owner.username}-{self.repo.name}-editor")
        except Exception:
            existing = None
        if existing:
            container_hash = existing['Config']['Labels'].get(WorkbenchContainerLabels.CONFIG_HASH.value)
        else:
            container_hash = None
        logging.debug(f'Container config: {config}')
        if existing and config.hash() == container_hash:
            self.container = existing
            self._using_existing_container = True
            logging.debug(f'Using existing container: {self.container}')
        else:
            logging.debug('Recreating container')
            logging.debug(f'Container hash: {container_hash} \n')
            logging.debug(f'New hash: {config.hash()}')
            config_hash = config.hash()
            config.label(WorkbenchContainerLabels.CONFIG_HASH.value, config_hash)
            self.container = await self.client.containers.create_or_replace(
                f"{self.repo.owner.username}-{self.repo.name}-editor",
                config
            )
        if not self.container:
            raise RuntimeError("Couldn't create container")
        await self.container.start()
        await self.container.show()
        self._ip: str = self.container['NetworkSettings']['Networks'][app_config.APPS_DOCKER_NETWORK]["IPAddress"]
        self._process_manager = ProcessManager(self._ip)
        if not (await self._process_manager.ready()):
            raise RuntimeError("Cannot access container")

    async def remove(self) -> None:
        if not self.container:
            return
        await self.container.delete(force=True)

    async def restart(self) -> None:
        if not self.container:
            return
        await self.container.restart()
        if not (await self._process_manager.ready()):
            raise RuntimeError("Cannot access container")

    async def connect_to_network(self, network_id: str) -> bool:
        if not self.container:
            return False
        if f'network-access:{network_id}' not in self.user.permissions:
            return False
        try:
            network = await self.client.networks.get(network_id)
            await network.connect({"Container":self.container.id})
            await setup_container_routing(self.container.id)
            return True
        except Exception as e:
            logging.error("Error connecting dev container to network", exc_info=e)
            return False

    async def disconnect_from_network(self, network_id: str) -> bool:
        if not self.container:
            return False
        if network_id == app_config.APPS_DOCKER_NETWORK:
            return False
        try:
            network = await self.client.networks.get(network_id)
            await network.disconnect({"Container":self.container.id})
            return True
        except Exception as e:
            logging.error("Error disconnecting dev container from network", exc_info=e)
            return False

    async def get_network_ip(self, network: str) -> Optional[str]:
        if not self.container:
            return None
        await self.container.show()
        return cast(str,self.container['NetworkSettings']['Networks'].get(network,{}).get('IPAddress'))

    async def get_networks(self) -> List[str]:
        if not self.container:
            return []
        await self.container.show()
        return list(
            self.container['NetworkSettings']['Networks'].keys()
        )

    async def wait(self) -> Any:
        return self.container.wait()

    @property
    def process_manager(self) -> ProcessManager:
        return self._process_manager

    @property
    def ip(self) -> str:
        return self._ip

    async def close(self) -> None:
        if self.process_manager:
            await self.process_manager.close()
        if self.container:
            await self.container.stop()
        await self.client.close()
