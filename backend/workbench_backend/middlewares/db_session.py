from uuid import uuid4

from starlette.types import ASGIApp, Receive, Scope, Send

from ..db.session import reset_session_context, session, set_session_context


class DbSessionMiddleware:

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        session_id = str(uuid4())
        context = set_session_context(session_id)
        try:
            await self.app(scope, receive, send)
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.remove()
            reset_session_context(context)
