import asyncio
import contextlib
import io
import os
import tarfile
import tempfile
import time
from tempfile import _TemporaryFileWrapper
from typing import (
    IO,
    TYPE_CHECKING,
    Any,
    AsyncIterator,
    Callable,
    Dict,
    Optional,
    TypeAlias,
)

from aiodocker import Docker

RELEASE_DOCKERFILE = """
    FROM base-workbench:latest
    ARG HTTP_PROXY
    ARG HTTPS_PROXY
    USER root
    COPY . .

    RUN build && \
        chown -R runner:runner ${HOME}
    USER runner
"""

class BuildError(Exception):
    pass

def _sync_archive(
    context: str,
    file: IO[bytes],
    extra_files: Optional[Dict[str, str]] = None,
) -> tarfile.TarFile:
    with tarfile.open(mode='x:gz',fileobj=file) as tar:
        tar.add(context, arcname=".")
        if extra_files:
            for name, content in extra_files.items():
                tarinfo = tarfile.TarInfo(name)
                encoded = content.encode()
                tarinfo.size = len(encoded)
                tarinfo.mtime = int(time.time())
                tar.addfile(tarinfo, io.BytesIO(encoded))
        return tar

if TYPE_CHECKING:
    TempFileWrapperType: TypeAlias = _TemporaryFileWrapper[bytes]
else:
    TempFileWrapperType: TypeAlias = _TemporaryFileWrapper


@contextlib.asynccontextmanager
async def archive_directory(
    context: str,
    extra_files: Optional[Dict[str, str]] = None,
) -> AsyncIterator[TempFileWrapperType]:
    try:
        temp = tempfile.NamedTemporaryFile()
        await asyncio.to_thread(_sync_archive, context, temp, extra_files)
        temp.seek(0)
        yield temp
    finally:
        temp.close()


async def build_image(
    context: str,
    tag: str,
    extra_files: Optional[Dict[str, str]] = None,
    buildargs: Optional[Dict[str, Any]] = None,
    labels: Optional[Dict[str, str]] = None,
    stream_callback: Optional[Callable[[str], None]] = None
) -> Any:
    proxies = {'HTTP_PROXY': os.environ.get('HTTP_PROXY'),'HTTPS_PROXY':os.environ.get('HTTPS_PROXY')}
    async with Docker() as client:
        async with archive_directory(context, extra_files) as file:
            stream = client.images.build(
                fileobj=file,
                encoding='gzip',
                stream=True,
                tag=tag,
                buildargs={**buildargs,**proxies} if buildargs else proxies,
                labels=labels,
                nocache=True,
                platform="linux/amd64",
            )
            async for line in stream:
                if line.get("errorDetail"):
                    raise BuildError(
                        f"Docker image failed to build {tag}:\n{line['errorDetail']['message']}"
                    )
                if stream_callback and "stream" in line:
                    stream_callback(line["stream"].strip())
        return await client.images.inspect(tag)
