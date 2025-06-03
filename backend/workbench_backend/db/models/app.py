from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...workbench_config.model import AppConfig
from .base import Base
from .mixins import CreatedAtMixin, UserOwnedMixin, UserSharedMixin, WithWorkbenchConfig

if TYPE_CHECKING:
    from .release import Release


class App(
    Base,
    CreatedAtMixin,
    WithWorkbenchConfig,
    UserOwnedMixin['owned_apps','App'], # type: ignore
    UserSharedMixin['shared_apps','App'] # type: ignore
):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String)

    ready: Mapped[bool] = mapped_column(default=False)

    release_id: Mapped[int] = mapped_column(ForeignKey('release.id'))
    release: Mapped['Release'] = relationship(back_populates='apps', lazy='joined', join_depth=2)

    app_icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)


    @property
    def app_config(self) -> AppConfig:
        return self.workbench_config.apps[self.name]

    @property
    def traefik_name(self) -> str:
        return f"{self.owner.username.replace('.','-')}{self.name.replace('.','-')}{self.release.name.replace('.','-')}"
