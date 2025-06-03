from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
)

from .session import (
    async_session_factory,
)


@asynccontextmanager
async def standalone_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as s:
        yield s
