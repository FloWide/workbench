from typing import Annotated, AsyncIterator, TypeAlias

from fastapi import Depends
from fastapi.responses import PlainTextResponse

from ....crud.crud_router import UserSharedCRUDRouter
from ....crud.schemas.service import (
    ServiceCreateSchema,
    ServiceCRUD,
    ServiceResponseSchema,
    ServiceUpdateSchema,
)
from ....db.models.mixins import ReadWriteEnum
from ....db.models.service import Service
from ....dependencies.auth import GET_USER
from ....dependencies.crud import create_crud_dependency_with_user
from .platform_service import platform_service_router
from .service_handler import ServiceHandler

router = UserSharedCRUDRouter(
    prefix="/service",
    tags=['Service'],
    response_schema=ServiceResponseSchema,
    create_schema=ServiceCreateSchema,
    update_schema=ServiceUpdateSchema,
    get_crud=create_crud_dependency_with_user(ServiceCRUD),
    disable_methods=['CREATE','DELETE','UPDATE'],
    subrouters=[platform_service_router]
)

CRUD: TypeAlias = Annotated[ServiceCRUD, Depends(create_crud_dependency_with_user(ServiceCRUD))]
BY_ID_WRITE: TypeAlias = Annotated[Service, Depends(router.create_read_by_id_check_permission_dependency(ReadWriteEnum.WRITE))]
BY_ID_READ: TypeAlias = Annotated[Service, Depends(router.create_read_by_id_check_permission_dependency(ReadWriteEnum.READ))]

async def get_service_handler(service: BY_ID_WRITE, crud: CRUD, user: GET_USER) -> AsyncIterator[ServiceHandler]:
    try:
        handler = ServiceHandler(service, crud, user)
        await handler.init()
        yield handler
    finally:
        await handler.close()

SERVICE_HANDLER: TypeAlias = Annotated[ServiceHandler, Depends(get_service_handler)]

@router.post('/{id}/enable')
async def enable_service(handler: SERVICE_HANDLER) -> ServiceResponseSchema:
    await handler.set_enabled(True)
    return ServiceResponseSchema.model_validate(handler.service, from_attributes=True)

@router.post('/{id}/disable')
async def disable_service(handler: SERVICE_HANDLER) -> ServiceResponseSchema:
    await handler.set_enabled(False)
    return ServiceResponseSchema.model_validate(handler.service, from_attributes=True)

@router.post('/{id}/restart')
async def restart_service(handler: SERVICE_HANDLER) -> ServiceResponseSchema:
    await handler.restart()
    return ServiceResponseSchema.model_validate(handler.service, from_attributes=True)

@router.get('/{id}/logs', response_class=PlainTextResponse)
async def get_service_logs(service: BY_ID_READ, crud: CRUD,user: GET_USER,limit: int = 200, ) -> str:
    try:
        handler = ServiceHandler(service, crud, user)
        await handler.init()
        return await handler.get_logs(limit)
    finally:
        await handler.close()
