import { Injectable } from "@angular/core";
import { CustomHttpService } from "../http/custom-http.service";
import { Observable } from "rxjs";
import { PlatformService } from "./platform-service.model";



@Injectable({
    providedIn:'root'
})
export class PlatformServicesService {

    constructor(private http: CustomHttpService) {}


    getServices(): Observable<PlatformService[]> {
        return this.http.get('/service/platform')
    }

    getService(id: string): Observable<PlatformService> {
        return this.http.get(`/service/platform/${id}`)
    }

    getServiceLogs(id: string,limit: number = 100): Observable<string> {
        return this.http.get(`/service/platform/${id}/logs?limit=${limit}`,{
            responseType:'text'
        })
    }

}