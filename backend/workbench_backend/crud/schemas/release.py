from contextlib import contextmanager
from typing import Iterator, Optional, Self, Type

from overrides import override
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...celery_tasks.tasks.release_tasks import create_releases
from ...db.models.release import Release
from ...db.models.user import User
from ..base import UserOwnedModelCreateBase, UserSharedCrud
from ..exceptions import CRUDException
from .mixins import CreatedAtSchemaMixin, UserOwnedSchemaMixin
from .repository import RepositoryCRUD


class ReleaseResponseSchema(BaseModel, CreatedAtSchemaMixin, UserOwnedSchemaMixin):
    id: int
    git_tag: str
    repo_id: int
    name: str

class ReleaseUpdateSchema(BaseModel):
    name: str

class ReleaseCreateSchema(ReleaseUpdateSchema):
    git_tag: str
    repo_id: int
    target_refish: Optional[str] = None


class ReleaseModelCreateSchema(ReleaseUpdateSchema, UserOwnedModelCreateBase):
    git_tag: str
    repo_id: int


class ReleaseCRUD(UserSharedCrud[Release, ReleaseModelCreateSchema, ReleaseCreateSchema, ReleaseUpdateSchema]):

    def __init__(self, model: Type[Release], session: AsyncSession | async_scoped_session[AsyncSession], model_create_args_type: type[ReleaseModelCreateSchema], is_admin: bool = False) -> None:
        super().__init__(model, session, model_create_args_type, is_admin)
        self._repo_crud = RepositoryCRUD.make_instance(session, is_admin)

    @contextmanager
    @override
    def with_user(self, user: User) -> Iterator[Self]:
        with (
                self._repo_crud.with_user(user),
                super().with_user(user) as me
            ):
            yield me

    @classmethod
    @override
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        return cls(Release, session, ReleaseModelCreateSchema, is_admin=is_admin)

    @override
    async def on_create(self, obj: Release, create_args: ReleaseCreateSchema) -> None:
        repo = await self._repo_crud.read_by_id(obj.repo_id)
        git_repo = await repo.get_git_repo()
        tag_exists = await git_repo.refish_exists(create_args.git_tag)

        if not tag_exists:
            if create_args.target_refish is None:
                raise CRUDException(f'Tag {create_args.git_tag} do not exists so target_refish cannot be null')
            else:
                target_exists = await git_repo.refish_exists(create_args.target_refish)
                if not target_exists:
                    raise CRUDException(f'Target {create_args.target_refish} do not exists')
        create_releases.delay(obj.id, obj.repo_id, obj.owner_id,git_tag=create_args.git_tag, target_refish=create_args.target_refish)
        return await super().on_create(obj, create_args)


