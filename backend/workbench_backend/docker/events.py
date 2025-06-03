import asyncio
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, Optional

from aiodocker import Docker

from .utils import Event, EventListener, ListenerCallback


class DockerEventType(str, Enum):
    BUILDER = "builder"
    CONFIG = "config"
    CONTAINER = "container"
    DAEMON = "daemon"
    IMAGE = "image"
    NETWORK = "network"
    NODE = "node"
    PLUGIN = "plugin"
    SECRET = "secret"
    SERVICE = "service"
    VOLUME = "volume"


class DockerEventAction(str, Enum):
    CREATE = "create"
    START = "start"
    RESTART = "restart"
    STOP = "stop"
    CHECKPOINT = "checkpoint"
    PAUSE = "pause"
    UNPAUSE = "unpause"
    ATTACH = "attach"
    DETACH = "detach"
    RESIZE = "resize"
    UPDATE = "update"
    RENAME = "rename"
    KILL = "kill"
    DIE = "die"
    OOM = "oom"
    DESTROY = "destroy"
    REMOVE = "remove"
    COMMIT = "commit"
    TOP = "top"
    COPY = "copy"
    ARCHIVE_PATH = "archive-path"
    EXTRACT_TO_DIR = "extract-to-dir"
    EXPORT = "export"
    IMPORT = "import"
    SAVE = "save"
    LOAD = "load"
    TAG = "tag"
    UNTAG = "untag"
    PUSH = "push"
    PULL = "pull"
    PRUNE = "prune"
    DELETE = "delete"
    ENABLE = "enable"
    DISABLE = "disable"
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    RELOAD = "reload"
    MOUNT = "mount"
    UNMOUNT = "unmount"
    EXEC_CREATE = "exec_create"
    EXEC_START = "exec_start"
    EXEC_DIE = "exec_die"
    EXEC_DETACH = "exec_detach"
    HEALTH_STATUS = "health_status"
    HEALTH_STATUS_RUNNING = "health_status: running"
    HEALTH_STATUS_HEALTHY = "health_status: healthy"
    HEALTH_STATUS_UNHEALTHY = "health_status: unhealthy"


@dataclass
class DockerEventActor:
    ID: str
    attributes: Dict[str, str]


@dataclass
class DockerEventMessage:
    Type: DockerEventType
    Action: DockerEventAction
    Actor: DockerEventActor
    status: Optional[str] = None  # Deprecated: use Action instead
    id: Optional[str] = None  # Deprecated: use Actor.ID instead
    from_: Optional[str] = None  # Deprecated: use Actor.attributes["image"] instead
    scope: Optional[str] = None
    time: Optional[int] = None
    timeNano: Optional[int] = None


class DockerEvents:

    def __init__(self) -> None:
        self._client = Docker()
        self._events = Event[DockerEventMessage]()

    def start(self) -> None:
        self._task = asyncio.create_task(self._watcher_task())

    async def _watcher_task(self) -> None:
        subscriber = self._client.events.subscribe()
        try:
            while True:
                event = await subscriber.get()
                if event is None:
                    break
                from_ = event.get('from')
                if 'from' in event:
                    del event['from']
                await self._events.fire(DockerEventMessage(**event, from_=from_))
        except asyncio.CancelledError:
            pass

    @property
    def on_event(self) -> Callable[[ListenerCallback[DockerEventMessage]], EventListener[[DockerEventMessage]]]:
        return self._events.listen

    def listen(self, listener: ListenerCallback[DockerEventMessage]) -> ListenerCallback[DockerEventMessage]:
        self._events.listen(listener)
        return listener

    async def close(self) -> None:
        self._task.cancel()
        await self._task
        await self._client.close()
