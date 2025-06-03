import { GitStatus, Process, RepositoryFileEntry, RepositoryModel, ChildProcess, WorkBenchConfig} from "@core/services/repo/repo.model";
import { createAction, props } from "@ngrx/store";
import { CodeTab } from "./code-editor.state";
import { RunParams } from "@core/services/repo/repo-edit.service";

export namespace CodeEditorActions {

    export const SetRepo = createAction('[CODE EDITOR] Set repo',props<{repo:RepositoryModel}>());

    export const SetFiles = createAction('[CODE EDITOR] Set Files',props<{files:RepositoryFileEntry[]}>());

    export const SetGitStatus = createAction('[CODE EDITOR] Set Git status',props<{status:GitStatus}>());

    export const OpenTab = createAction('[CODE EDITOR] Open tab',props<{tab:CodeTab}>());

    export const CloseTab = createAction('[CODE EDITOR] Close tab',props<{tab:CodeTab}>());

    export const FocusTab = createAction('[CODE EDITOR] Focus tab',props<{tab:CodeTab}>());

    export const SetTabModified =  createAction('[CODE EDITOR] Set tab modified',props<{tab:CodeTab}>());

    export const NewTextModel = createAction('[CODE EDITOR] New Text model',props<{path:string,model:monaco.editor.ITextModel}>());

    export const ConnectToEditWebsocket = createAction('[CODE EDITOR] Connect to edit websocket',props<{repo:number,force?:boolean}>());

    export const DisconnectFromEditWebsocket = createAction('[CODE EDITOR] Disconnect from edit websocket');

    export const ConnectToEditWebsocketSuccess = createAction('[CODE EDITOR] Connect to edit websocket success');

    export const ConnectToEditWebsocketError = createAction('[CODE EDITOR] Connect to edit websocket error');

    export const WebsocketStreamMessage = createAction('[CODE EDITOR] Websocket stream message',props<{msg:string}>());

    export const CommitChanges = createAction('[CODE EDITOR] Commit changes',props<{repo:number,commitMsg:string}>());

    export const CommitChangesSuccess = createAction('[CODE EDITOR] Commit changes success',props<{repo:number}>());

    export const CommitChangesError = createAction('[CODE EDITOR] Commit changes error',props<{repo:number}>());

    export const Clear = createAction('[CODE EDITOR] Clear');

    export const StartProcess = createAction('[CODE EDITOR] Start process',props<{params: RunParams}>());

    export const StopProcess = createAction('[CODE EDITOR] Stop process', props<{pid:number}>());

    export const ProcessStarted = createAction('[CODE EDITOR] Process started',props<{process:Process}>());

    export const ProcessExited = createAction('[CODE EDITOR] Process exited',props<{pid: number, data: {exitCode: number,signal: number}}>());

    export const ProcessPortsChanged = createAction('[CODE EDITOR] Process ports changed',props<{pid: number, ports: number[]}>())

    export const ChildProcessStarted = createAction('[CODE EDITOR] Child process started', props<{childProcess: ChildProcess}>())

    export const ChildProcessExited = createAction('[CODE EDITOR] Child process exited',props<{ppid: number, pid:number}>())

    export const ProcessProxyOpened = createAction('[CODE EDITOR] Process Proxy Opened',props<{port: number,url: string, pid: number}>());

    export const ProcessProxyClosed = createAction('[CODE EDITOR] Process Proxy closed',props<{pid: number, port: number}>());

    export const SetWorkBenchConfig = createAction('[CODE EDITOR] Set Workbench Config',props<{config: WorkBenchConfig}>());

    export const StartAppOrService = createAction('[CODE EDITOR] Start App or Service ',props<{name: string}>());

    export const StartAppOrServiceSuccess = createAction('[CODE EDITOR] Start App or Service Success',props<{name: string, process: Process}>());

    export const StartAppOrServiceError = createAction('[CODE EDITOR] Start App or Service Error',props<{name: string, err: string}>());

    export const TaskStarted = createAction('[CODE EDITOR] Task started', props<{id: string, name: string}>());

    export const TaskFinished = createAction('[CODE EDITOR] Task finished', props<{id: string, name: string, exit_code: number}>());

    export const NetworkConnected = createAction('[CODE EDITOR] Network connected', props<{name: string, ip: string}>());

    export const NetworkDisconnected = createAction('[CODE EDITOR] Network disconnected', props<{name: string}>());
}