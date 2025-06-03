import { Component, OnDestroy, OnInit } from '@angular/core';
import { PlatformService } from '@core/services/platform-service/platform-service.model';
import { AppState, Select } from '@core/store';
import { PlatformServiceActions } from '@core/store/platform-service/platform-service.action';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'platform-services',
  templateUrl: './platform-services.component.html',
  styleUrls: ['./platform-services.component.scss']
})
export class PlatformServicesComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject();

  platformServices: PlatformService[] = [];

  constructor(
    private store: Store<AppState>,
  ) { }
  

  ngOnInit(): void {
    this.store.dispatch(PlatformServiceActions.GetServices());

    this.store.select(Select.platformServices).pipe(
      takeUntil(this.destroy$)
    ).subscribe((services) => {
      this.platformServices = services;
    });

  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  trackBy(index: number, service: PlatformService) {
    return service.id;
  }

}
