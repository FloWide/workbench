import asyncio

# import hashlib
import hashlib
import logging
from typing import Optional

import aiohttp
from redis import asyncio as aioredis
from sqlalchemy import UUID
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..app.config import config
from ..db.models.app import App
from ..db.models.service import Service


def hash_path(user_id: UUID[str], obj: App | Service, session_id: Optional[str] = None) -> str:
    hash = hashlib.sha1(str(user_id).encode(), usedforsecurity=False)
    hash.update(obj.name.encode())
    hash.update(obj.release.name.encode())
    if session_id is not None:
        hash.update(session_id.encode())
    return hash.digest().hex()

def proxy_url(hash: str) -> str:
    return f"{config.SCHEME}://{config.PROXY_TEMPLATE.format(hash=hash)}"

@retry(
        retry=retry_if_exception_type(RuntimeError),
        stop=stop_after_attempt(7),
        wait=wait_exponential(multiplier=1, max=5, exp_base=2),
        reraise=True
)
async def check_service_up(service_name: str) -> None:
    async with aiohttp.ClientSession(config.TRAEFIK_API_URL) as session:
         async with session.get(f'/api/http/services/{service_name}') as resp:
            if resp.status == 200:
                data = await resp.json()
                for _key, value in data.get('serverStatus',{}).items():
                    if value != 'UP':
                        raise RuntimeError('Service is starting')
            else:
                raise RuntimeError('Service not up')

async def wait_service_up(service_name: str) -> bool:
    try:
        await check_service_up(service_name)
        await asyncio.sleep(2)
        return True
    except RuntimeError:
        return False


class ProxyService:

    def __init__(self) -> None:
        self.redis = aioredis.from_url(config.REDIS_BROKER_URL) # type: ignore
        self.traefik_client = aiohttp.ClientSession(config.TRAEFIK_API_URL)

    async def new_service(self,name: str, ip: str, port: int) -> Optional[str]:
        async with self.redis.pipeline() as pipe:
            logging.info(f"Proxying new service: {name} endpoint: {ip}:{port}")
            await pipe.set(f"traefik/http/services/{name}/loadbalancer/servers/0/url",f'http://{ip}:{port}')
            await pipe.set(f"traefik/http/routers/{name}/rule", f"Host(`{config.PROXY_TEMPLATE.format(hash=name)}`)")
            await pipe.set(f"traefik/http/routers/{name}/service",name)
            await pipe.set(f"traefik/http/routers/{name}/middlewares","apps-middleware@file, proxy-auth@file")
            result = await pipe.execute()
            logging.debug(f"Traefik variables set: {result}")
        ready = await self.wait_service_up(name)
        if ready:
            return proxy_url(name)
        else:
            return None

    async def remove_service(self, name: str) -> None:
        logging.info(f"Removing proxy to service: {name}")
        result = await self.redis.delete(
            f"traefik/http/services/{name}/loadbalancer/servers/0/url",
            f"traefik/http/routers/{name}/rule",
            f"traefik/http/routers/{name}/service",
            f"traefik/http/routers/{name}/middlewares",
        )
        logging.debug(f"Traefik variables deleted: {result}")


    async def wait_service_up(self, name: str) -> bool:
        return await wait_service_up(f"{name}@redis")


    async def close(self) -> None:
        await self.redis.close()
        await self.traefik_client.close()
