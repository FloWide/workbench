
import {Injectable} from '@angular/core'

import {CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree} from '@angular/router';

import {AuthenticationService} from './auth.service';
import {tap } from 'rxjs/operators';
import {KeycloakAuthGuard, KeycloakService} from 'keycloak-angular'

@Injectable({
    providedIn:'root'
})
export class AuthenticationGuard implements CanActivate {


    constructor(private authService: AuthenticationService,private router:Router) {}

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot){
        return this.authService.isAuthenticated$.pipe(
            tap(loggedIn => {
                if(!loggedIn) {
                    this.authService.login(state.url);
                }
            })
        )
    }
}



@Injectable({
    providedIn:'root'
})
export class RoleGuard extends KeycloakAuthGuard {

    constructor(
        protected readonly router: Router,
        protected readonly keycloak: KeycloakService
      ) {
        super(router, keycloak);
      }


    async isAccessAllowed(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
        const requiredRoles = route.data.roles
        if (!(requiredRoles instanceof Array) || requiredRoles.length === 0) {
            return true;
        }
        
        const allow = requiredRoles.every((role) => this.roles.includes(role));
        if (!allow)
            return this.router.parseUrl('unauthorized')
        else
            return true 
    }

}