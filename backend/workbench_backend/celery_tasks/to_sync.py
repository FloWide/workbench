import asyncio
import functools
from typing import Any, Callable, Coroutine, ParamSpec, TypeVar

T = TypeVar('T')
P = ParamSpec('P')

def syncify(func: Callable[P, Coroutine[Any, Any,T]]) -> Callable[P, T]:
    """
    This should only be used to make async celery tasks possible
    It shouldn't be user anywhere else in the app as there is already a
    running event loop, so it will throw an error

    Args:
        func (Callable[P, Coroutine[Any, Any,T]])

    Returns:
        Callable[P, T]
    """
    @functools.wraps(func)
    def new_function(*args: P.args, **kwargs: P.kwargs) -> T:
        return asyncio.run(func(*args,**kwargs))
    return new_function
