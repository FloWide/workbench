
import asyncio
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException, WebSocket
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, RedirectResponse, Response

from ....crud.crud_router import UserSharedCRUDRouter
from ....crud.schemas.app import (
    AppCreateSchema,
    AppCRUD,
    AppResponseSchema,
    AppUpdateSchema,
)
from ....db.models.app import App
from ....db.models.mixins import ReadWriteEnum
from ....dependencies.auth import GET_USER
from ....dependencies.crud import create_crud_dependency_with_user
from ....dependencies.util import SESSION_MANAGER
from .runner_handler import AppRunnerRpc

router = UserSharedCRUDRouter(
    prefix="/app",
    tags=['App'],
    response_schema=AppResponseSchema,
    create_schema=AppCreateSchema,
    update_schema=AppUpdateSchema,
    get_crud=create_crud_dependency_with_user(AppCRUD),
    disable_methods=['CREATE','DELETE','UPDATE']
)


APP_BY_READ = Annotated[App, Depends(router.create_read_by_id_check_permission_dependency(ReadWriteEnum.READ))]

@router.get('/{id}/logo', responses={404: {"description": "Logo not found"}, 200: {"content": {"image/*": {}}},307: {"description": "Redirect to logo"}})
async def get_app_logo(
    app: APP_BY_READ
) -> Response:
    if (logo := app.app_icon) is None:
        raise HTTPException(status_code=404, detail="No logo found")

    if logo.startswith('http'):
        return RedirectResponse(logo)

    logo_path = Path(logo)

    if not logo_path.exists():
        raise HTTPException(status_code=404, detail="Logo not found")

    return FileResponse(logo_path)

@router.websocket('/{id}/run')
async def run_websocket(
    ws: WebSocket,
    app: APP_BY_READ,
    user: GET_USER,
    session_manager: SESSION_MANAGER
) -> None:
    await ws.accept()
    session_id = await session_manager.start_session(user.email)
    rpc = AppRunnerRpc(session_manager, session_id, app, user)
    try:
        async def sender() -> None:
            try:
                async for data in rpc:
                    try:
                        await ws.send_json(jsonable_encoder(data, exclude_none=True))
                    except Exception:
                        continue
            except asyncio.CancelledError:
                return
        sender_task = asyncio.create_task(sender())
        async for message in ws.iter_text():
            await rpc.dispatch(message)
    finally:
        await session_manager.end_session(session_id)
        sender_task.cancel()
        await sender_task
        await rpc.close()
