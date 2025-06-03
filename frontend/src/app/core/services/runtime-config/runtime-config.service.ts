import {Injectable} from '@angular/core';
import {HttpClient,HttpBackend} from '@angular/common/http';
import {BackendConfig} from './runtime-config.model';
import { forkJoin } from 'rxjs';
import { AppState } from "@core/index";
import { Store } from '@ngrx/store';
import { BackendActions } from '@core/store/backend';
import {KeycloakConfig} from 'keycloak-js'

@Injectable({
    providedIn:'root'
})
export class RuntimeConfigService {
    
    authConfig:KeycloakConfig;

    backendConfig:BackendConfig;

    private http:HttpClient = null;

    constructor(private handler: HttpBackend,private store:Store<AppState>) {
        //this way it bypasses all interceptors
        this.http = new HttpClient(handler);
    }

    loadConfig() {
        return forkJoin(
            this.http.get<KeycloakConfig>('./assets/auth_config.json'),
            this.http.get<BackendConfig>('./assets/connector_list.json'),
        ).toPromise().then( data => {
            this.authConfig = data[0];
            this.backendConfig = data[1];
            this.store.dispatch(BackendActions.SetConnectors({connectors:this.backendConfig.dcm_connections}));
            this.store.dispatch(BackendActions.SetBackend({api:this.backendConfig.api}));

            if(this.backendConfig.dcm_connections.length > 0)
                this.store.dispatch(BackendActions.SelectDcmConnection({dcm:this.backendConfig.dcm_connections[0]}));

            return true;
        } )
    }
}