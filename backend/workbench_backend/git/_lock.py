import functools
from typing import (
    TYPE_CHECKING,
    Any,
    Awaitable,
    Callable,
    Concatenate,
    Coroutine,
    ParamSpec,
    TypeAlias,
    TypeVar,
)

from ..utils.async_filelock import reader_file_lock, writer_file_lock

if TYPE_CHECKING:
    from .editable_repository import EditableRepository
    from .git_repository import AsyncGitRepository


T = TypeVar('T')
P = ParamSpec('P')

if TYPE_CHECKING:
    SelfType = TypeVar('SelfType', bound=AsyncGitRepository | EditableRepository)
else:
    SelfType: TypeAlias = Any

def with_writer_lock(func: Callable[Concatenate[SelfType, P], Awaitable[T]]) -> Callable[Concatenate[SelfType, P], Coroutine[Any, Any,T]]:
    @functools.wraps(func)
    async def wrapper(s: SelfType, /, *args: P.args, **kwargs: P.kwargs) -> T:
        async with writer_file_lock(s.root_path):
            return await func(s, *args, **kwargs)
    return wrapper

def with_reader_lock(func: Callable[Concatenate[SelfType, P], Awaitable[T]]) -> Callable[Concatenate[SelfType, P], Coroutine[Any, Any,T]]:
    @functools.wraps(func)
    async def wrapper(s: SelfType, /, *args: P.args, **kwargs: P.kwargs) -> T:
        async with reader_file_lock(s.root_path):
            return await func(s, *args, **kwargs)
    return wrapper
