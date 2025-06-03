import { Injectable } from "@angular/core";
import { UserService } from "@core/services/user/user.service";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { catchError, map, mergeMap } from "rxjs/operators";
import { UserActions } from "./user.action";



@Injectable()
export class UserEffects {

    constructor(
        private actions$: Actions,
        private userService: UserService
    ) {

    }

    getUsers$ = createEffect(() => {
        return this.actions$.pipe(
            ofType(UserActions.GetUsers),
            mergeMap((action) => {
                return this.userService.getUsers().pipe(
                    map((users) => UserActions.GetUsersSuccess({users:users})),
                    catchError((error) => of(UserActions.GetUsersError({message:error.detail})))
                    
                )
            })
        )
    })

    getMe$ = createEffect(() => {
        return this.actions$.pipe(
            ofType((UserActions.GetMe)),
            mergeMap((action) => {
                return this.userService.getMe().pipe(
                    map((user) => UserActions.GetMeSuccess(({user:user}))),
                    catchError((error) => of(UserActions.GetMeError(({message:error.detail}))))
                )
            })
        )
    })

}