from typing import (
    Annotated,
    Any,
    AsyncGenerator,
    Awaitable,
    Callable,
    Type,
    TypeVar,
)

from fastapi import Depends

from ..crud.base import CRUD, UserOwnedCrud
from ..crud.schemas.user import UserCRUD
from ..db.session import session
from ..db.standalone_session import standalone_session
from .auth import GET_USER


async def get_user_crud() -> UserCRUD:
    return UserCRUD.make_instance(session)


UserCRUDDep = Annotated[UserCRUD, Depends(get_user_crud)]


CrudClassType = TypeVar("CrudClassType", bound=CRUD[Any, Any, Any, Any], covariant=True)


def create_crud_dependency(
    crudClass: Type[CrudClassType],
) -> Callable[[], Awaitable[CrudClassType]]:
    async def dep() -> CrudClassType:
        return crudClass.make_instance(session)

    return dep


UserOwnedCrudClassType = TypeVar(
    "UserOwnedCrudClassType", bound=UserOwnedCrud[Any, Any, Any, Any], covariant=True
)


def create_crud_dependency_with_user(
    crudClass: Type[UserOwnedCrudClassType],
) -> Callable[
    ..., AsyncGenerator[UserOwnedCrudClassType, None]
]:
    async def dep(
        user: GET_USER,
        crud: Annotated[
            UserOwnedCrudClassType, Depends(create_crud_dependency(crudClass))
        ],
    ) -> AsyncGenerator[UserOwnedCrudClassType, None]:
        with crud.with_user(user) as c:
            yield c

    return dep

def with_standalone_session(
    crudClass: Type[CrudClassType],
    **kwargs: Any,
) -> Callable[[], Awaitable[CrudClassType]]:
    async def dep() -> CrudClassType:
        async with standalone_session() as standalone:
            return crudClass.make_instance(standalone, **kwargs)

    return dep
