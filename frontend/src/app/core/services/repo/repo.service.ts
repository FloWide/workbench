import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";
import { CustomHttpService } from "../http/custom-http.service";
import { Repositories, RepositoryCreationModel, RepositoryModel } from "./repo.model";
import { HttpContext, HttpEvent, HttpEventType, HttpRequest, HttpResponse } from "@angular/common/http";
import { filter, map, tap } from "rxjs/operators";
import { NGX_LOADING_BAR_IGNORED } from "@ngx-loading-bar/http-client";




@Injectable({
    providedIn:'root'
})
export class RepositoryService {

    constructor(
        private http: CustomHttpService,
        private ngZone: NgZone
    ) {}
    
    
    getRepos(): Observable<Repositories> {
        return this.http.get('/repo');
    }

    getRepo(id: number) : Observable<RepositoryModel> {
        return this.http.get(`/repo/${id}`);
    }

    deleteRepo(id: number) : Observable<void> {
        return this.http.delete(`/repo/${id}`);
    }

    createRepo(creationModel: RepositoryCreationModel): Observable<RepositoryModel> {
        return this.http.post(`/repo`,creationModel);
    }

    getFile(id: number, path: string): Observable<HttpEvent<Blob>> {
        return this.http.get(`/repo/${id}/content/${encodeURIComponent(path)}`,{responseType:'blob', observe: 'events', reportProgress: true})
    }

    uploadFile(id: number, path: string, file: File): Observable<HttpEvent<void>> {
        const formData = new FormData();
        formData.append('file',file);
        return this.http.post(`/repo/${id}/content/${encodeURIComponent(path)}`,formData,{reportProgress:true, observe:'events'})
    }

}