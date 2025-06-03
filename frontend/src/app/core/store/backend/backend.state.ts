
import { ConnectorModel } from "@core/index";
import { APIModel } from "@core/services";
import { createReducer, on, Action } from "@ngrx/store";
import { BackendActions } from "./backend.action";



export interface BackendState {
    dcmConnectors:ConnectorModel[];
    backend:APIModel;
    selectedDcmConnector:ConnectorModel;
};

const initialState: BackendState = {
    dcmConnectors:[],
    backend:null,
    selectedDcmConnector:null
};

const reducer = createReducer(
    initialState,
    on(BackendActions.SetConnectors,(state,{connectors}) => ({...state,dcmConnectors:connectors})),
    on(BackendActions.SetBackend,(state,{api}) => ({...state,backend:api})),
    on(BackendActions.SelectDcmConnection,(state,{dcm}) => ({...state,selectedDcmConnector:dcm}))
);

export function backendReducer(state: BackendState | undefined,action : Action) {
    return reducer(state,action);
}