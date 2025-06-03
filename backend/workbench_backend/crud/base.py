from abc import ABC, abstractmethod
from contextlib import contextmanager
from typing import (
    Any,
    Dict,
    Generic,
    Iterator,
    Optional,
    Self,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    cast,
)

from fastapi.encoders import jsonable_encoder
from overrides import override
from pydantic import UUID4, BaseModel
from sqlalchemy import Select, Table, and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ..db.models.base import Base
from ..db.models.mixins import ReadWriteEnum
from ..db.models.user import User
from .exceptions import (
    DBDuplicateElementException,
    DBNotFoundException,
    InvalidAccess,
    UserNotSetException,
)

ModelType = TypeVar('ModelType', bound=Base)
ModelCreateArgs = TypeVar('ModelCreateArgs', bound=BaseModel)
CreateSchemaType = TypeVar('CreateSchemaType', bound=BaseModel)
UpdateSchemaType = TypeVar('UpdateSchemaType', bound=BaseModel | None)

#TODO: FIX Transactions
class CRUD(ABC, Generic[ModelType, ModelCreateArgs,CreateSchemaType, UpdateSchemaType]):

    def __init__(self,
        model: Type[ModelType],
        session: AsyncSession | async_scoped_session[AsyncSession],
        is_admin: bool = False
    ) -> None:
        self.model = model
        self.session = session
        self.is_admin = is_admin

    @classmethod
    @abstractmethod
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        pass

    def _create_object(self, data: ModelCreateArgs) -> ModelType:
        return self.model(**data.model_dump())

    async def _update_object(self, obj: ModelType, data: UpdateSchemaType) -> ModelType:
        obj_keys = obj.__table__.columns.keys()
        update_data = jsonable_encoder(data, exclude_unset=True)
        for field in obj_keys:
            if field in update_data:
                setattr(obj,field, getattr(data, field))
        return obj

    def to_model_create_args(self, args: CreateSchemaType) -> ModelCreateArgs:
        return cast(ModelCreateArgs, args)

    async def create(self, args: CreateSchemaType) -> ModelType:
        try:
            db_obj = self._create_object(self.to_model_create_args(args))
            self.session.add(db_obj)
            await self.session.commit()
            await self.session.refresh(db_obj)
            await self.on_create(db_obj, args)
            return db_obj
        except IntegrityError as e:
            await self.session.rollback()
            conflict = DBDuplicateElementException.from_integrity_error(self.model.__name__, e)
            if not conflict:
                raise e
            raise conflict from e
        except Exception as e:
            await self.session.rollback()
            raise e

    async def read_by_id(self, id: Any) -> ModelType:
        query = self.query().where(self.model.id == id)
        result = (await self.session.execute(query)).scalars().first()
        if not result:
            raise DBNotFoundException(self.model.__name__, id)
        return result

    async def read_by_field(self, field: str, value: Any, offset: int = 0, limit: int = 100) -> Sequence[ModelType]:
        if hasattr(self.model, field):
            stmt = self.query().where(getattr(self.model, field) == value)
        else:
            stmt = self.query()
        stmt = stmt.offset(offset).limit(limit)
        return (await self.session.execute(stmt)).scalars().all()

    async def read_by_fields(self, fields: Dict[str, Any], offset: int = 0, limit: int = 100) -> Sequence[ModelType]:
        stmt = self.query().offset(offset).limit(limit)
        for field, value in fields.items():
            if hasattr(self.model, field):
                python_type = getattr(self.model.__table__.c,field).type.python_type
                stmt = stmt.where(getattr(self.model, field) == python_type(value))
        return (await self.session.execute(stmt)).scalars().all()

    async def read_multiple(self, offset: int = 0, limit: int = 100) -> Sequence[ModelType]:
        query = self.query().offset(offset).limit(limit)
        return (await self.session.execute(query)).scalars().all()

    async def read_all(self) -> Sequence[ModelType]:
        return (await self.session.execute(self.query())).scalars().all()

    async def update(self, obj: ModelType, args: UpdateSchemaType) -> ModelType:
        obj = await self._update_object(obj, args)
        try:
            self.session.add(obj)
            await self.session.commit()
            await self.session.refresh(obj)
            await self.on_update(obj, args)
            return obj
        except IntegrityError as e:
            await self.session.rollback()
            conflict = DBDuplicateElementException.from_integrity_error(self.model.__name__, e)
            if not conflict:
                raise e
            raise conflict from e
        except Exception as e:
            await self.session.rollback()
            raise e

    async def delete(self, obj: ModelType) -> None:
        try:
            await self.session.delete(obj)
            await self.session.commit()
            await self.on_delete(obj)
        except Exception as e:
            await self.session.rollback()
            raise e

    def query(self) -> Select[Tuple[ModelType]]:
        return select(self.model)

    async def on_create(self, obj: ModelType, create_args: CreateSchemaType) -> None:
        pass

    async def on_update(self, obj: ModelType, update_args: UpdateSchemaType) -> None:
        pass

    async def on_delete(self, obj: ModelType) -> None:
        pass


class UserOwnedModelCreateBase(BaseModel):
    owner_id: UUID4

UserOwnedModelCreateArgs = TypeVar('UserOwnedModelCreateArgs', bound=UserOwnedModelCreateBase)

# python lacks intersection types but here 'ModelType' should be a subclass of both 'Base' AND 'UserOwnedMixin'
# 'UserOwnedMixin' also cannot be a subclass of 'Base' because it's not a database table
class UserOwnedCrud(CRUD[ModelType, UserOwnedModelCreateArgs,CreateSchemaType, UpdateSchemaType]):

    def __init__(
        self,
        model: type[ModelType],
        session: AsyncSession | async_scoped_session[AsyncSession],
        model_create_args_type: Type[UserOwnedModelCreateArgs],
        is_admin: bool = False,
    ) -> None:
        super().__init__(model, session, is_admin)
        self.user: Optional[User] = None
        self.model_create_args_type = model_create_args_type

    @override
    def query(self) -> Select[Tuple[ModelType]]:
        if self.is_admin:
            return super().query()
        if self.user is None:
            raise UserNotSetException('User is not set for this query')

        return super().query().where(self.model.owner_id == self.user.id) # type: ignore

    @contextmanager
    def with_user(self,user: User) -> Iterator[Self]:
        try:
            self.user = user
            yield self
        finally:
            self.user = None

    @override
    def to_model_create_args(self, args: CreateSchemaType) -> UserOwnedModelCreateArgs:
        if self.user is None:
            raise UserNotSetException('User is not set for this query')

        return self.model_create_args_type(owner_id=self.user.id, **args.model_dump())

# Same as with UserOwnedCrud. 'ModelType' should be a subclass of 'Base', 'UserOwnedMixin' AND 'UserSharedMixin'
# Only models that are owned by users can be shared
class UserSharedCrud(UserOwnedCrud[ModelType, UserOwnedModelCreateArgs, CreateSchemaType, UpdateSchemaType]):

    @override
    def query(self) -> Select[Tuple[ModelType]]:
        if self.is_admin:
            return super().query()

        if self.user is None:
            raise UserNotSetException('User is not set for this query')
        link_table = self.model.link_table() # type: ignore
        return select(self.model).join(link_table, isouter=True).where(
            or_(
                link_table.c.user_id == self.user.id,
                self.model.owner_id == self.user.id # type: ignore
            )
        )

    async def share(self, obj: ModelType, to_user: User, rw: ReadWriteEnum = ReadWriteEnum.READ) -> ModelType:
        link_table: Table = self.model.link_table() # type: ignore
        model_table_name = self.model.__tablename__
        await self.session.refresh(obj, attribute_names=['id'])
        await self.session.refresh(to_user, attribute_names=['id'])
        stmt = link_table.insert().values(
            **{
                f'{model_table_name}_id':obj.id,
                'user_id':to_user.id,
                'rw':rw
            }
        )
        await self.session.execute(stmt)
        await self.session.refresh(obj)
        await self.session.refresh(to_user)
        await self.session.commit()
        return obj

    async def share_info(self, obj: ModelType) -> Dict[UUID4, ReadWriteEnum]:
        link_table: Table = self.model.link_table() # type: ignore
        model_table_name = self.model.__tablename__
        stmt = select(link_table.c.user_id, link_table.c.rw).where(
            link_table.c.get(f'{model_table_name}_id') == obj.id
        )
        result = await self.session.execute(stmt)
        return {row.user_id: row.rw for row in result.fetchall()}

    async def delete_share(self, obj: ModelType, to_user: User) -> None:
        link_table: Table = self.model.link_table() # type: ignore
        model_table_name = self.model.__tablename__
        stmt = link_table.delete().where(
            and_(
                link_table.c.get(f'{model_table_name}_id') == obj.id,
                link_table.c.user_id == to_user.id
            )
        )
        await self.session.execute(stmt)
        await self.session.commit()

    async def update(self, obj: ModelType, args: UpdateSchemaType) -> ModelType:
        if self.is_admin:
            return await super().update(obj, args)
        if self.user is None:
            raise UserNotSetException('User is not set for this query')

        access = await self.get_rw_access(obj)
        if access != ReadWriteEnum.WRITE:
            raise InvalidAccess(f'No WRITE access for the given {self.model.__name__} ')

        return await super().update(obj, args)

    async def delete(self, obj: ModelType) -> None:
        if self.is_admin:
            return await super().delete(obj)
        if self.user is None:
            raise UserNotSetException('User is not set for this query')

        access = await self.get_rw_access(obj)
        if access != ReadWriteEnum.WRITE:
            raise InvalidAccess(f'No WRITE access for the given {self.model.__name__} ')

        return await super().delete(obj)

    async def get_rw_access(self, obj: ModelType) -> ReadWriteEnum | None:
        if self.is_admin:
            return ReadWriteEnum.WRITE

        if self.user is None:
            raise UserNotSetException('User is not set for this query')

        if obj.owner_id == self.user.id: # type: ignore
            return ReadWriteEnum.WRITE

        link_table: Table = self.model.link_table() # type: ignore
        model_table_name = self.model.__tablename__
        stmt = select(link_table.c.rw).where(
            and_(
                link_table.c.user_id == self.user.id,
                link_table.c.get(f'{model_table_name}_id') == obj.id
            )
        )
        return (await self.session.execute(stmt)).scalars().first()
