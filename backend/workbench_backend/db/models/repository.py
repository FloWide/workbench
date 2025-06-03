from pathlib import Path
from typing import TYPE_CHECKING, List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...app.config import config
from ...git import AsyncGitRepository, EditableRepository
from .base import Base
from .mixins import CreatedAtMixin, UserOwnedMixin, UserSharedMixin

if TYPE_CHECKING:
    from .release import Release


class Repository(
    Base,
    CreatedAtMixin,
    UserOwnedMixin['owned_repositories','Repository'], # type: ignore
    UserSharedMixin['shared_repositories', 'Repository'] # type: ignore
):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String)

    releases: Mapped[List['Release']] = relationship(back_populates='repository', cascade="all, delete-orphan")

    ready: Mapped[bool] = mapped_column(default=False)

    def path(self) -> str:
        return str(Path(config.REPOSITORIES_ROOT) / f'{self.id}')

    async def get_git_repo(self) -> AsyncGitRepository:
        return await AsyncGitRepository.open_repository(
            self.path()
        )

    async def get_editable_repo(self) -> EditableRepository:
        return await EditableRepository.open_repository(self.path())

