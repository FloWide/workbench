from typing import TYPE_CHECKING, ClassVar, List

from sqlalchemy import UUID, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

if TYPE_CHECKING:
    from .app import App
    from .release import Release
    from .repository import Repository
    from .service import Service


class User(Base):
    id: Mapped[UUID[str]] = mapped_column(UUID,primary_key=True, autoincrement=False)

    username: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    # these are added by mixins to the class dynamically and only here for type checking
    owned_repositories: ClassVar[List['Repository']]
    shared_repositories: ClassVar[List['Repository']]

    owned_releases: ClassVar[List['Release']]
    shared_releases: ClassVar[List['Release']]

    owned_apps: ClassVar[List['App']]
    shared_apps: ClassVar[List['App']]

    owned_services: ClassVar[List['Service']]
    shared_services: ClassVar[List['Service']]

    _permissions: List[str] = []

    _token: str = ''

    @property
    def permissions(self) -> List[str]:
        return self._permissions

    @permissions.setter
    def permissions(self, value: List[str]) -> None:
        self._permissions = value

    @property
    def token(self) -> str:
        return self._token

    @token.setter
    def token(self, value: str) -> None:
        self._token = value
