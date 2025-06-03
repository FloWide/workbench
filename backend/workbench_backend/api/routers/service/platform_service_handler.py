import asyncio
import datetime
from typing import Dict, List, Literal, Optional, TypeAlias

from aiodocker import Docker, DockerError
from aiodocker.containers import DockerContainer
from pydantic import BaseModel

from ....docker.utils import WorkbenchContainerLabels

PlatformServiceStatus: TypeAlias = Literal["created", "running", "paused", "restarting", "exited", "removing", "dead"]

class PlatformService(BaseModel):
    id: str
    name: str
    started_at: Optional[datetime.datetime] = None
    status: PlatformServiceStatus

class PlatFormServiceNotFound(Exception):
    pass

class PlatformServiceHandler:

    def __init__(self) -> None:
        self.docker = Docker()

    async def get_all(self) -> List[PlatformService]:
        containers = await self._get_service_containers(inspect=True)
        return [self._to_service(container) for container in containers.values()]

    async def get_one(self, id: str) -> PlatformService:
        container = await self._get_service_container(id, inspect=True)
        if container is None:
            raise PlatFormServiceNotFound(f"Service with id {id} not found")
        return self._to_service(container)

    async def get_logs(self, id: str, limit: int) -> str:
        container = await self._get_service_container(id, inspect=False)
        if container is None:
            raise PlatFormServiceNotFound(f"Service with id {id} not found")
        logs: List[str] = await container.log(
            stdout=True,
            stderr=True,
            follow=False,
            tail=limit,
            timestamps=True,
        )
        return ''.join(logs)



    async def _get_service_containers(self, inspect: bool = False) -> Dict[str, DockerContainer]:
        containers = await self.docker.containers.list(all=True, filters={"label": [f"{WorkbenchContainerLabels.SHOW_IN_WORKBENCH.value}=1"]})
        if inspect:
            tasks = [container.show() for container in containers]
            await asyncio.gather(*tasks)
        return {container.id: container for container in containers}

    async def _get_service_container(self, id: str, inspect: bool = False) -> DockerContainer | None:
        try:
            container: DockerContainer = await self.docker.containers.get(id)
            if inspect:
                await container.show()
            if container["Config"]["Labels"].get(WorkbenchContainerLabels.SHOW_IN_WORKBENCH.value) is None:
                return None
            return container
        except DockerError as e:
            if e.status == 404:
                return None
            else:
                raise e

    async def close(self) -> None:
        await self.docker.close()

    def _to_service(self, container: DockerContainer) -> PlatformService:
        return PlatformService(
            id=container.id,
            name=container['Name'],
            started_at=datetime.datetime.fromisoformat(container['State']['StartedAt']) if container['State']['StartedAt'] else None,
            status=container['State']['Status'],
        )

