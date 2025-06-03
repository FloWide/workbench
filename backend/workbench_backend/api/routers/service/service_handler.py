import datetime
from typing import List, Optional

import aiodocker
from aiodocker import DockerError
from aiodocker.docker import DockerContainer

from ....app.config import config as app_config
from ....celery_tasks.tasks.service_tasks import proxy_latest_service
from ....crud.schemas.service import ServiceCRUD, ServiceUpdateSchema
from ....db.models.service import Service, ServiceStatusEnum
from ....db.models.user import User
from ....docker.utils import (
    ContainerConfigBuilder,
    connect_container_to_networks,
    setup_container_routing,
    setup_environ,
    setup_labels,
    setup_volumes,
)
from ....utils.proxy import hash_path, proxy_url


class ServiceHandler:
    def __init__(
        self,
        service: Service,
        service_crud: ServiceCRUD,
        user: Optional[User] = None
    ) -> None:
        self.service = service
        self.service_crud = service_crud
        self.user = user
        self.docker = aiodocker.Docker()
        self.url: str | None = None

    async def init(self) -> None:
        self.container = await self._get_container()

    async def close(self) -> None:
        await self.docker.close()

    async def run(self) -> None:
        if self.container:
            await self.container.start()
            self.service = await self.service_crud.update(self.service,ServiceUpdateSchema(
                status=ServiceStatusEnum.ACTIVE,
                started_at=datetime.datetime.now()
            ))
            return
        if not self.service.ready:
            # TODO: exception
            raise Exception('Service is not ready')

        if not self.user:
            # TODO: exception
            raise Exception('User is not set')

        traefik_name = self.service.traefik_name
        path_hash = hash_path(self.user.id, self.service)

        config = self.service.service_config.create_container_config(
            self.service.release.docker_image,
            traefik_name,
            app_config.APPS_DOCKER_NETWORK,
            path_hash,
            False
        ).tty(False).hostname(f"{self.service.name}-runner").network_alias(app_config.APPS_DOCKER_NETWORK,f'{self.user.username}.{self.service.name}.{self.service.release.name}')
        config = self._setup_service_proxy(config, traefik_name)
        if self.service.service_config.proxy:
            self.url = proxy_url(path_hash)

        config = setup_volumes(config, self.user, self.service)
        config = setup_environ(config, self.user, self.service)
        config = setup_labels(config, self.service)

        config.env('PYTHONUNBUFFERED','1')
        container = await self.docker.containers.create_or_replace(self.container_name(), config)
        if self.service.workbench_config.networks:
            await connect_container_to_networks(container, self.user, self.service.workbench_config.networks)
        await container.start()
        await setup_container_routing(container.id)
        self.service = await self.service_crud.update(self.service,ServiceUpdateSchema(
                status=ServiceStatusEnum.ACTIVE,
                started_at=datetime.datetime.now(),
                proxied_url=self.url
        ))


    async def stop(self, rm: bool = False) -> None:
        if not self.container:
            return
        await self.container.stop()
        if rm:
            await self.container.delete()
        self.service = await self.service_crud.update(self.service, ServiceUpdateSchema(status=ServiceStatusEnum.INACTIVE, started_at=None))

    async def restart(self) -> None:
        if self.container:
            await self.container.restart()

    async def set_enabled(self, enabled: bool) -> None:
        self.service = await self.service_crud.update(self.service, ServiceUpdateSchema(enabled=enabled))

        if self.service.enabled:
            await self.run()
        else:
            await self.stop()
        proxy_latest_service.delay(self.service.name)

    async def get_logs(self, limit: int) -> str:
        if not self.container:
            return ''
        logs: List[str] = await self.container.log(
                    stderr=True,
                    stdout=True,
                    follow=False,
                    tail=limit,
                    timestamps=True
                )
        return ''.join(logs)


    async def _get_container(self) -> Optional[DockerContainer]:
        try:
            return await self.docker.containers.get(self.container_name())
        except DockerError as e:
            if e.status == 404:
                return None
            else:
                raise e

    def _setup_service_proxy(self, config: ContainerConfigBuilder, traefik_name: str) -> ContainerConfigBuilder:
        if self.service.service_config.proxy:
            # Direct access
            path = f'/services/{self.service.owner.username}/{self.service.name}/{self.service.release.name}'
            config.label(f'traefik.http.routers.{traefik_name}-direct.rule',f'Method(`GET`) && PathPrefix(`{path}`)')
            config.label(f'traefik.http.routers.{traefik_name}-direct.service',traefik_name)
            config.label(f'traefik.http.middlewares.{traefik_name}-direct-strip.stripprefix.prefixes',path)
            config.label(f'traefik.http.routers.{traefik_name}-direct.middlewares',f'{traefik_name}-direct-strip')

            if self.service.service_config.cookie_auth:
                config.label(f'traefik.http.routers.{traefik_name}-direct.middlewares',f'{traefik_name}-direct-strip, traefik-forward-auth@docker')
                config.label(f'traefik.http.routers.{traefik_name}-direct.rule',f'PathPrefix(`{path}`)')

            if self.service.service_config.proxy == 'public':
                config.label(f'traefik.http.routers.{traefik_name}-direct.middlewares',f'{traefik_name}-direct-strip')
                config.label(f'traefik.http.routers.{traefik_name}-direct.rule',f'PathPrefix(`{path}`)')

        return config

    def container_name(self) -> str:
        return f"{self.service.owner.username}-{self.service.name}-{self.service.release.name}-runner"
