import { Action, createReducer, on } from "@ngrx/store";
import { CodeEditorActions } from "./code-edior.action";
import { GitStatus, RepositoryFileEntry, RepositoryModel, Process, WorkBenchConfig} from "@core/services/repo/repo.model";



export type CodeTab = RepositoryFileEntry & {modified:boolean};

export interface CodeTabs {
    [key:string]:CodeTab
}

export interface CodeEditorState {
    files:RepositoryFileEntry[];
    repo:RepositoryModel;
    git_status:GitStatus;
    openTabs:CodeTabs;
    focusedTab:CodeTab;
    editWebsocketConnected:boolean;
    processes: Record<number,Process>;
    appToProcess: Record<string, number>;
    workbenchConfig: WorkBenchConfig;
    portProxyMap: Record<number, Record<number, string>>;
    unsavedChanges:boolean;
}

const initalState: CodeEditorState = {
    repo:null,
    files:null,
    git_status:null,
    openTabs:{},
    focusedTab:null,
    editWebsocketConnected:false,
    unsavedChanges:false,
    workbenchConfig:null,
    processes:{},
    appToProcess:{},
    portProxyMap:{}
}


const reducer = createReducer(
    initalState,
    on(CodeEditorActions.SetRepo,(state,{repo}) => {
        return {
            ...state,
            repo:repo,
        }
    }),
    on(CodeEditorActions.CloseTab,(state,{tab}) => {
        if (!(tab.path in state.openTabs))
            return state;

        let openTabs = {...state.openTabs}
        delete openTabs[tab.path];

        if(state.focusedTab === tab)
            return {...state,openTabs:openTabs,focusedTab:Object.values(openTabs)[0]}

        return {...state,openTabs:openTabs};
    }),
    on(CodeEditorActions.OpenTab,(state,{tab}) => {
        return {
            ...state,
            openTabs:{...state.openTabs,[tab.path]:tab}
        }
    }),
    on(CodeEditorActions.FocusTab,(state,{tab}) => {
        return {
            ...state,
            focusedTab:tab
        }
    }),
    on(CodeEditorActions.ConnectToEditWebsocketSuccess,(state,action) => {
        return {
            ...state,
            editWebsocketConnected:true
        }
    }),
    on(CodeEditorActions.ConnectToEditWebsocketError,(state,action) => {
        return {
            ...state,
            editWebsocketConnected:false
        }
    }),
    on(CodeEditorActions.SetTabModified,(state,{tab}) => {

        const openTabs = {...state.openTabs}

        openTabs[tab.path] = tab;

        let focusedtab = state.focusedTab
        if(tab === state.focusedTab)
            focusedtab = tab
        let unsavedChanges = false;
        for(const k in openTabs) {
            if(openTabs[k].modified) {
                unsavedChanges = true;
                break;
            }
        }
            
        return {
            ...state,
            openTabs:openTabs,
            unsavedChanges:unsavedChanges,
            focusedTab:focusedtab
        }
    }),
    on(CodeEditorActions.Clear,(state) => {
        return {...initalState};
    }),
    on(CodeEditorActions.SetFiles,(state,{files}) => {
        return {
            ...state,
            files:files
        }
    }),
    on(CodeEditorActions.SetGitStatus,(state,{status}) => {
        return {
            ...state,
            git_status:status
        }
    }),
    on(CodeEditorActions.ProcessStarted,(state,{process}) => {
        return {
            ...state,
            processes:{
                ...state.processes,
                [process.pid]:process
            }
        }
    }),
    on(CodeEditorActions.ProcessExited,(state,{pid}) => {
        const processes = {...state.processes}
        const appToProcess = {...state.appToProcess}
        const app = Object.keys(state.appToProcess).find((key) => state.appToProcess[key] === pid)
        if (app) {
            delete appToProcess[app]
        }

        delete processes[pid]
        return {
            ...state,
            processes:processes,
            appToProcess:appToProcess
        }
    }),
    on(CodeEditorActions.ProcessPortsChanged,(state,{pid,ports}) => {
        if (pid in state.processes) {
            const process = {...state.processes[pid]}
            process.ports = ports
            return {
                ...state,
                processes:{
                    ...state.processes,
                    [pid]:process
                }
            }
        } else {
            //
            return state;
        }
    }),
    on(CodeEditorActions.ChildProcessStarted,(state,{childProcess}) => {
        const process = {...state.processes[childProcess.ppid]}
        process.children[childProcess.pid] = childProcess
        return {
            ...state,
            processes:{
                ...state.processes,
                [childProcess.ppid]:process
            }
        }
    }),
    on(CodeEditorActions.ChildProcessExited,(state,{pid,ppid}) => {
        const process = {...state.processes[ppid]}
        delete process.children[pid]
        return {
            ...state,
            processes:{
                ...state.processes,
                [ppid]:process
            }
        }
    }),
    on(CodeEditorActions.SetWorkBenchConfig,(state,{config}) => {
        return {
            ...state,
            workbenchConfig:config
        }
    }),
    on(CodeEditorActions.StartAppOrServiceSuccess,(state,{name, process}) => {
        return {
            ...state,
            appToProcess:{
                ...state.appToProcess,
                [name]:process.pid
            }
        }
    }),
    on(CodeEditorActions.ProcessProxyOpened,(state,{pid, port, url}) => {
        const portProxyMap = {...state.portProxyMap};

        return {
            ...state,
            portProxyMap:{
                ...state.portProxyMap,
                [pid]:{
                    ...(state.portProxyMap[pid] || {}),
                    [port]:url
                }
            }
        }
    }),
    on(CodeEditorActions.ProcessProxyClosed, (state,{pid, port}) => {

        const processPorts = {...(state.portProxyMap[pid] || {})}
        delete processPorts[port]

        return {
            ...state,
            portProxyMap:{
                ...state.portProxyMap,
                [pid]:processPorts
            }
        }
    })
)

export function codeEditorReducer(state:CodeEditorState,action:Action) {
    return reducer(state,action);
}