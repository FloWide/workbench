import asyncio
import base64
import fnmatch
import os
import shutil
from typing import (
    List,
    Literal,
    Optional,
    Protocol,
    TypeAlias,
    TypeVar,
    overload,
)

import aiofiles
import magic
from pydantic import BaseModel

from ..utils.asyncify import asyncify
from ..workbench_config.mixin import WorkBenchConfigMixin
from ._lock import with_reader_lock, with_writer_lock
from .git_repository import AsyncGitRepository


def is_ignored(path: str, patterns: List[str]) -> bool:
    for pattern in patterns:
        if fnmatch.fnmatch(path, pattern):
            return True
    return False

class RepositoryFileEntry(BaseModel):
    name: str
    path: str
    absolutePath: str
    isDirectory: bool
    mimeType: Optional[str]

T = TypeVar('T', bound=bytes | str)

class AsyncFileLike(Protocol[T]):
    async def read(self, size: int | None = ...) -> T: ...
    async def write(self, data: T) -> int: ...

DATA_FILE_CONTENT_TYPE: TypeAlias = str | bytes
STREAM_FILE_CONTENT_TYPE: TypeAlias = AsyncFileLike[bytes] | AsyncFileLike[str]
FILE_CONTENT_TYPE: TypeAlias = DATA_FILE_CONTENT_TYPE | STREAM_FILE_CONTENT_TYPE

class EditableRepository(AsyncGitRepository, WorkBenchConfigMixin):

    CHUNK_SIZE = 64 * 1024

    def file_exists(self, path: str) -> bool:
        return os.path.exists(
            os.path.join(self.root_path, path)
        )

    def create_numbered_path(self, path: str) -> str:
        i = 1
        to_path = path
        while os.path.exists(to_path):
            root, ext = os.path.splitext(path)
            to_path = f"{root} ({i}){ext}"
            i += 1
        return to_path

    @with_writer_lock
    @asyncify
    def copy_file(self, path: str, to_path: str) -> None:
        from_path = os.path.join(self.root_path,path)
        to_path_base = os.path.join(self.root_path,to_path)

        to_path_base = to_path_base if not os.path.isdir(to_path_base) else os.path.join(to_path_base, os.path.basename(from_path))
        to_path = self.create_numbered_path(to_path_base)
        if os.path.isdir(from_path):
            shutil.copytree(from_path, to_path)
        else:
            shutil.copy(from_path, to_path)

    @with_writer_lock
    @asyncify
    def mkdir(self, path: str) -> str:
        base_path = os.path.join(self.root_path, path)
        to_path = self.create_numbered_path(base_path)
        os.makedirs(
            to_path,
            exist_ok=True
        )
        return to_path

    @with_writer_lock
    @asyncify
    def move_file(self, from_path: str, to_path: str) -> None:
        from_path = os.path.join(self.root_path, from_path)
        to_path = os.path.join(self.root_path, to_path)

        if not os.path.exists(os.path.dirname(to_path)):
            os.makedirs(os.path.dirname(to_path),exist_ok=True)

        os.rename(from_path,to_path)

    @overload
    async def update_file(self, file: str, content: DATA_FILE_CONTENT_TYPE, base64encoded: bool = False) -> None:
        ...

    @overload
    async def update_file(self, file: str, content: STREAM_FILE_CONTENT_TYPE, base64encoded: Literal[False] = False) -> None:
        ...

    @with_writer_lock
    async def update_file(self,file: str,content: FILE_CONTENT_TYPE, base64encoded: bool = False) -> None:
        file = os.path.join(self.root_path,file)
        await self._write_file(file, content, base64encoded)

    @overload
    async def create_file(self, file: str, content: Optional[DATA_FILE_CONTENT_TYPE] = None, base64encoded: bool = False) -> str:
        ...

    @overload
    async def create_file(self, file: str, content: Optional[STREAM_FILE_CONTENT_TYPE] = None, base64encoded: Literal[False] = False) -> str:
        ...

    @with_writer_lock
    async def create_file(self,file: str, content: Optional[FILE_CONTENT_TYPE] = None, base64encoded: bool = False) -> str:

        file = os.path.join(self.root_path,file)
        path = self.create_numbered_path(file)
        if not os.path.exists(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path),exist_ok=True)

        if not content:
            open(path,'a').close()
        else:
            await self._write_file(path, content, base64encoded)
        return os.path.relpath(path, self.root_path)

    @with_writer_lock
    @asyncify
    def delete(self,path: str) -> None:
        path = os.path.join(self.root_path,path)

        if os.path.isfile(path):
            os.remove(path)
        else:
            shutil.rmtree(path)

    @with_reader_lock
    async def get_file_content(self, path: str) -> str:
        path = os.path.join(self.root_path,path)

        if not os.path.exists(path):
            raise FileNotFoundError(f"{path} doesn't exist")

        async with aiofiles.open(path,'r') as f:
            return await f.read()

    @with_reader_lock
    async def list_dir(self, dir: str ="", show_hidden: bool =False) -> List[RepositoryFileEntry]:
        if not show_hidden:
            if self.workbench_config and self.workbench_config.development:
                ignore_patterns = self.workbench_config.development.ignore.splitlines()
        else:
            ignore_patterns = None

        return await asyncio.to_thread(self._list_dir,dir=dir,ignore_patterns=ignore_patterns)


    def _list_dir(self, dir: str = "", ignore_patterns: Optional[List[str]] =None) -> List[RepositoryFileEntry]:
        absolute_root = os.path.join(self.root_path, dir)

        if ignore_patterns is None:
            ignore_patterns = []

        data: List[RepositoryFileEntry] = []
        for name in os.listdir(absolute_root):
            full_path = os.path.join(absolute_root, name)
            relative_path = os.path.relpath(full_path, self.root_path)

            if is_ignored(relative_path, ignore_patterns):
                continue

            data.append(RepositoryFileEntry(
                name=name,
                absolutePath=full_path,
                path=relative_path,
                isDirectory=os.path.isdir(full_path),
                mimeType=magic.from_file(full_path, mime=True) if not os.path.isdir(full_path) else None
            ))
        return data

    async def _write_file(self, path: str, content: FILE_CONTENT_TYPE, base64encoded: bool = False) -> None:
        if base64encoded and ( isinstance(content, str) or isinstance(content, bytes)):
            content = base64.b64decode(content)

        if isinstance(content, str) or isinstance(content, bytes):
            async with aiofiles.open(path, 'wb' if isinstance(content, bytes) else 'w') as f: # type: ignore
                await f.write(content)
        else:
            async with aiofiles.open(path, 'wb') as f:
                while chunk := await content.read(self.CHUNK_SIZE):
                    await f.write(chunk) # type: ignore
