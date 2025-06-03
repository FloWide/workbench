import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CustomHttpService } from "../http/custom-http.service";
import { GitCommitModel, GitState, GitStatus } from "./repo.model";



@Injectable({
    providedIn:'root'
})
export class RepositoryGitService {

    constructor(
        private http: CustomHttpService 
    ) {}

    getGitState(id: number): Observable<GitState> {
        return this.http.get(`/repo/${id}/git/state`)
    }

    getGitStatus(id: number): Observable<GitStatus> {
        return this.http.get(`/repo/${id}/git/status`);
    }

    getGitTags(id: number): Observable<string[]> {
        return this.http.get(`/repo/${id}/git/tags`)
    }

    commit(id:number,model: GitCommitModel) {
        return this.http.post(`/repo/${id}/git/commit`,model)
    }
}