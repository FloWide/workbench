from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .mixins import CreatedAtMixin, UserOwnedMixin, UserSharedMixin

if TYPE_CHECKING:
    from .app import App
    from .repository import Repository
    from .service import Service

class Release(
    Base,
    CreatedAtMixin,
    UserOwnedMixin['owned_releases','Release'], # type: ignore
    UserSharedMixin['shared_releases', 'Release'] # type: ignore
):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    git_tag: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)

    repo_id: Mapped[int] = mapped_column(ForeignKey('repository.id'), index=True)
    repository: Mapped['Repository'] = relationship(back_populates='releases')

    apps: Mapped[List['App']] = relationship(back_populates='release', lazy='selectin', cascade="all, delete-orphan")
    services: Mapped[List['Service']] = relationship(back_populates='release', lazy='selectin', cascade="all, delete-orphan")

    @property
    def docker_image(self) -> str:
        return f'release:{self.id}'
