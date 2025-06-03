from enum import Enum
from typing import (
    Annotated,
    Any,
    AsyncGenerator,
    Awaitable,
    Callable,
    Dict,
    Generic,
    List,
    Literal,
    Optional,
    Sequence,
    Type,
    TypeAlias,
    TypeVar,
    Union,
    cast,
)

from fastapi import APIRouter, HTTPException, Response
from fastapi.params import Depends
from fastapi.types import DecoratedCallable
from pydantic import UUID4, BaseModel

from ..db.models.base import Base
from ..db.models.mixins import ReadWriteEnum
from ..db.models.user import User
from ..dependencies.crud import get_user_crud as default_get_user_crud
from ..utils.annotation import take_annotation_from
from ._utils import (
    DynamicQueryParams,
    catch_errors,
    get_id_type,
)
from .base import CRUD, UserOwnedModelCreateArgs, UserSharedCrud
from .schemas.user import UserCreateSchema, UserUpdateSchema

ModelType = TypeVar("ModelType", bound=Base)
ModelCreateArgs = TypeVar("ModelCreateArgs", bound=BaseModel)
ResponseSchemaType = TypeVar("ResponseSchemaType", bound=BaseModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

CRUD_FACTORY: TypeAlias = Callable[
    ..., AsyncGenerator[CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType], None]
]

CRUD_METHODS: TypeAlias = Literal["GET_ALL", "GET_ONE", "CREATE", "UPDATE", "DELETE"]


class CRUDRouter(
    Generic[ModelType, ResponseSchemaType, CreateSchemaType, UpdateSchemaType],
    APIRouter,
):
    def __init__(
        self,
        *,
        prefix: str = "/",
        tags: Optional[List[str | Enum]] = None,
        dependencies: Optional[Sequence[Depends]] = None,
        create_schema: Optional[Type[CreateSchemaType]] = None,
        update_schema: Optional[Type[UpdateSchemaType]] = None,
        response_schema: Type[ResponseSchemaType],
        get_crud: CRUD_FACTORY[
            ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType
        ],
        disable_methods: Optional[List[CRUD_METHODS]] = None,
        responses: Optional[Dict[Union[int, str], Dict[str, Any]]] = None,
        subrouters: Optional[List[APIRouter]] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            prefix=prefix,
            tags=tags,
            dependencies=dependencies,
            responses=responses,
            **kwargs,
        )
        if subrouters:
            for subrouter in subrouters:
                self.include_router(subrouter)

        if not disable_methods:
            disable_methods = []
        self.get_crud = get_crud

        self._response_schema = response_schema
        self._id_type = get_id_type(response_schema)
        self._create_schema = create_schema
        self._update_schema = update_schema

        if "GET_ALL" not in disable_methods:
            self.add_api_route(
                "",
                self._get_all(),
                name="Get all",
                methods=["GET"],
                response_model=List[response_schema],  # type: ignore
                status_code=200
            )
        if "GET_ONE" not in disable_methods:
            self.add_api_route(
                "/{id}",
                self._get_one(),
                name="Get one",
                methods=["GET"],
                response_model=response_schema,
                status_code=200,
                responses={404: {"description": "Item not found"}},
            )
        if "CREATE" not in disable_methods:
            self.add_api_route(
                "",
                self._create_one(),
                name="Create new",
                methods=["POST"],
                response_model=response_schema,
                status_code=201,
                responses={
                    409: {"description": "Duplicate element"},
                    400: {"description": "Request is malformed"},
                },
            )
        if "UPDATE" not in disable_methods:
            self.add_api_route(
                "/{id}",
                self._update_one(),
                name="Update",
                methods=["PUT"],
                response_model=response_schema,
                status_code=200,
                responses={
                    409: {"description": "Duplicate element"},
                    400: {"description": "Request is malformed"},
                    404: {"description": "Element not found"},
                },
            )
        if "DELETE" not in disable_methods:
            self.add_api_route(
                "/{id}",
                self._delete_one(),
                name="Delete",
                methods=["DELETE"],
                status_code=204,
                responses={404: {"description": "Element not found"}},
            )

    def _get_all(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            params: DynamicQueryParams,
            offset: int = 0,
            limit: int = 100,
        ) -> Sequence[ModelType]:
            params.pop("offset", None)
            params.pop("limit", None)
            if params:
                return await crud.read_by_fields(params, offset, limit)
            return await crud.read_multiple(offset, limit)

        return route

    def _get_one(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            id: self._id_type,  # type: ignore
        ) -> ModelType:
            return await crud.read_by_id(id)

        return route

    def _create_one(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            data: self._create_schema,  # type: ignore
        ) -> ModelType:
            return await crud.create(data)

        return route

    def _update_one(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            id: self._id_type,  # type: ignore
            data: self._update_schema,  # type: ignore
        ) -> ModelType:
            obj = await crud.read_by_id(id)
            return await crud.update(obj, data)

        return route

    def _delete_one(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            id: self._id_type,  # type: ignore
        ) -> Response:
            obj = await crud.read_by_id(id)
            await crud.delete(obj)
            return Response(status_code=204)

        return route

    def _remove_api_route(self, path: str, methods: List[str]) -> None:
        methods_ = set(methods)

        for route in self.routes:
            if (
                route.path == f"{self.prefix}{path}"  # type: ignore
                and route.methods == methods_  # type: ignore
            ):
                self.routes.remove(route)

    @take_annotation_from(APIRouter.get)
    def get(
        self, path: str, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        self._remove_api_route(path, ["GET"])
        return super().get(path, *args, **kwargs)

    @take_annotation_from(APIRouter.post)
    def post(
        self, path: str, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        self._remove_api_route(path, ["POST"])
        return super().post(path, *args, **kwargs)

    @take_annotation_from(APIRouter.put)
    def put(
        self, path: str, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        self._remove_api_route(path, ["PUT"])
        return super().put(path, *args, **kwargs)

    @take_annotation_from(APIRouter.patch)
    def patch(
        self, path: str, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        self._remove_api_route(path, ["PATCH"])
        return super().patch(path, *args, **kwargs)

    @take_annotation_from(APIRouter.delete)
    def delete(
        self, path: str, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        self._remove_api_route(path, ["DELETE"])
        return super().delete(path, *args, **kwargs)

    def create_read_by_id_dependency(self) -> Callable[..., Awaitable[ModelType]]:
        @catch_errors
        async def dep(
            crud: Annotated[
                CRUD[ModelType, ModelCreateArgs, CreateSchemaType, UpdateSchemaType],
                Depends(self.get_crud),
            ],
            id: self._id_type # type: ignore
        ) -> ModelType:
            return await crud.read_by_id(id)
        return dep


USER_SHARED_CRUD_METHODS: TypeAlias = Union[CRUD_METHODS, Literal["SHARE"]]


class ShareData(BaseModel):
    user_id: UUID4
    rw: ReadWriteEnum = ReadWriteEnum.READ

class UserSharedCRUDRouter(
    CRUDRouter[ModelType, ResponseSchemaType, CreateSchemaType, UpdateSchemaType]
):

    def __init__(
        self,
        *,
        prefix: str = "/",
        tags: List[str | Enum] | None = None,
        dependencies: Sequence[Depends] | None = None,
        create_schema: type[CreateSchemaType] | None = None,
        update_schema: type[UpdateSchemaType] | None = None,
        response_schema: type[ResponseSchemaType],
        get_crud: Callable[
            ...,
            AsyncGenerator[
                UserSharedCrud[
                    ModelType,
                    UserOwnedModelCreateArgs,
                    CreateSchemaType,
                    UpdateSchemaType,
                ],
                None,
            ],
        ],
        get_user_crud: Callable[
            ..., Awaitable[CRUD[User, UserCreateSchema, UserCreateSchema, UserUpdateSchema]]
        ] = default_get_user_crud,
        responses: Dict[int | str, Dict[str, Any]] | None = None,
        disable_methods: Optional[List[USER_SHARED_CRUD_METHODS]] = None,
        subrouters: Optional[List[APIRouter]] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            prefix=prefix,
            tags=tags,
            dependencies=dependencies,
            create_schema=create_schema,
            update_schema=update_schema,
            response_schema=response_schema,
            get_crud=get_crud,
            responses=responses,
            disable_methods=cast(List[CRUD_METHODS], disable_methods),
            subrouters=subrouters,
            **kwargs,
        )
        if not disable_methods:
            disable_methods = []
        self.get_user_crud = get_user_crud
        if "SHARE" not in disable_methods:
            self.add_api_route(
                "/{id}/share",
                self._share_one(),
                name="Share",
                methods=["POST"],
                status_code=204,
                responses={404: {"description": "Element not found"}},
            )
            self.add_api_route(
                "/{id}/share",
                self._share_info(),
                name="Share info",
                methods=["GET"],
                # response_model=Dict[str, Any],
                status_code=200,
                responses={404: {"description": "Element not found"}},
            )
            self.add_api_route(
                "/{id}/share",
                self._delete_share(),
                name="Delete share",
                methods=["DELETE"],
                status_code=204,
                responses={404: {"description": "Element not found"}},
            )

    def _share_one(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                UserSharedCrud[
                    ModelType,
                    UserOwnedModelCreateArgs,
                    CreateSchemaType,
                    UpdateSchemaType,
                ],
                Depends(self.get_crud),
            ],
            user_crud: Annotated[
                CRUD[User, UserCreateSchema, UserCreateSchema, UserUpdateSchema],
                Depends(self.get_user_crud),
            ],
            id: self._id_type,  # type: ignore
            data: ShareData
        ) -> Response:
            obj = await crud.read_by_id(id)
            if obj.owner_id == data.user_id: # type: ignore
                raise HTTPException(400, detail="Object is owned by the given user")
            to_user = await user_crud.read_by_id(data.user_id)
            await crud.share(obj, to_user, data.rw)
            return Response(status_code=204)

        return route

    def _share_info(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                UserSharedCrud[
                    ModelType,
                    UserOwnedModelCreateArgs,
                    CreateSchemaType,
                    UpdateSchemaType,
                ],
                Depends(self.get_crud),
            ],
            id: self._id_type,  # type: ignore
        ) -> Dict[UUID4, ReadWriteEnum]:
            obj = await crud.read_by_id(id)
            return await crud.share_info(obj)

        return route

    def _delete_share(self) -> Callable[..., Any]:
        @catch_errors
        async def route(
            crud: Annotated[
                UserSharedCrud[
                    ModelType,
                    UserOwnedModelCreateArgs,
                    CreateSchemaType,
                    UpdateSchemaType,
                ],
                Depends(self.get_crud),
            ],
            user_crud: Annotated[
                CRUD[User, UserCreateSchema, UserCreateSchema, UserUpdateSchema],
                Depends(self.get_user_crud),
            ],
            id: self._id_type,  # type: ignore
            user_id: UUID4
        ) -> Response:
            obj = await crud.read_by_id(id)
            to_user = await user_crud.read_by_id(user_id)
            await crud.delete_share(obj, to_user)
            return Response(status_code=204)

        return route

    def create_read_by_id_check_permission_dependency(self, rw: ReadWriteEnum) -> Callable[..., Awaitable[ModelType]]:
        @catch_errors
        async def dep(
            crud: Annotated[
                UserSharedCrud[
                    ModelType,
                    UserOwnedModelCreateArgs,
                    CreateSchemaType,
                    UpdateSchemaType,
                ],
                Depends(self.get_crud),
            ],
            obj: Annotated[ModelType, Depends(super().create_read_by_id_dependency())],
        ) -> ModelType:
            from .exceptions import InvalidAccess
            access = await crud.get_rw_access(obj)
            if access is None or access.value < rw.value:
                raise InvalidAccess(f'NO {rw.value} access for the given object')
            return obj
        return dep
