import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppState, Select, UserProfile } from '../core';

@Directive({
  selector: '[requiresPermissions]'
})
export class RequiresPermissionsDirective implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  private user: UserProfile;

  private permissions: string[] = [];

  constructor(
    private store: Store<AppState>,
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
  ) { }

  @Input()
  set requiresPermissions(val: string[]) {
    this.permissions = val;
    this.updateView();
  }

  ngOnInit(): void {
    this.store.select(Select.user).pipe(
      takeUntil(this.destroy$)
    ).subscribe((user) => {
      this.user = user;
      this.updateView();
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  private updateView() {
    if (this.checkPermission()) {
        this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  private checkPermission() {
    return this.permissions.every((role) => this.user?.roles.includes(role));
  }

}
