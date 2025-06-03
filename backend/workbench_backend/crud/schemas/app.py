from typing import Any, Dict, Optional, Self

from overrides import override
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...db.models.app import App
from ...workbench_config.model import AppConfig
from ..base import UserOwnedModelCreateBase, UserSharedCrud
from .mixins import CreatedAtSchemaMixin, LatestCRUDMixin, UserOwnedSchemaMixin
from .release import ReleaseResponseSchema


class AppResponseSchema(BaseModel, CreatedAtSchemaMixin, UserOwnedSchemaMixin):
    id: int
    name: str
    ready: bool

    release_id: int
    release: ReleaseResponseSchema

    app_config: AppConfig

class AppCreateSchema(BaseModel):
    name: str
    release_id: int
    workbench_config_json: Dict[str, Any]
    app_icon: Optional[str] = None


class AppModelCreateSchema(AppCreateSchema, UserOwnedModelCreateBase):
    pass

class AppUpdateSchema(BaseModel):
    ready: Optional[bool] = None


class AppCRUD(UserSharedCrud[App, AppModelCreateSchema, AppCreateSchema, AppUpdateSchema], LatestCRUDMixin[App]):

    @classmethod
    @override
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        return cls(App, session, AppModelCreateSchema, is_admin=is_admin)


