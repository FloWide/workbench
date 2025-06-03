import functools
import logging
from typing import (
    Annotated,
    Any,
    Awaitable,
    Callable,
    Dict,
    ParamSpec,
    Type,
    TypeVar,
)

import pydantic
from fastapi import Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError

from . import exceptions


def get_id_type(schema: Type[pydantic.BaseModel], id_field: str = 'id') -> Any:
    try:
        return schema.model_fields[id_field].annotation
    except KeyError:
        return int


def dynamic_query_params(request: Request) -> Dict[str, Any]:
    return dict(request.query_params)



DynamicQueryParams = Annotated[Dict[str, Any], Depends(dynamic_query_params)]

T = TypeVar('T')
P = ParamSpec('P')
def catch_errors(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:

    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await func(*args,**kwargs)
        except exceptions.DBNotFoundException as e:
            raise HTTPException(status_code=404, detail=f"{e.model} with id {e.id} not found") from e
        except exceptions.DBDuplicateElementException as e:
            raise HTTPException(status_code=409, detail=f"Duplicate {e.model} with field {e.field} value: {e.value}") from e
        except exceptions.InvalidAccess as e:
            raise HTTPException(status_code=401, detail=e.args) from e
        except exceptions.UserNotSetException as e:
            raise HTTPException(status_code=401) from e
        except IntegrityError as e:
            raise HTTPException(status_code=400,detail=str(e)) from e
        except exceptions.CRUDException as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except HTTPException as e:
            raise e
        except Exception as e:
            logging.error(f"Unhandled exception in path function: {func} {repr(e)}", exc_info=e)
            raise HTTPException(status_code=500, detail=str(e)) from e
    return wrapper
