import asyncio
import logging
from pathlib import Path
from typing import Annotated, Any, TypeAlias, cast

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Response,
    UploadFile,
    WebSocket,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse

from ....crud.crud_router import UserSharedCRUDRouter
from ....crud.schemas.repository import (
    RepositoryCreateSchema,
    RepositoryCRUD,
    RepositoryResponseSchema,
    RepositoryUpdateSchema,
)
from ....db.models.mixins import ReadWriteEnum
from ....db.models.repository import Repository
from ....dependencies.auth import GET_USER
from ....dependencies.crud import create_crud_dependency_with_user
from ....dependencies.util import SESSION_MANAGER
from ....git.editable_repository import AsyncFileLike
from .edit_handler import EditorRpc

router = UserSharedCRUDRouter(
    prefix="/repo",
    tags=['Repository'],
    response_schema=RepositoryResponseSchema,
    create_schema=RepositoryCreateSchema,
    update_schema=RepositoryUpdateSchema,
    get_crud=create_crud_dependency_with_user(RepositoryCRUD),
    # dependencies=[Security(check_roles(['repo']))]
)

BY_ID_WRITE: TypeAlias = Annotated[Repository, Depends(router.create_read_by_id_check_permission_dependency(ReadWriteEnum.WRITE))]
BY_ID_READ: TypeAlias = Annotated[Repository, Depends(router.create_read_by_id_check_permission_dependency(ReadWriteEnum.READ))]


@router.get('/{id}/content/{path:path}')
async def get_file_content(
    repo: BY_ID_READ,
    path: str
) -> FileResponse:
    git_repo = await repo.get_git_repo()
    full_path = Path(git_repo.root_path) / path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path)

@router.post('/{id}/content/{path:path}')
async def upload_file(
    repo: BY_ID_WRITE,
    path: str,
    file: UploadFile
) -> Response:
    edit_repo = await repo.get_editable_repo()
    full_path = Path(edit_repo.root_path) / path

    if full_path.exists():
        raise HTTPException(status_code=409, detail="File already exists")

    await edit_repo.create_file(
        path,
        cast(AsyncFileLike[bytes], file),
    )
    return Response(status_code=201)



@router.websocket('/{id}/edit')
async def edit_websocket(
    ws: WebSocket,
    repo: BY_ID_WRITE,
    user: GET_USER,
    session_manager: SESSION_MANAGER
) -> None:
    await ws.accept()
    session_id = await session_manager.start_session(user.email)
    edit_rpc = EditorRpc(session_manager, session_id, repo,user)
    try:
        async def sender() -> None:
            try:
                async for data in edit_rpc:
                    try:
                        await ws.send_json(jsonable_encoder(data, exclude_none=True))
                    except Exception as e:
                        logging.error("Edit websocket send error: ", exc_info=e)
                        continue
            except asyncio.CancelledError:
                return
        sender_task = asyncio.create_task(sender())
        await edit_rpc.init()
        async for message in ws.iter_text():
            await edit_rpc.dispatch(message)
    finally:
        logging.info("Closing edit session")
        await session_manager.end_session(session_id)
        sender_task.cancel()
        await sender_task
        await edit_rpc.close()


git_router = APIRouter(
    prefix='/{id}/git',
    tags=['Git']
)

@git_router.get('/state')
async def get_state(repo: BY_ID_READ) -> Any:
    git_repo = await repo.get_git_repo()
    head_task = asyncio.create_task(git_repo.get_head_shorthand())
    tags_task = asyncio.create_task(git_repo.get_tags())
    branches_task = asyncio.create_task(git_repo.get_branches())
    status_task = asyncio.create_task(git_repo.status())

    head, tags, branches, status = await asyncio.gather(head_task, tags_task, branches_task, status_task)

    return {
        "head": head,
        "tags": tags,
        "branches": branches,
        "status": status,
    }

@git_router.get('/head')
async def get_head(repo: BY_ID_READ) -> Any:
    git_repo = await repo.get_git_repo()
    return await git_repo.get_head_shorthand()

@git_router.get('/branches')
async def get_branches(repo: BY_ID_READ) -> Any:
    git_repo = await repo.get_git_repo()
    return await git_repo.get_branches()

@git_router.get('/branches')
async def get_tags(repo: BY_ID_READ) -> Any:
    git_repo = await repo.get_git_repo()
    return await git_repo.get_tags()

@git_router.get('/status')
async def get_status(repo: BY_ID_READ) -> Any:
    git_repo = await repo.get_git_repo()
    return await git_repo.status()

@git_router.post('/commit')
async def commit(repo: BY_ID_WRITE, user: GET_USER, message: str = Body(embed=True)) -> Any:
    git_repo = await repo.get_git_repo()
    await git_repo.add_all()
    await git_repo.commit(user.username, user.email, message)
    return Response(status_code=201)
