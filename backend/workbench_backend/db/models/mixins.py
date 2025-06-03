import datetime
import enum
from typing import Any, Dict, List, Tuple, Type

from sqlalchemy import JSON, UUID, Column, DateTime, Enum, ForeignKey, Table
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.sql import func

from ...workbench_config.model import WorkBenchConfig
from .base import Base
from .user import User


class CreatedAtMixin():
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=func.now())


class _UserOwnedMeta(type):
    def __getitem__(cls, args: Tuple[str,str]) -> Type[Any]:
        back_populates, table = args
        class Mixin:
            owner_id: Mapped[UUID[str]] = mapped_column(ForeignKey('user.id'), index=True)

            @declared_attr
            def owner(self) -> Mapped[User]:
                return relationship(back_populates=back_populates, lazy='selectin')

        setattr(User, back_populates, relationship(table, back_populates='owner', lazy='selectin'))
        return Mixin

class UserOwnedMixin(object, metaclass=_UserOwnedMeta):
    owner: User
    owner_id: Mapped[UUID[str]]

class ReadWriteEnum(enum.Enum):
    READ = 1
    WRITE = 2

class _UserSharedMeta(type):
    def __getitem__(cls, args: Tuple[str,str]) -> Type[Any]:
        back_populates, table = args
        ltable = table.lower()

        link_table = Table(
            f'user_{ltable}_share_link',
            Base.metadata,
            Column(f'{ltable}_id', ForeignKey(f'{ltable}.id'), primary_key=True, index=True),
            Column('user_id', ForeignKey('user.id'), primary_key=True, index=True),
            Column('rw', Enum(ReadWriteEnum), default=ReadWriteEnum.READ)
        )

        class Mixin:
            @declared_attr
            def shared_with(self) -> Mapped[List[User]]:
                return relationship(back_populates=back_populates, secondary=link_table, lazy='selectin')

            @classmethod
            def link_table(cls) -> Table:
                return link_table
        setattr(User, back_populates, relationship(table,back_populates='shared_with', secondary=link_table, lazy='selectin'))
        return Mixin

class UserSharedMixin(object, metaclass=_UserSharedMeta):
    shared_with: List[User]

    def link_table() -> Table: # type: ignore
        ...



class WithWorkbenchConfig():
    workbench_config_json: Mapped[Dict[str, Any]] = mapped_column(JSON)

    @property
    def workbench_config(self) -> WorkBenchConfig:
        return WorkBenchConfig.model_validate(self.workbench_config_json)
