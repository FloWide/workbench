import { Injectable, Inject } from '@angular/core';
import { from, BehaviorSubject, of, combineLatest } from 'rxjs';
import {concatMap, tap, filter, switchMap, map} from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { APP_BASE_HREF } from '@angular/common';
import { AppState, UserActions } from '@core/store';
import { Logger } from 'src/app/utils/logger';
import {KeycloakEventType, KeycloakService} from 'keycloak-angular';
import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeycloakProfile } from 'keycloak-js';




@Injectable({
    providedIn:'root'
})
export class AuthenticationService {

    private _loggedIn: boolean = false

    private http: HttpClient = null;

    constructor(
        private keycloak: KeycloakService,
        private store:Store<AppState>,
        handler: HttpBackend,
        @Inject(APP_BASE_HREF) private baseHref:string
    ) {
        this.http = new HttpClient(handler);
        this.localAuthSetup()
        Logger.logMessage(this.keycloak.getKeycloakInstance());
    }

    get loggedIn() {
        return this._loggedIn
    }

    get isAuthenticated$() {
        return from(this.keycloak.isLoggedIn())
    }

    accessToken$ = new BehaviorSubject<string>('');

    getUser(forceReload: boolean = false) {
        return from(this.keycloak.loadUserProfile(forceReload)).pipe(
            tap((profile) => {
                const roles = this.keycloak.getUserRoles()
                Logger.logMessage("User profile",profile)
                this.store.dispatch(UserActions.SetUserProfile({user:{...profile,roles:roles}}))
            })
        )
    }
    
    getAccessToken() {
        return from(this.keycloak.getToken()).pipe(
            tap((token) => {
                this.store.dispatch(UserActions.SetUserAccessToken({token:token}))
                this.accessToken$.next(token);
            })
        )
    }

    login(redirectPath: string = '/') {
        const loginComplete$ = from(this.keycloak.login({
            redirectUri:`${window.location.origin}${this.baseHref}${redirectPath}`
        })).pipe(
            concatMap(() => {
                return combineLatest([
                    this.getAccessToken(),
                    this.getUser(),
                    this.isAuthenticated$
                ])
            })
        )
    }

    logout() {
        this.keycloak.logout()
    }

    directGrantLogin(username: string, password: string) {
        const kc = this.keycloak.getKeycloakInstance();
        return this.http.post(
            `${kc.authServerUrl}/realms/${kc.realm}/protocol/openid-connect/token`,
            new HttpParams()
            .set("username",username)
            .set("password",password)
            .set("grant_type","password")
            .set("client_id",kc.clientId),
            {
                headers:new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded')
            }
        ).pipe(
            switchMap((data: Record<string,string>) => {
                this.store.dispatch(UserActions.SetUserAccessToken({token:data["access_token"]}))
                this.accessToken$.next(data["access_token"]);
                return this.http.get(
                    `${kc.authServerUrl}/realms/${kc.realm}/account`,
                    {
                        headers:new HttpHeaders()
                            .set("Authorization",`Bearer ${data["access_token"]}`)
                            .set("Accept","application/json")
                    }
                ).pipe(
                    map((userData) => [data["access_token"],userData,data["expires_in"]])
                )
            }),
            tap(([token,userdata,expires_in]: [string,KeycloakProfile,number]) => {
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                const roles = tokenData?.resource_access?.["flowide-api"]?.roles;
                this.store.dispatch(UserActions.SetUserProfile({
                    user:{
                        roles:roles,
                        ...userdata
                    }
                }));
            })
        );
    }

    private localAuthSetup() {
        this.isAuthenticated$.pipe(
            concatMap(loggedIn => {
                if(loggedIn) {
                    return combineLatest([
                        this.getAccessToken(),
                        this.getUser()
                    ])
                } else {
                    return of(loggedIn);
                }
            })
        ).subscribe((response) => {
            this._loggedIn = !!response;
        });

        this.keycloak.keycloakEvents$.pipe(
            filter((event) => event.type === KeycloakEventType.OnTokenExpired),
            switchMap(() => from(this.keycloak.updateToken(20))),
            switchMap(() => this.getAccessToken())
        ).subscribe(() => {
            Logger.logMessage("Token refreshed")
        });
    }

}