import { Injectable } from "@angular/core";
import { AppState, Select } from "@core/store";
import { CodeEditorActions } from "@core/store/code-editor/code-edior.action";
import { Actions, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { CustomHttpService } from "../http/custom-http.service";
import { RepositoryFileEntry, GitStatus, Process, ProcessStartedNotification, ProcessExitedNotification, ProcessPortsChangedNotification, ChildProcessStartedNotification, ChildProcessExitedNotification, FileChange, WorkBenchConfig } from "./repo.model";
import { JSONRPC, notification, remoteCallFunction } from "src/app/jsonrpc";
import { BehaviorSubject, Subject } from "rxjs";
import {flatMap} from 'lodash';
import { CodeDescription } from "monaco-languageclient";


export interface Status{
    state: 'starting' | 'ready' | 'error';
    message?: string;
    error?: string;
}

export interface RunParams {
    path: string;
    args?: string[];
    cols?: number;
    rows?: number;
    cwd?: string;    
    env?: Record<string, string>;
    term_type?: string;
}

@Injectable({
    providedIn:'root'
})
export class RepositoryEditService extends JSONRPC {
    

    private token: string = '';

    status$ = new Subject<Status>();

    onStream$ = new Subject<{pid:number, data: string}>();

    onTaskStream$ = new Subject<{id: string, name: string, data: string}>();

    onLspStream$ = new Subject<{lang: string,data: any}>();

    onLspServiceStarted$ = new Subject<void>();

    onFileChanges$ = new Subject<FileChange[]>();

    constructor(
        private http: CustomHttpService,
        private store: Store<AppState>,
        private actions$: Actions
    ) {
        super()
        this.store.select(Select.accessToken).subscribe((token) => this.token = token);

        this.actions$.pipe(
            ofType(CodeEditorActions.ConnectToEditWebsocket)
        ).subscribe((action) => {
            this.setupEditWebsocket(action.repo,action.force);
        });
        
        this.actions$.pipe(
            ofType(CodeEditorActions.DisconnectFromEditWebsocket)
        ).subscribe(() => {
            this.disconnectWebsocket();
        })
    }

    @remoteCallFunction('list_dir')
    async listDirectory(dir:string = "",show_hidden: boolean = false) : Promise<RepositoryFileEntry[]> {return null;}

    @remoteCallFunction('get_file_content')
    async getFileContent(filePath: string): Promise<string> {return null;}

    @remoteCallFunction('get_base64_file_content') 
    async getBase64FileContent(filePath: string): Promise<string> {return null;}

    @remoteCallFunction('get_git_status')
    async getGitStatus(): Promise<GitStatus> {return null;}

    @remoteCallFunction('create_file')
    async createFile(path: string, content: string, base64encoded: boolean): Promise<string> {return null;}

    @remoteCallFunction('update_file')
    async updateFile(path: string, content: string, base64encode: boolean): Promise<null> {return null;}

    @remoteCallFunction('delete_file')
    async deleteFile(path: string): Promise<null> {return null;}

    @remoteCallFunction('move_file')
    async moveFile(fromPath: string, toPath: string): Promise<null> {return null;}

    @remoteCallFunction('copy_file')
    async copyFile(fromPath: string, toPath: string): Promise<null> {return null;}

    @remoteCallFunction('make_dir')
    async makeDir(path: string): Promise<string> {return null;}

    @remoteCallFunction('get_processes')
    async getProcesses(): Promise<Record<number, Process>> {return null;}

    @remoteCallFunction('open_proxy')
    async openProxy(pid: number, port: number) : Promise<string> {return null;}

    @remoteCallFunction('get_cwd')
    async getCwd(): Promise<string> {return null;}

    @remoteCallFunction('run')
    async runProcess(params: RunParams): Promise<Process> {return null;}
    
    @remoteCallFunction('stream_write')
    async streamWrite(pid: number, data: string): Promise<null> { return null;}
    
    @remoteCallFunction('kill')
    async killProcess(pid: number, signal?: string): Promise<{exitCode: number, signal: number}> {return null;}

    @remoteCallFunction('resize')
    async resizeProcessTerm(id: number | string, cols: number, rows: number): Promise<null> { return null;}

    @remoteCallFunction('connect_to_lsp')
    async connectToLsp(lang: string): Promise<null> {return null;}

    @remoteCallFunction('lsp_write')
    async writeToLsp(lang:string, data: any): Promise<null> {return null;}
    
    @remoteCallFunction('run_app_or_service')
    async runAppOrService(name: string) : Promise<Process> {return null;}

    @remoteCallFunction('run_build')
    async runBuild(): Promise<number | null> {return null;}

    @remoteCallFunction('install_extra_packages')
    async installExtraPackages(): Promise<number | null> {return null;}

    @remoteCallFunction('run_setup_script')
    async runSetupScript(): Promise<number | null> {return null;}

    @notification('on_lsp_stream')
    onLspStream(data: {lang: string,data: any}) {
        this.onLspStream$.next(data);
    }

    @notification('lsp_service_started')
    onLspRestarted() {
        this.onLspServiceStarted$.next();
    }

    @notification('workbench_config_changed')
    onWorkbenchConfigChanged(params: {config: WorkBenchConfig}) {
        this.store.dispatch(CodeEditorActions.SetWorkBenchConfig({config: params.config}));
    }

    @notification('file_changes')
    onFileChanges(changes: FileChange[][]) {
        this.onFileChanges$.next(flatMap(changes));
        Promise.all(
            [this.listDirectory(),
            this.getGitStatus()]
        ).then(([files, git]) => {
            this.store.dispatch(CodeEditorActions.SetFiles({files:files}));
            this.store.dispatch(CodeEditorActions.SetGitStatus({status:git}));
        })
    }

    @notification('status')
    onStatus(params: Status) {
        this.status$.next(params);
    }

    @notification('proxy_opened')
    onProxyOpened(params: {pid: number, port: number, url: string}) {
        this.store.dispatch(CodeEditorActions.ProcessProxyOpened(params))
    }

    @notification('proxy_closed')
    onProxyClosed(params: {pid: number, port: number}) {
        this.store.dispatch(CodeEditorActions.ProcessProxyClosed(params))
    }

    @notification('PROCESS_STARTED')
    onProcessStarted(data: ProcessStartedNotification) {
        this.store.dispatch(CodeEditorActions.ProcessStarted({process:data.data}));
    }

    @notification('PROCESS_EXITED')
    onProcessExited(data: ProcessExitedNotification) {
        this.store.dispatch(CodeEditorActions.ProcessExited({pid:data.pid,data:data.data}))
    }

    @notification('PORTS_CHANGED')
    onProcessPortsChanged(data: ProcessPortsChangedNotification) {
        this.store.dispatch(CodeEditorActions.ProcessPortsChanged({pid:data.pid,ports:data.data}))
    }

    @notification('CHILD_PROCESS_STARTED')
    onChildProcessStarted(data: ChildProcessStartedNotification) {
        this.store.dispatch(CodeEditorActions.ChildProcessStarted({childProcess:data.data}))
    }

    @notification('CHILD_PROCESS_EXITED')
    onChildProcessExited(data: ChildProcessExitedNotification) {
        this.store.dispatch(CodeEditorActions.ChildProcessExited({pid:data.data.pid,ppid:data.data.ppid}));
    }

    @notification('on_stream')
    onStream(params: {pid: number, data: string}) {
        this.onStream$.next(params);
    }

    @notification('OPEN_FILE_REQUEST')
    onOpenFileRequest(data: {data: RepositoryFileEntry}) {
        this.store.dispatch(CodeEditorActions.OpenTab({tab:data.data} as any));
    }

    @notification('task_started')
    onTaskStarted(params: {id: string, name: string}) {
        this.store.dispatch(CodeEditorActions.TaskStarted(params));
    }

    @notification('task_finished')
    onTaskFinished(params: {id: string, name: string, exit_code: number}) {
        this.store.dispatch(CodeEditorActions.TaskFinished(params));
    }

    @notification('on_task_stream')
    onTaskStream(params: {id: string, name: string, data: string}) {
        this.onTaskStream$.next(params);
    }

    @notification('network_connected')
    onNetworkConnected(params: {ip: string, name: string}) {
        this.store.dispatch(CodeEditorActions.NetworkConnected(params));
    }

    @notification('network_disconnected')
    onNetworkDisconnected(params: {name: string}) {
        this.store.dispatch(CodeEditorActions.NetworkDisconnected(params));
    }

    private setupEditWebsocket(id:number,force:boolean = false) {
        const [onOpen, onClose] = this.setupWebSocket(
            `${this.http.websocketUrl}/repo/${id}/edit?token=${this.token}&force=${force}`,
            
        )

        onOpen.subscribe(() => this.store.dispatch(CodeEditorActions.ConnectToEditWebsocketSuccess()))
        onClose.subscribe(() => this.store.dispatch(CodeEditorActions.ConnectToEditWebsocketError()));
    }

}