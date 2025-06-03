import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { PlatformService } from '@core/services/platform-service/platform-service.model';
import { AppState, Select } from '@core/store';
import { PlatformServiceActions } from '@core/store/platform-service/platform-service.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import * as moment from 'moment';
import { interval, Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

@Component({
  selector: 'platform-service-button',
  templateUrl: './platform-service-button.component.html',
  styleUrls: ['./platform-service-button.component.scss']
})
export class PlatformServiceButtonComponent implements OnInit, OnDestroy {

  @Input() service: PlatformService;

  logs: string = ""

  isExpanded: boolean = false;

  private destroy$ = new Subject();

  constructor(
    private store: Store<AppState>,
    private actions$: Actions
  ) { }
  

  ngOnInit(): void {
    this.actions$.pipe(
      ofType(PlatformServiceActions.GetServiceLogsSuccess),
      takeUntil(this.destroy$),
      filter((action) => action.id === this.service.id)
    ).subscribe((action) => {
      this.logs = action.logs;
    });
    
    interval(10000).pipe(
      takeUntil(this.destroy$),
      filter(() => this.isExpanded && this.service.status === 'running')
    ).subscribe(() => {
      this.store.dispatch(PlatformServiceActions.GetService({id:this.service.id}));
      this.store.dispatch(PlatformServiceActions.GetServiceLogs({id:this.service.id,limit:100}));
    });

    this.store.select(Select.platformServiceById, this.service.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe((service) => {
      this.service = service;
    });

  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  getStateColor(state: PlatformService['status']) {
    switch (state) {
      case 'running':
        return '#00A676'
      case 'restarting':
        return '#FFC107'
      default:
        return 'grey'
    }
  }

  getRunningSince() {
    if (!this.service?.started_at) return '';
    return moment(this.service.started_at).fromNow();
  }

  expandedChanged(e: boolean) {
    this.isExpanded = e;
    if(this.isExpanded)
      this.store.dispatch(PlatformServiceActions.GetServiceLogs({id:this.service.id,limit:100}));
  }

}
