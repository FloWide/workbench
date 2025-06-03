import { Injectable } from "@angular/core";
import { ScriptsService } from "@core/services";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { ScriptActions } from "./script.action";




@Injectable()
export class ScriptEffects {


    constructor(
        private scriptService: ScriptsService,
        private actions$: Actions,
    ) {

    }


    getScripts$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(ScriptActions.GetScripts),
            switchMap((action) => {
                return this.scriptService.getScripts().pipe(
                    map((scripts) => ScriptActions.GetScriptsSuccess({scripts:scripts})),
                    catchError((err) => of(ScriptActions.GetScriptsError({message:err.error})))
                )
            })
        )
    });

    getScript$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(ScriptActions.GetScript),
            switchMap((action) => {
                return this.scriptService.getScript(action.id).pipe(
                    map((script) => ScriptActions.GetScriptSuccess({script:script})),
                    catchError((err) => of(ScriptActions.GetScriptError({message:err.error})))
                )
            })
        )
    });
}