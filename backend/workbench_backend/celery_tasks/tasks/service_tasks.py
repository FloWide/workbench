import redis.asyncio as aioredis

from ...app.config import config
from ...crud.schemas.service import ServiceCRUD
from ...db.standalone_session import standalone_session
from ..celery_app import app
from ..to_sync import syncify


@app.task
@syncify
async def proxy_latest_service(service_name: str) -> None:
    async with standalone_session() as session:
        service_crud = ServiceCRUD.make_instance(session, True)
        latest_service = await service_crud.read_latest_running(service_name)
        if not latest_service:
            return

        path = f'/services/{latest_service.owner.username}/{latest_service.name}'
        latest_traefik_name = f"{latest_service.owner.username.replace('.','-')}{latest_service.name.replace('.','-')}-latest"
        redis = aioredis.from_url(config.REDIS_BROKER_URL) # type: ignore
        async with redis.pipeline() as pipe:
            # Router to latest service by path
            await pipe.set(f"traefik/http/routers/{latest_traefik_name}/rule", f"Method(`GET`) && PathPrefix(`{path}`)")
            await pipe.set(f"traefik/http/routers/{latest_traefik_name}/service", f"{latest_service.traefik_name}@docker")
            await pipe.set(f"traefik/http/middlewares/{latest_traefik_name}-strip/stripprefix/prefixes", path)
            await pipe.set(f"traefik/http/routers/{latest_traefik_name}/middlewares", f"{latest_traefik_name}-strip")

            if latest_service.service_config.cookie_auth:
                await pipe.set(f"traefik/http/routers/{latest_traefik_name}/middlewares", f"{latest_traefik_name}-strip, traefik-forward-auth@docker")
                await pipe.set(f"traefik/http/routers/{latest_traefik_name}/rule", f"PathPrefix(`{path}`)")

            if latest_service.service_config.proxy == 'public':
                await pipe.set(f"traefik/http/routers/{latest_traefik_name}/middlewares", f"{latest_traefik_name}-strip")
                await pipe.set(f"traefik/http/routers/{latest_traefik_name}/rule", f"PathPrefix(`{path}`)")

            # Router to latest service by subdomain
            if subdomain := latest_service.service_config.subdomain:
                router_name = f"{latest_traefik_name}-{subdomain}-subdomain"
                host_rule = f"Host(`{config.PROXY_TEMPLATE.format(hash=subdomain)}`)"
                await pipe.set(f"traefik/http/routers/{router_name}/rule", f"METHOD(`GET`) && {host_rule}")
                await pipe.set(f"traefik/http/routers/{router_name}/service", f"{latest_service.traefik_name}@docker")

                if latest_service.service_config.cookie_auth:
                    await pipe.set(f"traefik/http/routers/{router_name}/middlewares", "traefik-forward-auth@docker")
                    await pipe.set(f"traefik/http/routers/{router_name}/rule", f"{host_rule}")

                if latest_service.service_config.proxy == 'public':
                    await pipe.set(f"traefik/http/routers/{router_name}/middlewares", "")
                    await pipe.set(f"traefik/http/routers/{router_name}/rule", f"{host_rule}")


            await pipe.execute()
        await redis.close()

