import logging
import sys
from typing import (
    Annotated,
    Awaitable,
    Callable,
    List,
    Literal,
    Optional,
    TypeAlias,
    overload,
)

import httpx
from fastapi import Depends, HTTPException, Request, Security, WebSocket
from fastapi.security import OpenIdConnect
from jose import JWTError, jwt
from jose.constants import ALGORITHMS

from ..app.config import config
from ..crud.exceptions import DBNotFoundException
from ..crud.schemas.user import UserCreateSchema, UserCRUD
from ..db.models.user import User
from ..db.session import session

try:
    resp = httpx.get(config.KEYCLOAK_REALM_URL)
    key = resp.json()["public_key"]
except Exception as e:
    logging.error("Couldn't get keycloak public key", exc_info=e)
    sys.exit(1)

PUBLIC_KEY = f"-----BEGIN PUBLIC KEY-----\r\n{key}\r\n-----END PUBLIC KEY-----"

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=401,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


class Oauth2BearerToken(OpenIdConnect):

    def __init__(
        self,
        *,
        openIdConnectUrl: str,
        scheme_name: str | None = None,
        description: str | None = None
    ):
        super().__init__(
            openIdConnectUrl=openIdConnectUrl,
            scheme_name=scheme_name,
            description=description,
            auto_error=False,
        )

    @overload
    async def __call__(self, request: Request, websocket: None = None) -> str:
        ...

    @overload
    async def __call__(self, request: None, websocket: WebSocket) -> str:
        ...

    # either request or websocket is always passed
    async def __call__(self, request:Request = None, websocket: WebSocket = None) -> str: # type: ignore
        req = request or websocket
        scheme, _, token = req.headers.get('Authorization','').partition(' ')
        if token:
            return token
        token = req.cookies.get("token") or req.query_params.get("token") # type: ignore
        if not token:
            raise CREDENTIALS_EXCEPTION
        return token


oauth2_scheme = Oauth2BearerToken(openIdConnectUrl=config.KEYCLOAK_OIDC_URL)

ACCESS_TOKEN: TypeAlias = Annotated[str, Security(oauth2_scheme)]


async def get_user_crud() -> UserCRUD:
    return UserCRUD.make_instance(session)


async def get_user(
    token: ACCESS_TOKEN, user_crud: Annotated[UserCRUD, Depends(get_user_crud)]
) -> User:
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=[ALGORITHMS.RS256],
            options={"verify_signature": True, "verify_aud": False, "exp": True},
        )
        id: Optional[str] = payload.get("sub")
        if not id:
            raise CREDENTIALS_EXCEPTION
        try:
            user = await user_crud.read_by_id(id)
        except DBNotFoundException:
            username = payload.get("preferred_username")
            email = payload.get("email")
            user = await user_crud.create(
                UserCreateSchema(id=id, username=username, email=email)
            )
        token_roles: List[str] = (
                payload.get("resource_access", {})
                .get("workbench-api", {})
                .get("roles", [])
            )
        user.permissions = token_roles
        user.token = token
        return user
    except JWTError as e:
        logging.warning("JWT validation error", exc_info=e)
        raise CREDENTIALS_EXCEPTION from e


GET_USER: TypeAlias = Annotated[User, Depends(get_user)]


def check_roles(roles: List[str]) -> Callable[..., Awaitable[Literal[True]]]:
    async def check(
        user: Annotated[User, Security(get_user, scopes=roles)]
    ) -> Literal[True]:
        try:
            for role in roles:
                if role not in user.permissions:
                    raise HTTPException(
                        status_code=403, detail="Missing required roles"
                    )
            return True
        except JWTError as e:
            logging.warning("JWT validation error", exc_info=e)
            raise CREDENTIALS_EXCEPTION from e

    return check
