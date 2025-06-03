from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..api import api_router
from ..cache.redis import cache as redis_cache
from ..middlewares import DbSessionMiddleware
from .config import config
from .custom_log import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await redis_cache.close()

def create_app() -> FastAPI:
    app = FastAPI(
        title="FloWide Workbench Backend",
        lifespan=lifespan,
        swagger_ui_init_oauth={
            "clientId": "workbench-api",
            "appName": "Workbench Api",
            "usePkceWithAuthorizationCodeGrant": True,
            "scopes": "openid profile",
        }
    )
    app.add_middleware(DbSessionMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"]
    )
    app.include_router(api_router)
    setup_logging(config.LOG_LEVEL)
    return app
