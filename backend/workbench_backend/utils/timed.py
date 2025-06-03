import functools
import time
from typing import Callable, Coroutine, ParamSpec, TypeVar

P = ParamSpec('P')
R = TypeVar('R')

def timed_async(func: Callable[P, Coroutine[None,None,R]]) -> Callable[P, Coroutine[None,None,R]]:
    """
    Decorator to measure the execution time of a function.
    """
    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start_time = time.perf_counter()
        result = await func(*args, **kwargs)
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        print(f"Execution time of {func.__name__}: {execution_time:.4f} seconds")
        return result

    return wrapper
