import { JSONRPC } from "./jsonrpc";


export type NotificationFunction = (args: any[] | Record<string, any>) => void;

export function notification(name: string = null) {
    return function(target: JSONRPC, propertyKey: string, descriptor: TypedPropertyDescriptor<NotificationFunction>) {
        Reflect.set(descriptor.value, 'isRpc', true)
        Reflect.set(descriptor.value, 'rpcName', name || propertyKey)
    }
}

export type RemoteCallFunction = (...args: any[]) => Promise<any>

export function remoteCallFunction(name: string = null, timeout: number = 10000) {
    return function(target: JSONRPC, propertyKey: string, descriptor: TypedPropertyDescriptor<RemoteCallFunction>) {
        descriptor.value = function(...args: any[]) {
            const callArgs = args.length > 1 ? args: (typeof args[0] === 'object' ? args[0] : ( typeof args[0] !== 'undefined'? [args[0]]: []));
            return (this as JSONRPC).call(name || propertyKey, timeout, callArgs);
        }
        return descriptor
    }
}