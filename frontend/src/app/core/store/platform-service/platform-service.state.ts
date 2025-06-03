import { PlatformService } from "@core/services/platform-service/platform-service.model";
import { Action, createReducer, on } from "@ngrx/store";
import { PlatformServiceActions } from "./platform-service.action";


export interface PlatformServiceState {
    services: PlatformService[];
}

const initialState: PlatformServiceState = {
    services: []
}


const reducer = createReducer(
    initialState,
    on(PlatformServiceActions.GetServicesSuccess, (state, { services }) => {
        return {
            ...state,
            services: services
        }
    }),
    on(PlatformServiceActions.GetServiceSuccess, (state, { service }) => {
        const newServices = [...state.services]
        const idx = newServices.findIndex((value) => value.id === service.id)
        if (idx !== -1) {
            newServices[idx] = service
        } else {
            newServices.push(service)
        }
        return {
            ...state,
            services: newServices
        }
    })
)

export function platformServicesReducer(state: PlatformServiceState, action: Action) {
    return reducer(state, action);
}