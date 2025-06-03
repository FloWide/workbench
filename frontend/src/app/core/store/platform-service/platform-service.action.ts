import { PlatformService } from "@core/services/platform-service/platform-service.model";
import { createAction, props } from "@ngrx/store";



export namespace PlatformServiceActions {

    export const GetServices = createAction('[PLATFORM SERVICE] Get Services');
    export const GetServicesSuccess = createAction('[PLATFORM SERVICE] Get Services Success',props<{services:PlatformService[]}>());
    export const GetServicesError = createAction('[PLATFORM SERVICE] Get Services Error',props<{message:string}>());

    export const GetService = createAction('[PLATFORM SERVICE] Get Service',props<{id: string}>());
    export const GetServiceSuccess = createAction('[PLATFORM SERVICE] Get Service Success',props<{service:PlatformService}>());
    export const GetServiceError = createAction('[PLATFORM SERVICE] Get Service Error',props<{message:string}>());

    export const GetServiceLogs = createAction('[PLATFORM SERVICE] Get Service Logs',props<{id: string,limit?:number}>());
    export const GetServiceLogsSuccess = createAction('[PLATFORM SERVICE] Get Service Logs Success',props<{id: string,logs:string}>());
    export const GetServiceLogsError = createAction('[PLATFORM SERVICE] Get Service Logs Error',props<{id: string,message:string}>());
}