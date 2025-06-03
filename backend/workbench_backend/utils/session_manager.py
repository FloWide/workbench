import json
from typing import List, Optional, TypedDict
from uuid import uuid4

from redis import asyncio as aioredis

from ..app.config import config


class SessionData(TypedDict):
    id: str
    user_email: str
    proxy_hashes: List[str]

class SessionManager:
    def __init__(self) -> None:
        self.redis = aioredis.from_url(config.REDIS_BROKER_URL, decode_responses=True) # type: ignore

    async def start_session(self, user_email: str) -> str:
        session_id = str(uuid4())
        session_data: SessionData = {
            "id": session_id,
            "user_email": user_email,
            "proxy_hashes": []
        }
        await self._set_session(session_id, session_data)
        return session_id

    async def end_session(self, session_id: str) -> None:
        session_data = await self._get_session(session_id)
        if session_data:
            for proxy_hash in session_data["proxy_hashes"]:
                await self.redis.delete(f"proxy:{proxy_hash}")
            await self.redis.delete(f"session:{session_id}")

    async def add_proxy_hash_to_session(self, session_id: str, proxy_hash: str) -> None:
        session_data = await self._get_session(session_id)
        if session_data and proxy_hash not in session_data["proxy_hashes"]:
            session_data["proxy_hashes"].append(proxy_hash)
            await self._set_session(session_id, session_data)
            await self.redis.set(f"proxy:{proxy_hash}", session_id)

    async def remove_proxy_hash_from_session(self, session_id: str, proxy_hash: str) -> None:
        session_data = await self._get_session(session_id)
        if session_data and proxy_hash in session_data["proxy_hashes"]:
            session_data["proxy_hashes"].remove(proxy_hash)
            await self._set_session(session_id, session_data)
            await self.redis.delete(f"proxy:{proxy_hash}")

    async def get_session_by_proxy_hash(self, proxy_hash: str) -> Optional[SessionData]:
        session_id = await self.redis.get(f"proxy:{proxy_hash}")
        if session_id:
            return await self._get_session(session_id)
        return None

    async def _get_session(self, session_id: str) -> Optional[SessionData]:
        session_data = await self.redis.get(f"session:{session_id}")
        return json.loads(session_data) if session_data else None

    async def _set_session(self, session_id: str, session_data: SessionData) -> None:
        await self.redis.set(f"session:{session_id}", json.dumps(session_data))

    async def close(self) -> None:
        await self.redis.close()
