import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CustomHttpService } from "../http/custom-http.service";
import { UserModel, Users } from "./user.model";





@Injectable({
    providedIn:'root'
})
export class UserService {

    constructor(
        private htpp: CustomHttpService
    ){}

    getUsers(): Observable<Users> {
        return this.htpp.get('/user')
    }

    getMe(): Observable<UserModel> {
        return this.htpp.get('/user/me')
    }

}