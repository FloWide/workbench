import { Injectable } from "@angular/core";
import { CustomHttpService } from "../http/custom-http.service";
import { CreateReleaseModel, Release } from "./release.model";
import { Observable } from "rxjs";



@Injectable({
    providedIn:'root'
})
export class ReleaseService {

    constructor(private http: CustomHttpService) {}


    getReleases(): Observable<Release[]> {
        return this.http.get('/release')
    }

    getReleaseForRepo(repoId: number) : Observable<Release[]> {
        return this.http.get(`/release?repo_id=${repoId}`)
    }
    createRelease(args: CreateReleaseModel) : Observable<Release> {
        return this.http.post(`/release`, args)
    }

    deleteRelease(id: number): Observable<null> {
        return this.http.delete(`/release/${id}`)
    }
}