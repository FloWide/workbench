from typing import Annotated, AsyncIterator, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from ....dependencies.auth import check_roles, get_user
from .platform_service_handler import (
    PlatformService,
    PlatformServiceHandler,
    PlatFormServiceNotFound,
)


async def platform_service_dependency() -> AsyncIterator[PlatformServiceHandler]:
    try:
        handler = PlatformServiceHandler()
        yield handler
    finally:
        await handler.close()

PLATFORM_SERVICE_HANDLER = Annotated[PlatformServiceHandler, Depends(platform_service_dependency)]

platform_service_router = APIRouter(
    prefix="/platform",
    tags=['Platform', 'Service'],
    dependencies=[Depends(get_user), Depends(check_roles(['admin']))]
)


@platform_service_router.get('')
async def get_all(platform_service_handler: PLATFORM_SERVICE_HANDLER) -> List[PlatformService]:
    return await platform_service_handler.get_all()

@platform_service_router.get('/{id}')
async def get_one(platform_service_handler: PLATFORM_SERVICE_HANDLER, id: str) -> PlatformService:
    try:
        return await platform_service_handler.get_one(id)
    except PlatFormServiceNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

@platform_service_router.get('/{id}/logs', response_class=PlainTextResponse)
async def get_logs(platform_service_handler: PLATFORM_SERVICE_HANDLER, id: str, limit: int) -> str:
    try:
        return await platform_service_handler.get_logs(id, limit)
    except PlatFormServiceNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

