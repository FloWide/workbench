from typing import Self

from overrides import override
from pydantic import UUID4, BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...db.models.user import User
from ..base import CRUD


class UserResponseSchema(BaseModel):
    id: UUID4
    username: str
    email: str

class UserUpdateSchema(BaseModel):
    pass

class UserCreateSchema(UserResponseSchema):
    username: str
    email: str

class UserCRUD(CRUD[User, UserCreateSchema, UserCreateSchema, UserUpdateSchema]):

    @classmethod
    @override
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        return cls(User, session, is_admin)
