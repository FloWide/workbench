import datetime
import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...workbench_config.model import ServiceConfig
from .base import Base
from .mixins import CreatedAtMixin, UserOwnedMixin, UserSharedMixin, WithWorkbenchConfig

if TYPE_CHECKING:
    from .release import Release


class ServiceStatusEnum(str, enum.Enum):
    INACTIVE = 'INACTIVE'
    ACTIVE = 'ACTIVE'

class Service(
    Base,
    CreatedAtMixin,
    WithWorkbenchConfig,
    UserOwnedMixin['owned_services','Service'], # type: ignore
    UserSharedMixin['shared_services','Service'] # type: ignore
):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String)

    enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    started_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=True)

    status: Mapped[ServiceStatusEnum] = mapped_column(Enum(ServiceStatusEnum), default=ServiceStatusEnum.INACTIVE)

    ready: Mapped[bool] = mapped_column(default=False)

    proxied_url: Mapped[str] = mapped_column(String, nullable=True)

    release_id: Mapped[int] = mapped_column(ForeignKey('release.id'))
    release: Mapped['Release'] = relationship(back_populates='services', lazy='joined', join_depth=2)

    @property
    def service_config(self) -> ServiceConfig:
        return self.workbench_config.services[self.name]

    @property
    def traefik_name(self) -> str:
        return f"{self.owner.username.replace('.','-')}{self.name.replace('.','-')}{self.release.name.replace('.','-')}"
