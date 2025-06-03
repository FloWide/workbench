import { ActionReducerMap, createAction } from "@ngrx/store";
import { backendReducer, BackendState } from "./backend";
import { codeEditorReducer, CodeEditorState } from "./code-editor/code-editor.state";
import { pythonServicesReducer, PythonServiceState } from "./python-service/python-service.state";
import { repositoryReducer, RepositoryState } from "./repo/repo.state";
import { scriptReducer, ScriptState } from "./script/script.state";
import { userReducer, UserState } from "./user";
import { platformServicesReducer, PlatformServiceState } from "./platform-service/platform-service.state";


export interface AppState {
    backend:BackendState;
    user:UserState;
    codeEditor:CodeEditorState; 
    repos:RepositoryState;
    scripts:ScriptState;
    services:PythonServiceState;
    platformServices:PlatformServiceState;

};

export const appReducers : ActionReducerMap<AppState> = {
    backend:backendReducer,
    user:userReducer,
    codeEditor:codeEditorReducer,
    repos:repositoryReducer,
    scripts:scriptReducer,
    services:pythonServicesReducer,
    platformServices:platformServicesReducer
};