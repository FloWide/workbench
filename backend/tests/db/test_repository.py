import uuid
from typing import AsyncGenerator, Tuple

import pytest
import pytest_asyncio
import sqlalchemy as sa

from workbench_backend.crud.schemas.repository import (
    RepositoryCreateSchema,
    RepositoryCRUD,
)
from workbench_backend.crud.schemas.user import UserCreateSchema, UserCRUD
from workbench_backend.db.models.repository import Repository
from workbench_backend.db.models.user import User
from workbench_backend.db.session import session

from .util import random_string

repo_crud = RepositoryCRUD.make_instance(session)
user_crud = UserCRUD.make_instance(session)

@pytest_asyncio.fixture()
async def test_data() -> AsyncGenerator[Tuple[User, Repository], None]:
    user = await user_crud.create(UserCreateSchema(id=uuid.uuid4(), username=random_string(), email=random_string()))

    with repo_crud.with_user(user) as c:
        repo = await c.create(RepositoryCreateSchema(name=random_string()))

    yield user, repo

    await repo_crud.delete(repo)
    await user_crud.delete(user)


@pytest_asyncio.fixture
async def test_user() -> AsyncGenerator[User, None]:
    user = await user_crud.create(UserCreateSchema(id=uuid.uuid4(), username=random_string(), email=random_string()))
    yield user
    await user_crud.delete(user)


@pytest.mark.asyncio
async def test_query(test_data: Tuple[User, Repository]) -> None:
    user, repo = test_data
    stmt = sa.select(Repository).where(Repository.id == repo.id)
    result = (await session.execute(stmt)).scalars().all()
    assert len(result) == 1
    repo = result[0]
    assert repo.created_at is not None
    assert repo.owner.username == user.username

@pytest.mark.asyncio
async def test_share(test_data: Tuple[User, Repository], test_user: User) -> None:
    user, repo = test_data
    repo = await repo_crud.share(repo, test_user)
    assert repo.shared_with[0].id == test_user.id
    assert test_user.shared_repositories[0].id == repo.id

    with repo_crud.with_user(test_user) as c:
        repos = list(await c.read_all())
        assert repo in repos
