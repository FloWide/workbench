import { AppState, ScriptModel } from "..";


export namespace Select {


    export const repos = (state: AppState) => state.repos.repos;
    export const repoById = (state: AppState,id: number) => {
        if (!state.repos.repos) return null

        return state.repos.repos.find((value) => value.id === id)
    };

    export const scripts = (state:AppState) => state.scripts.scripts;
    export const scriptById = (state: AppState,id: number): ScriptModel => {
        if (!state.scripts.scripts) 
            return null;

        return state.scripts.scripts.find((value) => value.id === id)
    }

    export const services = (state: AppState) => state.services.services;
    export const serviceById = (state:AppState,id: number) => {
        if (!state.services.services) 
            return null;

        return state.services.services.find((value) => value.id === id)
    }

    export const platformServices = (state: AppState) => state.platformServices.services;
    export const platformServiceById = (state: AppState,id: string) => {
        if (!state.platformServices.services) 
            return null;

        return state.platformServices.services.find((value) => value.id === id)
    }

    export const users = (state: AppState) => state.user.users;
    export const me = (state:AppState) => state.user.me;

    export const connectors = (state:AppState) => state.backend.dcmConnectors;
    export const selectedDcmConnection = (state:AppState) => state.backend.selectedDcmConnector;
    export const apiUrl = (state:AppState) => state.backend.backend;
    
    export const user = (state:AppState) => state.user.userProfile;
    export const accessToken = (state:AppState) => state.user.accessToken;

    export const editingRepo = (state:AppState) => state.codeEditor.repo;
    export const repofiles = (state:AppState) => state.codeEditor.files;
    export const openCodeTabs = (state:AppState) => state.codeEditor.openTabs;
    export const focusedCodeTab = (state:AppState) => state.codeEditor.focusedTab;
    export const gitStatus = (state:AppState) => state.codeEditor.git_status;
    export const editWebsocketState = (state:AppState) => state.codeEditor.editWebsocketConnected;
    export const codeEditorUnsavedChanges = (state:AppState) => state.codeEditor.unsavedChanges;
    export const processes = (state: AppState) => state.codeEditor.processes
    export const workbenchConfig = (state: AppState) => state.codeEditor.workbenchConfig;
    export const appsToProcesses = (state: AppState) => state.codeEditor.appToProcess;
    export const processProxies = (state: AppState) => state.codeEditor.portProxyMap;
}
