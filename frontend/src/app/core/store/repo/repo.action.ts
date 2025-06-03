import { CreateReleaseModel, Release } from "@core/services/release/release.model";
import { Repositories, RepositoryCreationModel, RepositoryModel } from "@core/services/repo/repo.model";
import { createAction, props } from "@ngrx/store";



export namespace RepositoryActions {


    export const GetRepositories = createAction('[REPOSITORY] Get Repositories');
    export const GetRepositoriesSuccess = createAction('[REPOSITORY] Get Repositories Success',props<{repos:Repositories}>());
    export const GetRepositoriesError = createAction('[REPOSITORY] Get Repositories Error',props<{message:string}>());

    export const GetRepository = createAction('[REPOSITORY] Get Repository',props<{id:number}>());
    export const GetRepositorySuccess = createAction('[REPOSITORY] Get Repository Success',props<{repo:RepositoryModel}>());
    export const GetRepositoryError = createAction('[REPOSITORY] Get Repository Error',props<{message:string}>());

    export const CreateRepository = createAction('[REPOSITORY] Create Repository',props<{model:RepositoryCreationModel}>());
    export const CreateRepositorySuccess = createAction('[REPOSITORY] Create Repository Success',props<{repo:RepositoryModel}>());
    export const CreateRepositoryError = createAction('[REPOSITORY] Create Repository Error',props<{message:string}>());

    export const DeleteRepository = createAction('[REPOSITORY] Delete Repository',props<{id:number}>());
    export const DeleteRepositorySuccess = createAction('[REPOSITORY] Delete Repository Success',props<{id:number}>());
    export const DeleteRepositoryError = createAction('[REPOSITORY] Delete Repository Error',props<{message:string}>());

    export const CreateRepositoryRelease = createAction('[REPOSITORY] Create Repository Release',props<{args: CreateReleaseModel}>());
    export const CreateRepositoryReleaseSuccess = createAction('[REPOSITORY] Create Repository Release Success',props<{release: Release}>());
    export const CreateRepositoryReleaseError = createAction('[REPOSITORY] Create Repository Release Error',props<{args: CreateReleaseModel, message:string}>());

    export const DeleteRepositoryRelease = createAction('[REPOSITORY] Delete Repository Release',props<{id:number}>());
    export const DeleteRepositoryReleaseSuccess = createAction('[REPOSITORY] Delete Repository Release Success',props<{id:number}>());
    export const DeleteRepositoryReleaseError = createAction('[REPOSITORY] Delete Repository Release Error',props<{id:number, message:string}>());

}