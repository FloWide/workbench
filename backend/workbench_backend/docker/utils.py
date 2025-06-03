from __future__ import annotations

import asyncio
import inspect
from typing import (
    TYPE_CHECKING,
    Any,
    Awaitable,
    Callable,
    Dict,
    Generic,
    List,
    Literal,
    ParamSpec,
    Self,
    Tuple,
    TypeAlias,
)

from aiodocker import Docker
from aiodocker.containers import DockerContainer

if TYPE_CHECKING:
    from ..db.models import Repository
    from ..db.models.app import App
    from ..db.models.service import Service
    from ..db.models.user import User
import hashlib
import json
import logging
import os
from enum import Enum

import nsenter  # type: ignore

EventParam = ParamSpec('EventParam')

ListenerCallback: TypeAlias = Callable[EventParam, None | Awaitable[None]]

class EventListener(Generic[EventParam]):

    def __init__(
        self,
        event: "Event[EventParam]",
        listener: ListenerCallback[EventParam]
    ) -> None:
        self.listener = listener
        self.event = event

    def dispose(self) -> None:
        self.event.remove_listener(self.listener)

class Event(Generic[EventParam]):

    def __init__(self) -> None:
        self.listeners: List[ListenerCallback[EventParam]] = []

    def listen(self, listener: ListenerCallback[EventParam]) -> EventListener[EventParam]:
        self.listeners.append(listener)
        return EventListener(self, listener)

    def remove_listener(self, listener: ListenerCallback[EventParam]) -> None:
        self.listeners.remove(listener)

    async def fire(self,*args: EventParam.args, **kwargs: EventParam.kwargs) -> None:
        await asyncio.gather(*[f(*args,**kwargs) if inspect.iscoroutinefunction(f) else asyncio.to_thread(f,*args,**kwargs) for f in self.listeners])

class ContainerConfigBuilder(dict[str, Any]):

    def __init__(self, image: str, **kwargs: Any):
        super().__init__(Image=image, **kwargs)
        self.update({'HostConfig':{}})
        self.update({'NetworkingConfig':{}})

    def hostname(self, hostname: str) -> Self:
        self.update(Hostname=hostname)
        return self

    def network(self, network: str) -> Self:
        if 'HostConfig' in self:
            self['HostConfig'].update({'NetworkMode':network})
        else:
            self.update({'HostConfig':{'NetworkMode':network}})
        return self

    def network_alias(self, network: str, alias: str) -> Self:
        if 'NetworkingConfig' not in self:
            self['NetworkingConfig'] = {}
        if 'EndpointsConfig' not in self['NetworkingConfig']:
            self['NetworkingConfig']['EndpointsConfig'] = {}
        endpoints = self['NetworkingConfig']['EndpointsConfig']
        if network not in endpoints:
            endpoints[network] = {}
        if 'Aliases' in endpoints[network]:
            endpoints[network]['Aliases'].append(alias)
        else:
            endpoints[network]['Aliases'] = [alias]
        return self

    def volume(self, local_path: str, container_path: str, opt: Literal['rw'] | Literal['ro'] = 'ro') -> Self:
        if 'HostConfig' in self:
            host_config = self['HostConfig']
            if 'Binds' in host_config:
                host_config['Binds'].append(f"{local_path}:{container_path}:{opt}")
            else:
                host_config.update({'Binds':[f"{local_path}:{container_path}:{opt}"]})
        else:
            self.update({'HostConfig':{'Binds':[f"{local_path}:{container_path}:{opt}"]}})
        return self

    def env(self, key: str, value: str) -> Self:
        if 'Env' in self:
            self['Env'].append(f"{key}={value}")
        else:
            self.update({'Env':[f"{key}={value}"]})
        return self

    def working_dir(self, path: str) -> Self:
        self.update(WorkingDir=path)
        return self

    def tty(self, tty: bool) -> Self:
        self.update(Tty=tty)
        return self

    def label(self, key: str, value: str) -> Self:
        if 'Labels' in self:
            self['Labels'].update({key:value})
        else:
            self.update(Labels={key:value})
        return self

    def cmd(self, cmd: List[str]) -> Self:
        self.update(Cmd=cmd)
        return self

    def user(self, user: str) -> Self:
        self.update(User=user)
        return self

    def entrypoint(self, entrypoint: List[str]) -> Self:
        self.update(Entrypoint=entrypoint)
        return self

    def restart_policy(self, policy: Literal['no', 'always', 'unless-stopped', 'on-failure']) -> Self:
        host_config = self['HostConfig']
        if 'RestartPolicy' in host_config:
            host_config['RestartPolicy'].update({'Name':policy})
        else:
            host_config.update({'RestartPolicy':{'Name':policy}})
        return self

    def max_retry_count(self, count: int) -> Self:
        host_config = self['HostConfig']
        if 'RestartPolicy' in host_config:
            host_config['RestartPolicy'].update({'MaximumRetryCount':count})
        else:
            host_config.update({'RestartPolicy':{'MaximumRetryCount':count}})
        return self

    def hash(self) -> str:
        return hashlib.sha1(
            json.dumps(self, sort_keys=True).encode()
        ).hexdigest()



VolumeDefinition: TypeAlias = Dict[str, Tuple[str, Literal["rw", "ro"]]]

PERMISSION_VOLUMES: Dict[str, VolumeDefinition] = {
    "shared_files": {
        "read:shared-files": ("/data/shared_files", "ro"),
        "write:shared-files": ("/data/shared_files", "rw"),
    },
    "public_http": {
        "read:public-http": ("/data/public_http", "ro"),
        "write:public-http": ("/data/public_http", "rw"),
    },
    "private_http": {
        "read:private-http": ("/data/private_http", "ro"),
        "write:private-http": ("/data/private_http", "rw"),
    },
    "/var/run/docker.sock": {
        "god": ("/var/run/docker.sock", "rw"),
    },
}



def setup_volumes(config: ContainerConfigBuilder, user: User, obj: Repository | App | Service) -> ContainerConfigBuilder:
    volumes: Dict[str, Tuple[str, Literal["rw", "ro"]]] = {
        user.username: ("/home/runner/MyData", "rw"),
        f"{user.username}.{obj.name}.data": ("/home/runner/AppData", "rw"),
    }

    for mount_point, perms in PERMISSION_VOLUMES.items():
        for perm, (path, access) in perms.items():
            if perm in user.permissions:
                # Ensure we do not downgrade an "rw" to "ro"
                if mount_point not in volumes or access == "rw":
                    volumes[mount_point] = (path, access)

    for local_path, (container_path, mode) in volumes.items():
        config = config.volume(local_path, container_path, mode)

    return config

def setup_environ(config: ContainerConfigBuilder, user: User, obj: Repository | App | Service) -> ContainerConfigBuilder:
    config.env('WORKBENCH_USER',user.username)
    config.env('SERVER',os.environ.get('SERVER',''))
    config.env('DOMAIN', os.environ.get('DOMAIN',''))
    config.env('HTTP_PROXY', os.environ.get('HTTP_PROXY',''))
    config.env('HTTPS_PROXY', os.environ.get('HTTPS_PROXY',''))
    config.env('GIT_AUTHOR_NAME', user.username)
    config.env('GIT_AUTHOR_EMAIL', user.email)
    config.env('GIT_COMMITTER_NAME', user.username)
    config.env('GIT_COMMITTER_EMAIL', user.email)

    if 'god' in user.permissions:
        config.user('root')
        config.entrypoint([])

    return config

async def connect_container_to_networks(container: DockerContainer, user: User, networks: List[str]) -> None:
    async def connect(client: Docker, network_id: str) -> None:
        try:
            if f"network-access:{network_id}" not in user.permissions:
                return
            docker_net = await client.networks.get(network_id)
            await docker_net.connect({"Container": container.id})
        except Exception as e:
            logging.error("Container network connect error",exc_info=e)

    async with Docker() as client:
        await asyncio.gather(*[
            connect(client, id) for id in networks
        ])

async def setup_container_routing(container_id: str) -> None:
    try:
        async with Docker() as client:
            container = await client.containers.get(container_id)
            await container.show()
            if not container['State'].get('Status') == 'running' or not container['State']['Pid']:
                return
            pid = container['State']['Pid']
            with nsenter.Namespace(pid, 'net'):
                proc = await asyncio.create_subprocess_exec('ip','route','add','192.168.200.0/24','via','10.20.22.1', stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                await proc.wait()
    except Exception as e:
        logging.error("Container routing setup error",exc_info=e)



class WorkbenchContainerLabels(str, Enum):
    IS_APP_CONTAINER = 'net.flowide.workbench.app'
    IS_SERVICE_CONTAINER = 'net.flowide.workbench.service'
    IS_EDIT_CONTAINER = 'net.flowide.workbench.edit'

    RESOURCE_ID = 'net.flowide.workbench.resource.id'

    CONFIG_HASH = 'net.flowide.workbench.config.hash'

    SESSION_ID = 'net.flowide.workbench.session.id'

    SHOW_IN_WORKBENCH = 'net.flowide.workbench.show_in_workbench'


def setup_labels(config: ContainerConfigBuilder, obj: Repository | App | Service) -> ContainerConfigBuilder:
    config.label(WorkbenchContainerLabels.RESOURCE_ID.value, str(obj.id))

    # These are here because of circular import
    from ..db.models import Repository
    from ..db.models.app import App
    from ..db.models.service import Service

    match obj:
        case Repository():
            config.label(WorkbenchContainerLabels.IS_EDIT_CONTAINER.value, '1')
        case App():
            config.label(WorkbenchContainerLabels.IS_APP_CONTAINER.value, '1')
        case Service():
            config.label(WorkbenchContainerLabels.IS_SERVICE_CONTAINER.value, '1')
        case _:
            raise TypeError('Unsupported type')


    return config
