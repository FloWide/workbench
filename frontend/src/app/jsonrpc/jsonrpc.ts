import {webSocket, WebSocketSubject} from 'rxjs/webSocket'
import {JsonRpcRequest, JsonRpcResponse} from './model'
import { Subject, Subscription } from 'rxjs';

export class DeferredPromise<T> {
    private deferResolve: (value: T) => void;
    private deferReject: (reason: T) => void;
  
    private promise: Promise<T>;
  
    constructor() {
      this.promise = new Promise<T>((resolve, reject) => {
        this.deferResolve = resolve;
        this.deferReject = reject;
      });
    }
  
    public asPromise(): Promise<T> {
      return this.promise;
    }
  
    public resolve(result: T): void {
      this.deferResolve(result);
    }
  
    public reject(error: T): void {
      this.deferReject(error);
    }
}

export class JSONRPC {

    private websocketSubject$: WebSocketSubject<JsonRpcRequest | JsonRpcResponse>

    private subscription: Subscription;

    private methods: Record<string, Function> = {}

    private counter: number = 0;

    private promises: Map<string, DeferredPromise<any>> = new Map()

    private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
    
    constructor() {
        
        const proto = Object.getPrototypeOf(this)
        for(const prop of Object.getOwnPropertyNames(proto)) {
            if (Reflect.get(proto[prop],'isRpc')) {
                this.methods[Reflect.get(proto[prop],'rpcName')] = proto[prop]
             }
        }
    }

    protected setupWebSocket(url: string) {
        const onOpen = new Subject();
        const onClose = new Subject();
        this.disconnectWebsocket();
        this.websocketSubject$ = webSocket({
            url:url,
            openObserver:onOpen,
            closeObserver:onClose
        });
        setTimeout(() => {
            this.subscription = this.websocketSubject$.subscribe(this.onMessage.bind(this))
        },10);
        return [onOpen, onClose]
    }

    protected disconnectWebsocket() {
        if (this.websocketSubject$) {
            this.websocketSubject$.complete();
            this.websocketSubject$ = null;
        }

        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }

    private onMessage(msg: JsonRpcResponse | JsonRpcRequest) {
        if (msg.jsonrpc !== "2.0") {
            return
        }
        if ('method' in msg) {
            this.handleRequest(msg)
        } else {
            this.handleResponse(msg)
        }
    }

    private handleRequest(request: JsonRpcRequest) {
        if (!(request.method in this.methods)) {
            return
        }
        this.methods[request.method].call(this,request.params)
    }

    private handleResponse(response: JsonRpcResponse) {
        const id = response.id
        const promise = this.promises.get(id)
        const timeout = this.timeouts.get(id)
        if (!promise) {
            console.warn("Can't handle response", response)
            return
        }
        clearTimeout(timeout)
        if (response.error) {
            promise.reject(response.error)
            return
        } else if (response.result) {
            promise.resolve(response.result)
            return
        } else {
            promise.resolve(null)
            return
        }
    } 

    call(method: string, timeout: number,params: any[] | {}) {
        const id = String(this.counter++)
        this.websocketSubject$.next({
            jsonrpc:'2.0',
            method:method,
            params:params,
            id:id
        })
        const promise = new DeferredPromise<any>()
        this.timeouts.set(id,setTimeout(() => {
            promise.reject(`Request timed out ${method}`)
        },timeout))
        this.promises.set(id, promise)
        return promise.asPromise();
    }

}