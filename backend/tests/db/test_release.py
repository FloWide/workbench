import uuid
from typing import AsyncGenerator, Tuple

import pytest
import pytest_asyncio

from workbench_backend.db.models import Release, Repository, User
from workbench_backend.db.session import session

from .util import random_string


@pytest_asyncio.fixture
async def test_data() -> AsyncGenerator[Tuple[User, Repository, Release], None]:
    user = User(id=uuid.uuid4(), username=random_string(), email=random_string())
    session.add(user)
    await session.commit()
    await session.refresh(user)

    repo = Repository(name=random_string(), owner_id=user.id)
    session.add(repo)
    await session.commit()
    await session.refresh(repo)

    release = Release(name=random_string(), git_tag=random_string(), repo_id=repo.id, owner_id=user.id)
    session.add(release)
    await session.commit()
    await session.refresh(release)

    yield user, repo, release

    await session.delete(release)
    await session.delete(repo)
    await session.delete(user)
    await session.commit()

@pytest.mark.asyncio
async def test_release(test_data: Tuple[User, Repository, Release]) -> None:
    user, repo, release = test_data
    await session.refresh(user)
    await session.refresh(repo)
    await session.refresh(release)
    assert user.id == repo.owner_id
    assert repo.id == release.repo_id
    assert user.id == release.owner_id
    assert user.owned_releases[0].id == release.id
