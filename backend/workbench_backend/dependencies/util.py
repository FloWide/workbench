from typing import Annotated, AsyncGenerator

from fastapi import Depends

from ..utils.session_manager import SessionManager


async def session_manager_dep() -> AsyncGenerator[SessionManager, None]:
    try:
        manager = SessionManager()
        yield manager
    finally:
        await manager.close()

SESSION_MANAGER = Annotated[SessionManager, Depends(session_manager_dep)]
