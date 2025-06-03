import { Injectable } from "@angular/core";
import { PlatformServicesService } from "@core/services/platform-service/platform-service.service";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { PlatformServiceActions } from "./platform-service.action";
import { catchError, map, switchMap } from "rxjs/operators";
import { of } from "rxjs";



@Injectable()
export class PlatformServiceEffects {

    constructor(
        private platformService: PlatformServicesService,
        private actions$: Actions
    ) {}

    getServices$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(PlatformServiceActions.GetServices),
            switchMap((action) => {
                return this.platformService.getServices().pipe(
                    map((services) => PlatformServiceActions.GetServicesSuccess({services:services}) ),
                    catchError((err) => of(PlatformServiceActions.GetServicesError({message:err.error})))
                )
            })
        )
    });

    getService$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(PlatformServiceActions.GetService),
            switchMap((action) => {
                return this.platformService.getService(action.id).pipe(
                    map((service) => PlatformServiceActions.GetServiceSuccess({service:service}) ),
                    catchError((err) => of(PlatformServiceActions.GetServiceError({message:err.error})))
                )
            })
        )
    });

    getServiceLogs$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(PlatformServiceActions.GetServiceLogs),
            switchMap((action) => {
                return this.platformService.getServiceLogs(action.id,action.limit).pipe(
                    map((logs) => PlatformServiceActions.GetServiceLogsSuccess({logs:logs,id:action.id}) ),
                    catchError((err) => of(PlatformServiceActions.GetServiceLogsError({message:err.error,id:action.id})))
                )
            })
        )
    });

}