import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CustomHttpService } from "../http/custom-http.service";
import { PythonServiceModel, PythonServices } from "./python-service.model";




@Injectable({
    providedIn:'root'
})
export class PythonServicesService {

    constructor(
        private http: CustomHttpService
    ){}
    

    getServices() : Observable<PythonServices> {
        return this.http.get('/service')
    }

    getService(id: number): Observable<PythonServiceModel> {
        return this.http.get(`/service/${id}`)
    }

    getServiceLogs(id: number,limit: number = 100): Observable<string> {
        return this.http.get(`/service/${id}/logs?limit=${limit}`,{
            responseType:'text'
        })
    }

    enableService(id: number): Observable<PythonServiceModel> {
        return this.http.post(`/service/${id}/enable`)
    }

    disableService(id: number): Observable<PythonServiceModel> {
        return this.http.post(`/service/${id}/disable`);
    }

    restartService(id: number) : Observable<PythonServiceModel> {
        return this.http.post(`/service/${id}/restart`)
    }

    
}