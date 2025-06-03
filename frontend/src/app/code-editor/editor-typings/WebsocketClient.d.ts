
export as namespace WS;

export type Events = 'error' | 'message' | 'close' | 'open';
export interface Data<T = any> {
    timeStamp: number;
    data: T;
}
export type DataEventHandler<T = any> = (ev: CustomEvent<Data<T>>) => void;
export type CloseEventHandler = (arg: CloseEvent) => void;
export type EventHandler = (arg: Event) => void;
export class ReconnectingWebsocket<T = any> extends EventTarget {
    private url?;
    private reconnectInterval;
    private socket;
    private reconnectTimeout;
    constructor(url?: string, reconnectInterval?: number);
    off(event: "message", handler: DataEventHandler<T>): this;
    off(event: "close", handler: CloseEventHandler): this;
    off(event: "error" | "open" | "reconnecting", handler: EventHandler): this;
    on(event: "message", handler: DataEventHandler<T>): this;
    on(event: "close", handler: CloseEventHandler): this;
    on(event: "error" | "open" | "reconnecting", handler: EventHandler): this;
    open(): this;
    close(): this;
    send(data: T): this;
    reconnect(): this;
    protected onOpen(ev: Event): void;
    protected onClose(ev: CloseEvent): void;
    protected onError(ev: Event): void;
    protected onMessage(ev: MessageEvent<T>): void;
}
export class JSONWebsocketClient<T = any> extends ReconnectingWebsocket<T> {
    protected onMessage(ev: MessageEvent<T>): void;
}
