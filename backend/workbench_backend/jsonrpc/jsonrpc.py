import asyncio
import inspect
import json
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Literal,
    Optional,
    ParamSpec,
    Self,
    TypeVar,
)

from pydantic import BaseModel, Field


class RPCRequest(BaseModel):
    jsonrpc: Literal['2.0']
    method: str
    params: Optional[List[Any] | Dict[str, Any]] = Field(default_factory=list)
    id: Optional[str | int | float] = None


class RPCError(BaseModel):
    code: int
    message: str
    data: Optional[Any] = None


class RPCResponse(BaseModel):
    result: Optional[Any] = None
    error: Optional[RPCError] = None
    id: Optional[str | int | float] = None
    jsonrpc: Literal['2.0'] = '2.0'


def PARSE_ERROR(data: Optional[Any] = None) -> RPCError:
    return RPCError(code=-32700, message='Parse Error', data=data)

def INVALID_REQUEST(data: Optional[Any] = None) -> RPCError:
    return RPCError(code=-32600, message='Invalid Request', data=data)

def METHOD_NOT_FOUND(data: Optional[Any] = None) -> RPCError:
    return RPCError(code=-32601, message='Method not found', data=data)

def INVALID_PARAMS(data: Optional[Any] = None) -> RPCError:
    return RPCError(code=-32602, message='Invalid params', data=data)

def INTERNAL_ERROR(data: Optional[Any] = None) -> RPCError:
    return RPCError(code=-32603, message='Internal Error', data=data)




ReturnType = TypeVar('ReturnType')
ParamType = ParamSpec('ParamType')
def register(f: Optional[Callable[ParamType, ReturnType]] = None,*,name: Optional[str] = None): # type: ignore

    def decorator(func: Callable[ParamType, ReturnType]) -> Callable[ParamType, Awaitable[ReturnType]]:
        if not inspect.iscoroutinefunction(func):
            raise ValueError("Only coroutine functions are allowed")
        setattr(func,'_rpc',True)  # noqa: B010
        if name:
            setattr(func,'_rpc_name',name)  # noqa: B010
        return func
    return decorator(f) if callable(f) else decorator


class JsonRpc:
    def __init__(self) -> None:
        self._rpc_methods: Dict[str, Callable[..., Any]] = {}
        self._results_queue: asyncio.Queue[RPCResponse | List[RPCResponse] | RPCRequest | None] = asyncio.Queue()
        for attr in dir(self):
            obj = getattr(self,attr)
            if callable(obj) and getattr(obj,'_rpc',False):
                name = getattr(obj,'_rpc_name', None) or attr
                self._rpc_methods[name] = obj

    async def __handle_one(self, request: RPCRequest) -> RPCResponse:
        if request.jsonrpc != "2.0":
            return RPCResponse(
                error=INVALID_REQUEST("Version must be 2.0")
            )

        if request.method not in self._rpc_methods:
            return RPCResponse(
                id=request.id,
                error=METHOD_NOT_FOUND(f'{request.method} not found')
            )
        try:
            if isinstance(request.params,tuple) or isinstance(request.params, list):
                result = await self._rpc_methods[request.method](*request.params)
            elif isinstance(request.params, dict):
                result = await self._rpc_methods[request.method](**request.params)
            else:
                return RPCResponse(
                    id=request.id,
                    error=INVALID_PARAMS("Params must be list or dict")
                )
            return RPCResponse(
                    id=request.id,
                    result=result
            )
        except Exception as e:
            return RPCResponse(
                id=request.id,
                error=INTERNAL_ERROR(str(e))
            )

    async def __dispatch_one(self, data: Dict[str, Any]) -> Optional[RPCResponse]:
        try:
            request = RPCRequest(**data)
        except Exception as e:
            return RPCResponse(
                error=INVALID_REQUEST(str(e))
            )
        resp = await self.__handle_one(request)
        return resp if request.id is not None else None


    async def __dispatch(self, data: str) -> Optional[RPCResponse] | List[RPCResponse]:
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError as e:
            return RPCResponse(
                error=PARSE_ERROR(str(e))
            )
        if isinstance(parsed,dict):
            return await self.__dispatch_one(parsed)
        elif isinstance(parsed, list):
            results = await asyncio.gather(*[
                self.__dispatch_one(el) for el in parsed
            ])
            return [r for r in results if r is not None]
        else:
            return RPCResponse(
                error=INVALID_REQUEST()
            )

    async def dispatch(self, data: str) -> Optional[RPCResponse] | List[RPCResponse]:
        result = await self.__dispatch(data)
        if result is not None:
            await self._results_queue.put(result)
        return result

    async def notify(self, method: str, *args: Any, **kwargs: Any) -> None:
        assert not (args and kwargs), "Only use args or kwargs"
        await self._results_queue.put(RPCRequest(jsonrpc="2.0",method=method,params=args if args else kwargs))

    async def end(self) ->  None:
        await self._results_queue.put(None)

    def __aiter__(self) -> Self:
        return self

    async def __anext__(self) -> RPCResponse | List[RPCResponse] | RPCRequest:
        r = await self._results_queue.get()
        if r is None:
            raise StopAsyncIteration()
        return r
