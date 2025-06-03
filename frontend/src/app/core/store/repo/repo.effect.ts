import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { RepositoryService } from "@core/services/repo/repo.service";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { RepositoryActions } from "./repo.action";
import { ReleaseService } from "@core/services/release/release.service";



@Injectable()
export class RepositoryEffects {


    constructor(
        private repoService: RepositoryService,
        private releaseService: ReleaseService,
        private actions$: Actions
    ) {}
    

    getRepositories$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.GetRepositories),
            switchMap((action) => {
                return this.repoService.getRepos().pipe(
                    map((repos) => RepositoryActions.GetRepositoriesSuccess({repos:repos})),
                    catchError((err) => of(RepositoryActions.GetRepositoriesError({message:err.message})))
                )
            })
        )
    });

    getRepository$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.GetRepository),
            switchMap((action) => {
                return this.repoService.getRepo(action.id).pipe(
                    map((repo) => RepositoryActions.GetRepositorySuccess({repo:repo})),
                    catchError((err) => of(RepositoryActions.GetRepositoryError({message:err.message})))
                )
            })
        )
    });

    createRepository$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.CreateRepository),
            switchMap((action) => {
                return this.repoService.createRepo(action.model).pipe(
                    map((repo) => RepositoryActions.CreateRepositorySuccess({repo:repo})),
                    catchError((err) => of(RepositoryActions.CreateRepositoryError({message:err.message})))
                )
            })
        )
    });

    deleteRepository$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.DeleteRepository),
            switchMap((action) => {
                return this.repoService.deleteRepo(action.id).pipe(
                    map(() => RepositoryActions.DeleteRepositorySuccess({id:action.id})),
                    catchError((err) => of(RepositoryActions.DeleteRepositoryError({message:err.message})))
                )
            })
        )
    });

    createRepositoryRelease$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.CreateRepositoryRelease),
            switchMap((action) => {
                return this.releaseService.createRelease(action.args).pipe(
                    map((release) => RepositoryActions.CreateRepositoryReleaseSuccess({release:release})),
                    catchError((err: HttpErrorResponse) => of(RepositoryActions.CreateRepositoryReleaseError({args:action.args,message:err.error.detail})))
                )
            })
        )
    });

    deleteRepositoryRelease$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(RepositoryActions.DeleteRepositoryRelease),
            switchMap((action) => {
                return this.releaseService.deleteRelease(action.id).pipe(
                    map(() => RepositoryActions.DeleteRepositoryReleaseSuccess({id:action.id,})),
                    catchError((err: HttpErrorResponse) => of(RepositoryActions.DeleteRepositoryReleaseError({id:action.id,message:err.error.detail})))
                )
            })
        )
    })
}