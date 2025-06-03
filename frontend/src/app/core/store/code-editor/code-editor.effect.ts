import { Injectable } from "@angular/core";
import { RepositoryGitService } from "@core/services/repo/repo-git.service";
import { act, Actions, createEffect, ofType } from "@ngrx/effects";
import { of, from } from "rxjs";
import { catchError, map, mergeMap, withLatestFrom } from "rxjs/operators";
import { CodeEditorActions } from "./code-edior.action";
import { RepositoryEditService } from "@core/services/repo/repo-edit.service";



@Injectable()
export class CodeEditorEffects {


    constructor(
        private actions$:Actions,
        private editService: RepositoryEditService,
        private gitService: RepositoryGitService
    ) {}

    commitChanges$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.CommitChanges),
            mergeMap((action) => {
                return this.gitService.commit(action.repo,{message:action.commitMsg}).pipe(
                    map(() => CodeEditorActions.CommitChangesSuccess({repo:action.repo})),
                    catchError(() => of(CodeEditorActions.CommitChangesError({repo:action.repo})))
                )
            })
        )
    });

    setRepoFiles$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.SetRepo),
            mergeMap((action) => {
                return from(this.editService.listDirectory()).pipe(
                    map((files) => CodeEditorActions.SetFiles({files:files})),
                    catchError((err) => of(CodeEditorActions.SetFiles({files:[]})))
                )
            })
        )
    });

    setRepoGitStatus$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.SetRepo),
            mergeMap((action) => {
                return from(this.editService.getGitStatus()).pipe(
                    map((status) => CodeEditorActions.SetGitStatus({status:status}))
                )
            })
        )
    });

    startProcess$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.StartProcess),
            mergeMap((action) => {
                return from(this.editService.runProcess(action.params)).pipe(
                    map((proc) => CodeEditorActions.ProcessStarted({process:proc})),
                    catchError((err) => of(null))
                )
            })
        )
    });

    stopProcess$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.StopProcess),
            mergeMap((action) => {
                return from(this.editService.killProcess(action.pid)).pipe(
                    map((data) => CodeEditorActions.ProcessExited({pid:action.pid,data:data}))
                )
            })
        )
    });

    startAppOrService$ = createEffect(() => {
        return this.actions$.pipe(
            ofType((CodeEditorActions.StartAppOrService)),
            mergeMap((action) => {
                return from(this.editService.runAppOrService(action.name)).pipe(
                    map((proc) => CodeEditorActions.StartAppOrServiceSuccess({name:action.name,process:proc})),
                    catchError((err) => of(CodeEditorActions.StartAppOrServiceError({name:action.name, err: err})))
                )
            })
        )
    })

    onStartAppOrService$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(CodeEditorActions.StartAppOrServiceSuccess),
            map((action) => CodeEditorActions.ProcessStarted({process:action.process}))
        )
    })

}