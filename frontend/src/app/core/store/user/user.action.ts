import { createAction, props } from "@ngrx/store";
import { UserProfile } from "@core/index";
import { UserModel, Users } from "@core/services/user/user.model";


export namespace UserActions {

    export const SetUserProfile = createAction('[UserAction] Set User Profile',props<{user:UserProfile}>());
    export const SetUserAccessToken = createAction('[UserAction] Set User Access Token',props<{token:string}>());

    export const GetUsers = createAction('[UserAction] Get Users');
    export const GetUsersSuccess = createAction('[UserAction] Get Users success',props<{users:Users}>());
    export const GetUsersError = createAction('[UserAction] Get Users error',props<{message:string}>());

    export const GetMe = createAction('[UserAction] Get Me');
    export const GetMeSuccess = createAction('[UserAction] Get Me success',props<{user:UserModel}>());
    export const GetMeError = createAction('[UserAction] Get Me error',props<{message:string}>());

}