import { Injectable } from '@angular/core';
import {ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot, UrlTree} from '@angular/router';
import { Observable } from 'rxjs';
import { map,} from 'rxjs/operators';
import { CodeEditorPageComponent } from './code-editor-page.component';




@Injectable()
export class CanCodeEditorPageDeactivate implements CanDeactivate<CodeEditorPageComponent> {
    canDeactivate(
        component: CodeEditorPageComponent, 
        currentRoute: ActivatedRouteSnapshot, 
        currentState: RouterStateSnapshot, 
        nextState?: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
        return component.unsavedChanges$.pipe(
            map((value) => value ? confirm('Are you sure you want to leave this page? Changes may not be saved') : true )
        )
    }

}