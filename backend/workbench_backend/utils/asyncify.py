import asyncio
import functools
from typing import Awaitable, Callable, ParamSpec, TypeVar

T = TypeVar('T')
P = ParamSpec('P')

def asyncify(func: Callable[P, T]) -> Callable[P, Awaitable[T]]:
    @functools.wraps(func)
    async def new_function(*args: P.args, **kwargs: P.kwargs) -> T:
        return await asyncio.to_thread(func, *args,**kwargs)
    return new_function
