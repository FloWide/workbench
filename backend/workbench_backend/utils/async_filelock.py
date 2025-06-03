import asyncio
import fcntl
import hashlib
from contextlib import asynccontextmanager
from typing import IO, AsyncIterator


def _acquire_lock(name: str, operation: int) -> IO[str]:
    f = open(f'/tmp/{hashlib.sha1(name.encode()).hexdigest()}.lock', 'w')
    fcntl.flock(f, operation)
    return f

def _release_lock(f: IO[str]) -> None:
    fcntl.flock(f, fcntl.LOCK_UN)
    f.close()

@asynccontextmanager
async def writer_file_lock(name: str) -> AsyncIterator[None]:
    try:
        file = await asyncio.to_thread(_acquire_lock, name, fcntl.LOCK_EX)
        yield
    finally:
        await asyncio.to_thread(_release_lock, file)

@asynccontextmanager
async def reader_file_lock(name: str) -> AsyncIterator[None]:
    try:
        file = await asyncio.to_thread(_acquire_lock, name, fcntl.LOCK_SH)
        yield
    finally:
        await asyncio.to_thread(_release_lock, file)
