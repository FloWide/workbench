import asyncio
import io
import tarfile
from pathlib import Path
from typing import Dict, Literal, TypeAlias, TypedDict, Unpack

import aiodocker
import aiofiles
from jinja2 import Environment, FileSystemLoader, PrefixLoader, Template

from ..docker.utils import ContainerConfigBuilder
from ..utils.asyncify import asyncify

TEMPLATES_ROOT = (Path(__file__).resolve().parent / '_repository_templates').resolve()

jinja_env = Environment(
    loader=PrefixLoader({
        'python': FileSystemLoader(TEMPLATES_ROOT / 'python'),
        'streamlit': FileSystemLoader(TEMPLATES_ROOT / 'streamlit'),
        'service': FileSystemLoader(TEMPLATES_ROOT / 'service'),
        'nextjs': FileSystemLoader(TEMPLATES_ROOT / 'nextjs'),
        'empty': FileSystemLoader(TEMPLATES_ROOT / 'empty'),
    }),
    enable_async=True
)

TEMPLATE_TYPES: TypeAlias = Literal['python', 'streamlit', 'service', 'nextjs', 'empty']


class RepositoryTemplateArgs(TypedDict):
    name: str
    user_name: str
    user_email: str


def create_tar_with_script(script_path: Path, arcname: str = "script.sh") -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        tar.add(script_path, arcname=arcname)
    buf.seek(0)
    return buf.read()


class RepositoryTemplate:
    def __init__(self, type_: TEMPLATE_TYPES) -> None:
        self.type = type_
        self.templates: Dict[str, Template] = {}

    @asyncify
    def _load_templates(self) -> None:
        dir_ = TEMPLATES_ROOT / self.type
        for path in dir_.iterdir():
            if path.name == '.scripts':
                continue
            template = jinja_env.get_template(f"{self.type}/{path.name}")
            self.templates[path.name] = template

    async def render(self, path: str | Path, **kwargs: Unpack[RepositoryTemplateArgs]) -> None:
        await self._load_templates()
        path = Path(path)

        await self._run_hook_script('pre.sh', path)

        async def render_file(file: str, template: Template) -> None:
            async with aiofiles.open(path / file, 'w') as f:
                async for chunk in template.generate_async(**kwargs):
                    await f.write(chunk)

        await asyncio.gather(*[
            render_file(file, template)
            for file, template in self.templates.items()
        ])

        await self._run_hook_script('post.sh', path)

    async def _run_hook_script(self, script_name: str, output_dir: Path) -> None:
        script_path = TEMPLATES_ROOT / self.type / '.scripts' / script_name
        if not script_path.exists() or not script_path.is_file():
            return
        await self._run_script_in_container(script_path, output_dir)

    async def _run_script_in_container(self, script_path: Path, output_dir: Path) -> None:
        config = (
            ContainerConfigBuilder('base-workbench:latest')
            .volume(str(output_dir), '/workspace', 'rw')
            .working_dir('/workspace')
            .entrypoint(["tail", "-f", "/dev/null"])
        )

        script_data = create_tar_with_script(script_path, arcname=script_path.name)

        async with aiodocker.Docker() as client:
            container = await client.containers.create(config)
            try:
                await container.start()
                await container.put_archive(path='/tmp', data=script_data)

                exec_instance = await container.exec(
                    cmd=["bash", f"/tmp/{script_path.name}"],
                    workdir='/workspace',
                    user='root'
                )

                stream = exec_instance.start(detach=False)
                stdout, stderr = "", ""

                async with stream as s:
                    while (msg := await s.read_out()) is not None:
                        if msg.stream == 1:
                            stdout += msg.data.decode()
                        elif msg.stream == 2:
                            stderr += msg.data.decode()

                await exec_instance.inspect()

                if stderr:
                    print(f"[stderr] {stderr}")
                if stdout:
                    print(f"[stdout] {stdout}")

            finally:
                await container.delete(force=True)
