from ...crud.crud_router import UserSharedCRUDRouter
from ...crud.schemas.release import (
    ReleaseCreateSchema,
    ReleaseCRUD,
    ReleaseResponseSchema,
    ReleaseUpdateSchema,
)
from ...dependencies.crud import create_crud_dependency_with_user

router = UserSharedCRUDRouter(
    prefix="/release",
    tags=['Release'],
    response_schema=ReleaseResponseSchema,
    create_schema=ReleaseCreateSchema,
    update_schema=ReleaseUpdateSchema,
    get_crud=create_crud_dependency_with_user(ReleaseCRUD),
)
