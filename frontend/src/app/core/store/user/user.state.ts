import {UserProfile} from '@core/index';
import { UserModel, Users } from '@core/services/user/user.model';
import { createReducer, on, Action } from '@ngrx/store';
import { UserActions } from './user.action';


export interface UserState {
    userProfile:UserProfile;
    accessToken:string;
    users: Users;
    me: UserModel;
}


const initalState:UserState = {
    userProfile: null,
    accessToken:null,
    users:null,
    me:null
}

const reducer = createReducer(
    initalState,
    on(UserActions.SetUserProfile, (state,{user}) => ({...state,userProfile:user}) ),
    on(UserActions.SetUserAccessToken,(state,{token}) => ({...state,accessToken:token})),
    on(UserActions.GetUsersSuccess,(state,{users}) => ({...state,users:users})),
    on(UserActions.GetMeSuccess,(state,{user}) => ({...state,me:user}))
);

export function userReducer(state: UserState | undefined,action: Action ) {
    return reducer(state,action);
}