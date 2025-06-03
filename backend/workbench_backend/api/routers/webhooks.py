import json
import logging
import re
from typing import Annotated, Any, Dict, Optional

from aiodocker import Docker
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel

from ...app.config import config
from ...cache.redis import cache as redis_cache
from ...crud.schemas.app import AppCRUD
from ...crud.schemas.user import UserCreateSchema, UserCRUD
from ...dependencies.crud import with_standalone_session
from ...dependencies.util import SESSION_MANAGER
from ...docker.utils import (
    connect_container_to_networks,
    setup_container_routing,
    setup_environ,
    setup_volumes,
)

router = APIRouter(prefix='/webhooks', tags=['Webhooks'])

USER_CRUD = Annotated[UserCRUD, Depends(with_standalone_session(UserCRUD))]
APP_CRUD = Annotated[AppCRUD, Depends(with_standalone_session(AppCRUD))]

class IdpEvent(BaseModel):
    type: str
    realmId: str
    time: Optional[int] = None
    clientId: Optional[str] = None
    userId: Optional[str] = None
    ipAddress: Optional[str] = None
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    resourcePath: Optional[str] = None
    representation: Optional[str] = None

@router.post('/idp')
async def idp(event: IdpEvent, user_crud: USER_CRUD) -> Response:
    match event.type:
        case 'USER-CREATE':
            await _handle_user_create(event, user_crud)
        case 'USER-DELETE':
            await _handle_user_delete(event, user_crud)
        case _:
            logging.debug(f"Idp webhook event: {event}")
    return Response(status_code=201)


def check_secret(request: Request) -> None:
        secret = request.headers.get('X-Webhook-Secret')
        if secret != config.WEBHOOK_SECRET:
            raise HTTPException(status_code=403,detail="Invalid secret")


@router.post('/run_init_script', dependencies=[Depends(check_secret)])
async def run_init_script(
    user_crud: USER_CRUD,
    app_crud: APP_CRUD,
    username: str,
    script_name: str,
    version: str = "latest"
) -> Response:
    user = (await user_crud.read_by_field('username', username))[0]

    if not user:
        raise HTTPException(status_code=404,detail=f"User not found {username}")

    with app_crud.with_user(user) as ac:
        if version == 'latest':
            app = await ac.read_latest(script_name)
        else:
            apps = await ac.read_by_field('name', script_name)
            app = None
            for a in apps:
                if a.release.name == version:
                    app = a
                    break
    if not app:
        raise HTTPException(status_code=404,detail=f"Not found script {script_name}")

    if not app.ready:
        raise HTTPException(status_code=500, detail="Image is not ready yet")

    async with Docker() as client:
        config = app.app_config.create_container_config(
                app.release.docker_image,
                "",
                "apps-network",
                ""
            ).hostname(f"{app.name}-webhook-runner").tty(False)

        config = setup_volumes(config, user, app)
        config = setup_environ(config, user, app)

        container = await client.containers.create_or_replace(
                f"{app.name}-{app.release.name}-webhook-runner",
                config
            )
        if app.workbench_config.networks:
            await connect_container_to_networks(container, user, app.workbench_config.networks)
        await container.start()
        await setup_container_routing(container.id)
        exit_code = (await container.wait()).get('StatusCode', -1)

        if exit_code != 0:
            raise HTTPException(status_code=500,detail=f"Script exited with exit code {exit_code}")

        return Response(status_code=200)


def format_string_to_named_regex(fmt: str) -> str:
    pattern = ''
    i = 0
    while i < len(fmt):
        if fmt[i] == '{':
            j = fmt.index('}', i)
            varname = fmt[i+1:j]
            pattern += f'(?P<{varname}>[^.]+)'
            i = j + 1
        else:
            # Escape special regex characters
            if fmt[i] in r".^$*+?{}[]\|()":
                pattern += '\\' + fmt[i]
            else:
                pattern += fmt[i]
            i += 1
    return '^' + pattern + '$'

PROXY_REGEX = re.compile(format_string_to_named_regex(config.PROXY_TEMPLATE))

@router.get('/proxy_auth')
async def proxy_auth(
    session_manager: SESSION_MANAGER,
    x_forwarded_user: Annotated[str | None, Header()] = None,
    x_forwarded_host: Annotated[str | None, Header()] = None
) -> Response:
    # headers are put to the request to traefik, by the time the request gets here traefik has authenticated it
    if not x_forwarded_host:
        return Response(status_code=400)

    result = PROXY_REGEX.match(x_forwarded_host)
    proxy_hash = result.group('hash') if result else None
    if not result or not proxy_hash:
        return Response(status_code=400)

    if not x_forwarded_user:
        return Response(status_code=401)

    from_cache = await redis_cache.get(proxy_hash)
    if from_cache is not None:
        if from_cache == x_forwarded_user:
            return Response(status_code=200)
        else:
            return Response(status_code=403)

    open_session = await session_manager.get_session_by_proxy_hash(proxy_hash)
    if not open_session:
        return Response(status_code=403)

    logging.debug(f"Session: {open_session}")
    logging.debug(f"Proxy hash: {proxy_hash}")
    logging.debug(f"X-Forwarded-Host: {x_forwarded_host}")
    logging.debug(f"X-Forwarded-User: {x_forwarded_user}")

    if 'user_email' in open_session and open_session['user_email'] == x_forwarded_user:
        await redis_cache.set(proxy_hash, x_forwarded_user)
        return Response(status_code=200)
    else:
        return Response(status_code=403)


async def _handle_user_create(event: IdpEvent, user_crud: UserCRUD) -> None:
    if not event.userId or not event.representation or not event.resourcePath:
        raise HTTPException(400,detail="Invalid event data")
    logging.info(f"Creating user from event: {event}")
    repr = json.loads(event.representation)
    user_id = event.resourcePath.split('/')[1]
    username = repr.get('username')
    email = repr.get('email')
    await user_crud.create(UserCreateSchema(id=user_id, username=username, email=email))

async def _handle_user_delete(event: IdpEvent, user_crud: UserCRUD) -> None:
    if not event.resourcePath:
        raise HTTPException(400, detail="Invalid event data")
    logging.info(f"Deleting user from event: {event}")
    user_id = event.resourcePath.split('/')[1]
    user = await user_crud.read_by_id(user_id)
    await user_crud.delete(user)
