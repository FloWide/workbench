import {Injectable} from '@angular/core';
import {Store} from '@ngrx/store';
import { Observable, BehaviorSubject} from 'rxjs';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {catchError} from 'rxjs/operators';
import { RuntimeConfigService } from '../runtime-config/runtime-config.service';
import {AppState } from '@core/store/app.state';
import { Select, } from '@core/store/app.selectors';
import { APIModel } from '../runtime-config';


@Injectable({
    providedIn:'root'
})
export class CustomHttpService {

    private api:APIModel = null;

    private _websocketUrl: string = '';

    constructor(private store:Store<AppState>,private http: HttpClient,private config:RuntimeConfigService) {
        this.store.select(Select.apiUrl).subscribe( backend => {
            if(backend){
                this.api = backend
                this._websocketUrl = this.baseUrlToWebsocketUrl(this.api.api);
            }
            else{
                this.api = {
                    api:'',
                    streamlit_apps:'',
                };
                this._websocketUrl = '';
            }
        });
    }

    get<T>(path: string,options? : any) : Observable<T> {
        return this.http.get<T>(`${this.api.api}${path}`,options).pipe(
            catchError(this.errorHandler)
        );
    }

    post<T>(path : string,body? : any,options? : any,edge: boolean = false) : Observable<T> {
        return this.http.post(`${this.api.api}${path}`,body,options).pipe(
            catchError(this.errorHandler)
        );
    }

    put<T>(path : string,body? : any,options? : any,edge: boolean = false) : Observable<T> {
        return this.http.put(`${this.api.api}${path}`,body,options).pipe(
            catchError(this.errorHandler)
        );
    }

    delete<T>(path: string,options? : any,edge: boolean = false) : Observable<T> {
        return this.http.delete<T>(`${this.api.api}${path}`,options).pipe(
            catchError(this.errorHandler)
        );
    }

    get defaultClient() : HttpClient {
        return this.http;
    }

    get websocketUrl() {
        return this._websocketUrl
    }

    get API() : APIModel {
        return this.api;
    }

    private errorHandler(error : HttpErrorResponse) : Observable<any> {
        console.error(`[HTTP ERROR] ${error.error?.message ?? error.message}  ${error.status} (${error.statusText})`);
        throw error;
    }

    private baseUrlToWebsocketUrl(url:string) : string {
        return url
                .replace('http://','ws://')
                .replace('https://','wss://')
    }
}