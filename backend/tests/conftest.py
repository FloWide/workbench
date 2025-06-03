import asyncio
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient

from workbench_backend.app import create_app
from workbench_backend.db.models import *  # noqa
from workbench_backend.db.models.base import Base
from workbench_backend.db.session import async_engine, session_context


@pytest_asyncio.fixture(scope='session', autouse=True)
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
   loop = asyncio.get_event_loop_policy().new_event_loop()
   yield loop
   loop.close()

@pytest.fixture(scope="function", autouse=True)
def db_context(request: pytest.FixtureRequest) -> Generator[None, None, None]:
    context = session_context.set(request.node.name)
    yield
    session_context.reset(context)

@pytest_asyncio.fixture(scope='session')
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        app=create_app(),
        base_url='http://test'
    ) as ac:
        yield ac

@pytest_asyncio.fixture(scope='session', autouse=True)
async def db() -> AsyncGenerator[None, None]:
    async with async_engine.connect() as conn:
         await conn.run_sync(Base.metadata.create_all)
         await conn.commit()
         yield
         await conn.run_sync(Base.metadata.drop_all)
         await conn.commit()
