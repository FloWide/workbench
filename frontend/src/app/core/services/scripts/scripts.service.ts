import { Injectable } from '@angular/core';
import { CustomHttpService } from '../http/custom-http.service';
import { Observable} from 'rxjs';
import { ScriptModel, Scripts } from './scripts.model';
import { AppState, Select } from '@core/store';
import { Store } from '@ngrx/store';


@Injectable({
    providedIn:'root'
})
export class ScriptsService {

    private token: string = null;

    constructor(
        private http:CustomHttpService,
        private store: Store<AppState>
    ) {
        this.store.select(Select.accessToken).subscribe((token) => this.token = token);
    }

    getScripts() : Observable<Scripts> {
        return this.http.get('/app')
    }

    getScript(id: number) : Observable<ScriptModel> {
        return this.http.get(`/app/${id}`)
    }

    logo(id: number): string {
        return `${this.http.API.api}/app/${id}/logo?token=${this.token}`
    }

}