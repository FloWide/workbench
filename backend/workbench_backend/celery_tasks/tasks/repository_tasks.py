from ...db.standalone_session import standalone_session
from ...templates.repository import TEMPLATE_TYPES, RepositoryTemplate
from ..celery_app import app
from ..to_sync import syncify


@app.task
@syncify
async def init_repo_template(repo_id: int, template_type: TEMPLATE_TYPES) -> None:
    async with standalone_session() as session:

        from ...crud.schemas.repository import (  # avoids circular import
            RepositoryCRUD,
            RepositoryUpdateSchema,
        )

        repo_crud = RepositoryCRUD.make_instance(session, True)
        repo = await repo_crud.read_by_id(repo_id)
        git_repo = await repo.get_git_repo()
        template = RepositoryTemplate(template_type)
        await template.render(repo.path(), name=repo.name, user_name=repo.owner.username, user_email=repo.owner.email )
        await git_repo.add_all()
        await git_repo.commit(author_name="Workbench API", author_email="info@flowide.net", message=f"Initialized from template {template_type}")

        repo.ready = True
        await repo_crud.update(repo, RepositoryUpdateSchema(name=repo.name))
