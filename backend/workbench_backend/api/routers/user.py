from typing import Any, List

from fastapi import APIRouter, Depends

from ...crud.schemas.user import UserCRUD, UserResponseSchema
from ...db.session import session
from ...dependencies.auth import GET_USER, get_user

user_crud = UserCRUD.make_instance(session)

router = APIRouter(
    prefix='/user',
    tags=["User"],
    dependencies=[Depends(get_user)]
)


@router.get('', response_model=List[UserResponseSchema])
async def get_all_users(offset: int = 0, limit: int = 100) -> Any:
    return await user_crud.read_multiple(offset, limit)

@router.get('/me', response_model=UserResponseSchema)
async def get_me(user: GET_USER) -> Any:
    return user
