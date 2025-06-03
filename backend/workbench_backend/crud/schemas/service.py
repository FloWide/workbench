import datetime
from typing import Any, Dict, Optional, Self

from overrides import override
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession, async_scoped_session

from ...db.models.service import Service, ServiceStatusEnum
from ...workbench_config.model import ServiceConfig
from ..base import UserOwnedModelCreateBase, UserSharedCrud
from .mixins import CreatedAtSchemaMixin, LatestCRUDMixin, UserOwnedSchemaMixin
from .release import ReleaseResponseSchema


class ServiceResponseSchema(BaseModel, CreatedAtSchemaMixin, UserOwnedSchemaMixin):
    id: int
    name: str
    ready: bool
    enabled: bool
    started_at: Optional[datetime.datetime] = None
    status: ServiceStatusEnum
    proxied_url: Optional[str] = None

    release_id: int
    release: ReleaseResponseSchema

    service_config: ServiceConfig

class ServiceCreateSchema(BaseModel):
    name: str
    release_id: int
    workbench_config_json: Dict[str, Any]


class ServiceModelCreateSchema(ServiceCreateSchema, UserOwnedModelCreateBase):
    pass

class ServiceUpdateSchema(BaseModel):
    ready: Optional[bool] = None
    enabled: Optional[bool] = None
    started_at: Optional[datetime.datetime] = None
    status: Optional[ServiceStatusEnum] = None
    proxied_url: Optional[str] = None


class ServiceCRUD(UserSharedCrud[Service, ServiceModelCreateSchema, ServiceCreateSchema, ServiceUpdateSchema], LatestCRUDMixin[Service]):

    @classmethod
    @override
    def make_instance(cls, session: AsyncSession | async_scoped_session[AsyncSession], is_admin: bool = False) -> Self:
        return cls(Service, session, ServiceModelCreateSchema, is_admin)

    async def read_latest_running(self, name: str) -> Optional[Service]:
        query = (self.query()
            .where(
                and_(
                    self.model.name == name,
                    self.model.status == ServiceStatusEnum.ACTIVE,
                    self.model.enabled == True  # noqa: E712
                )
            )
            .order_by(
                self.model.created_at.desc())
        )
        return (await self.session.execute(query)).scalars().first()


