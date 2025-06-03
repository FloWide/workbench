import { PythonServiceModel, PythonServices } from "@core/services/python-service/python-service.model";
import { createAction, props } from "@ngrx/store";




export namespace PythonServiceActions {


    export const GetServices = createAction('[PYTHON SERVICE] Get Services');
    export const GetServicesSuccess = createAction('[PYTHON SERVICE] Get Services Success',props<{services:PythonServices}>());
    export const GetServicesError = createAction('[PYTHON SERVICE] Get Services Error',props<{message:string}>());

    export const GetService = createAction('[PYTHON SERVICE] Get Service',props<{id: number}>());
    export const GetServiceSuccess = createAction('[PYTHON SERVICE] Get Service Success',props<{service:PythonServiceModel}>());
    export const GetServiceError = createAction('[PYTHON SERVICE] Get Service Error',props<{message:string}>());

    export const GetServiceLogs = createAction('[PYTHON SERVICE] Get Service Logs',props<{id: number,limit?:number}>());
    export const GetServiceLogsSuccess = createAction('[PYTHON SERVICE] Get Service Logs Success',props<{id: number,logs:string}>());
    export const GetServiceLogsError = createAction('[PYTHON SERVICE] Get Service Logs Error',props<{id: number,message:string}>());

    export const EnableService = createAction('[PYTHON SERVICE] Enable service',props<{id: number}>());
    export const EnableServiceSuccess = createAction('[PYTHON SERVICE] Enable service Success',props<{service:PythonServiceModel}>());
    export const EnableServiceError = createAction('[PYTHON SERVICE] Enable service Error',props<{message:string}>());

    export const DisableService = createAction('[PYTHON SERVICE] Disable service',props<{id: number}>());
    export const DisableServiceSuccess = createAction('[PYTHON SERVICE] Disable service Success',props<{service:PythonServiceModel}>());
    export const DisableServiceError = createAction('[PYTHON SERVICE] Disable service Error',props<{message:string}>());

    export const RestartService = createAction('[PYTHON SERVICE] Restart service',props<{id: number}>());
    export const RestartServiceSuccess = createAction('[PYTHON SERVICE] Restart service Success',props<{service:PythonServiceModel}>());
    export const RestartServiceError = createAction('[PYTHON SERVICE] Restart service Error',props<{message:string}>());
}