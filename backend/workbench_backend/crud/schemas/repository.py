from typing import Self

from overrides import override
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...celery_tasks.tasks.repository_tasks import init_repo_template
from ...db.models.repository import Repository
from ...git import AsyncGitRepository
from ...templates.repository import TEMPLATE_TYPES
from ..base import UserOwnedModelCreateBase, UserSharedCrud
from .mixins import CreatedAtSchemaMixin, UserOwnedSchemaMixin


class RepositoryResponseSchema(BaseModel, CreatedAtSchemaMixin, UserOwnedSchemaMixin):
    id: int
    name: str
    ready: bool

class RepositoryUpdateSchema(BaseModel):
    name: str

class RepositoryCreateSchema(RepositoryUpdateSchema):
    template: TEMPLATE_TYPES = 'streamlit'

class RepositoryModelCreateSchema(RepositoryUpdateSchema, UserOwnedModelCreateBase):
    pass


class RepositoryCRUD(UserSharedCrud[Repository, RepositoryModelCreateSchema, RepositoryCreateSchema, RepositoryUpdateSchema]):

    @classmethod
    @override
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        return cls(Repository, session, RepositoryModelCreateSchema, is_admin=is_admin)

    @override
    async def on_create(self, obj: Repository, create_args: RepositoryCreateSchema) -> None:
        await AsyncGitRepository.init_repository(
            obj.path()
        )
        init_repo_template.delay(obj.id, create_args.template)
        return await super().on_create(obj, create_args)

    @override
    async def on_delete(self, obj: Repository) -> None:
        repo = await obj.get_git_repo()
        await repo.remove_repository()
        return await super().on_delete(obj)
