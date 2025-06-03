import asyncio
import os
import shutil
from typing import Any, List, Optional, Self

from ..utils import asyncify
from ..utils.timed import timed_async


class AsyncGitRepository:

    def __init__(self, path: str):
        self._path = path

    @property
    def root_path(self) -> str:
        return self._path

    async def _git(self, *args: str, check: bool = True, **kwargs: Any) -> str:
        process = await asyncio.create_subprocess_exec(
            'git', *args,
            cwd=self._path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **kwargs
        )
        stdout, stderr = await process.communicate()
        if check and process.returncode != 0:
            raise RuntimeError(f"Git command failed: {' '.join(args)}\n{stderr.decode()}")
        return stdout.decode()

    @classmethod
    async def init_repository(cls, path: str ) -> Self:
        process = await asyncio.create_subprocess_exec(
            'git', 'init', path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"Git init failed: {stderr.decode()}")
        return cls(path)

    @classmethod
    async def open_repository(cls, path: str) -> Self:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Repository not found at {path}")
        return cls(path)

    @classmethod
    async def clone_repository(cls, url: str, path: str) -> Self:
        process = await asyncio.create_subprocess_exec(
            'git', 'clone', url, path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"Git clone failed: {stderr.decode()}")
        return cls(path)

    @asyncify
    def remove_repository(self) -> None:
        if os.path.exists(self._path):
            shutil.rmtree(self._path, ignore_errors=True)
        else:
            raise FileNotFoundError(f"Repository not found at {self._path}")

    async def add(self, path: str | List[str]) -> None:
        if isinstance(path, list):
            await self._git('add', *path)
        else:
            await self._git('add', path)

    async def add_all(self) -> None:
        await self._git('add', '.')

    async def remove(self, path: str | List[str]) -> None:
        if isinstance(path, str):
            path = [path]
        if not path:
            return
        await self._git('rm', '--ignore-unmatch', *path)

    async def remove_all(self) -> None:
        await self._git('rm', '-r', '--ignore-unmatch', '.')

    async def revert_files(self, paths: List[str]) -> None:
        await self._git('checkout', '--', *paths)

    async def commit(self, author_name: str, author_email: str, message: str = "") -> None:
        env = os.environ.copy()
        env['GIT_AUTHOR_NAME'] = author_name
        env['GIT_AUTHOR_EMAIL'] = author_email
        env['GIT_COMMITTER_NAME'] = author_name
        env['GIT_COMMITTER_EMAIL'] = author_email
        await self._git('commit', '-m', message, env=env)

    async def checkout(self, ref_name: str) -> None:
        await self._git('checkout', ref_name)

    async def create_tag(self, tag: str, ref: Optional[str] = None) -> str:
        args = ['tag', tag]
        if ref:
            args.append(ref)
        await self._git(*args)
        return tag

    async def delete_tag(self, tag: str) -> None:
        await self._git('tag', '-d', tag)

    async def create_remote(self, remote: str, url: str) -> None:
        await self._git('remote', 'add', remote, url)

    @timed_async
    async def get_branches(self) -> List[str]:
        output = await self._git('branch', '--list')
        return [line.strip().lstrip('* ').strip() for line in output.splitlines()]

    @timed_async
    async def get_tags(self) -> List[str]:
        output = await self._git('tag', '--list')
        return [line.strip() for line in output.splitlines()]

    async def get_stashes_length(self) -> int:
        output = await self._git('stash', 'list')
        return len(output.splitlines())

    @timed_async
    async def status(self) -> dict[str, str]:
        output = await self._git('status', '--porcelain')
        status = {}
        for line in output.strip().splitlines():
            code, file = line.split()
            status[file] = code.strip()
        return status

    async def create_branch(self, branch_name: str) -> None:
        await self._git('branch', branch_name)

    @timed_async
    async def get_head_shorthand(self) -> str:
        return (await self._git('rev-parse', '--abbrev-ref', 'HEAD')).strip()

    async def get_tagged_file_content(self, tag: str, file: str) -> Optional[str]:
        try:
            output = await self._git('show', f"{tag}:{file}")
            return output
        except RuntimeError:
            return None

    async def refish_exists(self, refish: str) -> bool:
        try:
            await self._git('rev-parse', refish)
            return True
        except RuntimeError:
            return False

    # TODO: This barely works, directories are not copied
    async def copy_tagged_version(self, tag: str, to_folder: str) -> None:
        tmp_dir = os.path.join('/tmp',self._path, ".tmp_checkout")
        if os.path.exists(tmp_dir):
            await asyncio.to_thread(shutil.rmtree, tmp_dir, ignore_errors=True)


        try:
            await asyncio.to_thread(os.makedirs, tmp_dir)
            await self._git('clone', '.', tmp_dir, '--depth', '1', '--branch', tag)

            for item in os.listdir(tmp_dir):
                if item == ".git":
                    continue
                source = os.path.join(tmp_dir, item)
                destination = os.path.join(to_folder, item)
                if os.path.isdir(source):
                    await asyncio.to_thread(shutil.copytree, source, destination, dirs_exist_ok=True)
                else:
                    await asyncio.to_thread(shutil.copy2, source, destination)

        finally:
            await asyncio.to_thread(shutil.rmtree, tmp_dir, ignore_errors=True)
