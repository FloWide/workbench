import { Injectable, OnDestroy } from "@angular/core";
import { JSONRPC, notification, remoteCallFunction } from "../jsonrpc";
import { CustomHttpService, ScriptModel } from "@core/services";
import { Subject } from "rxjs";
import { AppState, Select } from "@core/store";
import { Store } from "@ngrx/store";
import { takeUntil } from "rxjs/operators";



@Injectable()
export class ScriptRunnerService extends JSONRPC implements OnDestroy {

    private destroy$ = new Subject()

    private token: string = "";

    onStatus$ = new Subject<{state: string, message?: string}>();

    onStream$ = new Subject<string>();

    constructor(
        private http: CustomHttpService,
        store: Store<AppState>
    ) {
        super()
        store.select(Select.accessToken).pipe(takeUntil(this.destroy$)).subscribe((token) => {
            this.token = token;
        })
    }
    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    connect(script: ScriptModel) {
        const [onOpen, onClose] = this.setupWebSocket(`${this.http.websocketUrl}/app/${script.id.toString()}/run?token=${this.token}`)
        return onOpen
    }

    disconnect() {
        this.disconnectWebsocket();
    }

    @remoteCallFunction('init')
    async init(): Promise<string> {return null;}

    @remoteCallFunction('run')
    async run(): Promise<null> {return null;}

    @remoteCallFunction('stop')
    async stop(): Promise<null> {return null;}

    @remoteCallFunction('resize')
    async resize(cols: number, rows: number): Promise<null> {return null;}

    @remoteCallFunction('stream_write')
    async streamWrite(data: string): Promise<null> {return null;}

    @notification('on_stream')
    onStream(params: {data: string}) {
        this.onStream$.next(params.data);
    }

    @notification('status')
    onStatus(params: {state: string, message?: string}) {
        this.onStatus$.next(params);
    }
}