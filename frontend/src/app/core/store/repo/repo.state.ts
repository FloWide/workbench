import { Repositories } from "@core/services/repo/repo.model";
import { Action, createReducer, on } from "@ngrx/store";
import { RepositoryActions } from "./repo.action";




export interface RepositoryState {
    repos: Repositories
}

const initalState: RepositoryState = {
    repos:[]
}


const reducer = createReducer(
    initalState,
    on(RepositoryActions.GetRepositoriesSuccess,(state,{repos}) => {
        return {
            ...state,
            repos:repos
        }
    }),
    on(RepositoryActions.GetRepositorySuccess,RepositoryActions.CreateRepositorySuccess,(state,{repo}) => {
        const newRepos = [...state.repos]
        const idx = newRepos.findIndex((value) => value.id === repo.id)
        if (idx !== -1) {
            newRepos[idx] = repo
        } else {
            newRepos.push(repo)
        }
        return {
            ...state,
            repos:newRepos
        }
    }),
    on(RepositoryActions.DeleteRepositorySuccess,(state,{id}) => {
        const newRepos = [...state.repos];
        const idx = newRepos.findIndex((value) => value.id === id)
        if (idx !== -1){
            newRepos.splice(idx, 1)
        }
        return {
            ...state,
            repos:newRepos
        }
    })
)


export function repositoryReducer(state: RepositoryState,action: Action) {
    return reducer(state,action);
}