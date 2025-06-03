from typing import Final
from urllib import parse

from aiocache import Cache, RedisCache  # type: ignore

from ..app.config import config


def setup_redis_cache() -> RedisCache:
    parsed_redis_url = parse.urlparse(config.REDIS_BROKER_URL)
    return Cache(Cache.REDIS,
          endpoint=parsed_redis_url.hostname,
          port=parsed_redis_url.port,
          password=parsed_redis_url.password,
          namespace='workbench_backend_cache',
          ttl=60*60*2
    )


cache: Final = setup_redis_cache()
