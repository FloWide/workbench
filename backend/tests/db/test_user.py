import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from workbench_backend.crud.schemas.user import UserCreateSchema, UserCRUD
from workbench_backend.db.models.user import User
from workbench_backend.db.session import session

from .util import random_string

user_crud = UserCRUD.make_instance(session)

@pytest.mark.filterwarnings("ignore: Column")
@pytest.mark.asyncio
async def test_create_user_no_id() -> None:
    with pytest.raises(IntegrityError):
        user = User(id=None, username=random_string(), email=random_string())
        session.add(user)
        await session.commit()

@pytest.mark.asyncio
async def test_create_user() -> None:
    create_args = UserCreateSchema(id=uuid.uuid4(), username=random_string(), email=random_string())
    user = await user_crud.create(create_args)
    assert user.id == create_args.id
    assert user.username == create_args.username
    assert user.email == create_args.email
    await user_crud.delete(user)
