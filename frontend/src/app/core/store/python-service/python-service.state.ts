import { PythonServices } from "@core/services/python-service/python-service.model";
import { Action, createReducer, on } from "@ngrx/store";
import { PythonServiceActions } from "./python-service.action";



export interface PythonServiceState  {
    services:PythonServices
}

const initialState: PythonServiceState = {
    services:[]
}


const reducer = createReducer(
    initialState,
    on(PythonServiceActions.GetServicesSuccess,(state,{services}) => {
        return {
            ...state,
            services:services
        }
    }),
    on(
        PythonServiceActions.GetServiceSuccess,
        PythonServiceActions.EnableServiceSuccess,
        PythonServiceActions.DisableServiceSuccess,
        PythonServiceActions.RestartServiceSuccess,
        (state,{service}) => {
            const newServices = [...state.services]
            const idx = newServices.findIndex((value) => value.id === service.id)
            if (idx !== -1) {
                newServices[idx] = service
            } else {
                newServices.push(service)
            }
            return {
                ...state,
                services:newServices
            }
        }
    )
)

export function pythonServicesReducer(state: PythonServiceState,action: Action) {
    return reducer(state,action);
}