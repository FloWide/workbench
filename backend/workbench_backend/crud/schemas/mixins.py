import datetime
from abc import ABC, abstractmethod
from typing import Generic, Optional, Tuple, Type, TypeVar

from pydantic import UUID4
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...db.models.base import Base
from .user import UserResponseSchema


class CreatedAtSchemaMixin():
    created_at: datetime.datetime


class UserOwnedSchemaMixin():
    owner_id: UUID4
    owner: UserResponseSchema




ModelType = TypeVar('ModelType', bound=Base)

class LatestCRUDMixin(ABC, Generic[ModelType]):

    session: AsyncSession | async_scoped_session[AsyncSession]
    model: Type[ModelType]

    async def read_latest(self, name: str) -> Optional[ModelType]:
        query = self.query().where(self.model.name == name).order_by( # type: ignore
            self.model.created_at.desc() # type: ignore
        )
        return (await self.session.execute(query)).scalars().first()

    @abstractmethod
    def query(self) -> Select[Tuple[ModelType]]:
        pass
