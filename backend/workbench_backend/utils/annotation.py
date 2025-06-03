import functools
from typing import Callable, ParamSpec, TypeVar

T = TypeVar('T')
P = ParamSpec('P')
def take_annotation_from(this: Callable[P, T]) -> Callable[[Callable[...,T]], Callable[P, T]]:
    def decorator(real_function: Callable[..., T]) -> Callable[P, T]:
        @functools.wraps(real_function)
        def new_function(*args: P.args, **kwargs: P.kwargs) -> T:
            return real_function(*args, **kwargs)

        return new_function
    return decorator
