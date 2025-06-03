import hashlib
import logging
import tempfile
from pathlib import Path
from typing import List, Optional

import aiofiles
from sqlalchemy import UUID

from ...app.config import config
from ...crud.schemas.repository import RepositoryCRUD

# from ...crud.schemas.app import AppCreateSchema, AppCRUD, AppUpdateSchema
# from ...crud.schemas.service import (
#    ServiceCreateSchema,
#    ServiceCRUD,
#    ServiceUpdateSchema,
# )
from ...crud.schemas.user import UserCRUD
from ...db.models.app import App
from ...db.models.service import Service
from ...db.standalone_session import standalone_session
from ...docker.build_utils import RELEASE_DOCKERFILE, build_image
from ...workbench_config.model import AppConfig, WorkBenchConfig
from ..celery_app import app
from ..to_sync import syncify


@app.task
@syncify
async def create_releases(release_id: int, repo_id: int,user_id: UUID[str], git_tag: str, target_refish: Optional[str] = None) -> None:
    #workaround for circular imports
    from ...crud.schemas.app import AppCreateSchema, AppCRUD, AppUpdateSchema
    from ...crud.schemas.service import (
        ServiceCreateSchema,
        ServiceCRUD,
        ServiceUpdateSchema,
    )
    async with standalone_session() as session:
        repo_crud = RepositoryCRUD.make_instance(session, True)
        app_crud = AppCRUD.make_instance(session, True)
        service_crud = ServiceCRUD.make_instance(session, True)
        user_crud = UserCRUD.make_instance(session, True)

        repo = await repo_crud.read_by_id(repo_id)
        git_repo = await repo.get_git_repo()
        if not (await git_repo.refish_exists(git_tag)):
            await git_repo.create_tag(git_tag, ref=target_refish)

        user = await user_crud.read_by_id(user_id)
        with tempfile.TemporaryDirectory() as tmpdir:
            await git_repo.copy_tagged_version(git_tag, tmpdir)
            async with aiofiles.open(Path(tmpdir) / 'workbench.yml','r') as f:
                workbench_config = WorkBenchConfig.yaml_load(await f.read())

            result: List[App | Service] = []
            with app_crud.with_user(user) as ac, service_crud.with_user(user) as sc:
                for name, app_config in workbench_config.apps.items():
                    logo_path = await save_app_logo(app_config, tmpdir)
                    result.append(await ac.create(AppCreateSchema(name=name, release_id=release_id, app_icon=logo_path, workbench_config_json=workbench_config.model_dump())))
                for name, _ in workbench_config.services.items():
                    result.append(await sc.create(ServiceCreateSchema(name=name, release_id=release_id, workbench_config_json=workbench_config.model_dump())))

            try:
                await build_image(
                    tmpdir,
                    f'release:{release_id}',
                    extra_files={
                        'Dockerfile':RELEASE_DOCKERFILE
                    },
                    stream_callback=lambda d: print(d)
                )
                for obj in result:
                    if isinstance(obj, App):
                        await app_crud.update(obj, AppUpdateSchema(ready=True))
                    else:
                        await service_crud.update(obj, ServiceUpdateSchema(ready=True))
            except Exception as e:
                logging.error(f'Build error for release {release_id}', exc_info=e)


async def save_app_logo(app_config: AppConfig, tmpdir: str) -> str | None:
    if (logo := app_config.app_icon) is None:
        return None

    if logo.startswith('http'):
        return logo

    tmp_logo_path = Path(tmpdir) / logo

    if not tmp_logo_path.exists():
        return None

    app_logo_root = Path(config.APPS_LOGO_ROOT)
    app_logo_root.mkdir(parents=True, exist_ok=True)

    logo_hash = hashlib.sha256()
    async with aiofiles.open(tmp_logo_path, 'rb') as src_file:
        while (chunk := await src_file.read(4096)):
            logo_hash.update(chunk)

    extension = tmp_logo_path.suffix

    destination = app_logo_root / f'{logo_hash.hexdigest()}{extension}'

    if destination.exists():
        return str(destination)

    async with aiofiles.open(tmp_logo_path, 'rb') as src_file:
        async with aiofiles.open(destination, 'wb') as dst_file:
            while chunk := await src_file.read(4096):
                await dst_file.write(chunk)

    return str(destination)
