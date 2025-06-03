from contextvars import ContextVar, Token

from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_scoped_session,
    async_sessionmaker,
    create_async_engine,
)

from ..app.config import Env, config

session_context: ContextVar[str] = ContextVar('session_context')

def get_session_context() -> str:
    return session_context.get()

def set_session_context(id: str) -> Token[str]:
    return session_context.set(id)

def reset_session_context(context: Token[str]) -> None:
    session_context.reset(context)


pool_args = {} if config.ENV in (Env.CELERY, Env.TEST) else {"pool_size": 20, "max_overflow": 40}


async_engine = create_async_engine(
    config.DB_URI,
    echo=False,
    poolclass=NullPool if config.ENV in (Env.CELERY, Env.TEST) else None,
    **pool_args
)

async_session_factory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autoflush=True,
    autocommit=False
)

session: async_scoped_session[AsyncSession] = async_scoped_session(
    session_factory=async_session_factory,
    scopefunc=get_session_context,
)
