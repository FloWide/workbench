import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { PythonServiceModel, PythonServiceState } from '@core/services/python-service/python-service.model';
import { AppState, Select } from '@core/store';
import { PythonServiceActions } from '@core/store/python-service/python-service.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { interval, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import * as moment from 'moment';
import { UserProfile } from '@core/services';
import { UserModel } from '@core/services/user/user.model';

@Component({
  selector: 'app-service-button',
  templateUrl: './service-button.component.html',
  styleUrls: ['./service-button.component.scss']
})
export class ServiceButtonComponent implements OnInit,OnDestroy {


  private destroy$ = new Subject();

  monacoOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    automaticLayout:true,
    readOnly:true,
    minimap:{
      enabled:false
    }
  }

  private _services: PythonServiceModel[] = []

  private _service: PythonServiceModel = null;

  sortedServices: PythonServiceModel[] = [];

  @Input() set services(value: PythonServiceModel[]) {
    if (!value) return;
    this._services = value;
    this.sortedServices = this._services.sort((a,b) => moment(b.created_at).unix() - moment(a.created_at).unix());
    this.serviceModel = this.sortedServices[0];
  }

  get services() {
    return this._services;
  }

  set serviceModel(value:PythonServiceModel) {
    this._service = value
  };

  get serviceModel() {
    return this._service;
  }

  logs: string = ""

  isExpanded: boolean = false;

  me: UserModel = null;
  constructor(
    private actions$: Actions,
    private store: Store<AppState>
  ) { }
  

  ngOnInit(): void {
    this.actions$.pipe(
      ofType(PythonServiceActions.GetServiceLogsSuccess),
      filter((action) => action.id === this.serviceModel.id)
    ).subscribe((action) => {
      this.logs = action.logs;
    });

    interval(10000).pipe(
      takeUntil(this.destroy$),
      filter(() => this.serviceModel?.enabled && this.isExpanded)
    ).subscribe(() => {
      this.store.dispatch(PythonServiceActions.GetServiceLogs({id:this.serviceModel.id}));
      this.store.dispatch(PythonServiceActions.GetService({id:this.serviceModel.id}));
    });

    this.actions$.pipe(
      ofType(PythonServiceActions.DisableServiceSuccess),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.store.dispatch(PythonServiceActions.GetServiceLogs({id:this.serviceModel.id}))
    });

    this.store.select(Select.me).pipe(
      takeUntil(this.destroy$)
    ).subscribe((me) => {
      this.me = me;
    });

    this.store.select(Select.serviceById,this.serviceModel.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe((service) => {
      this.serviceModel = service;
    })

  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  toggleEnabled(event: MatSlideToggleChange) {
    if (event.checked)
      this.store.dispatch(PythonServiceActions.EnableService({id:this.serviceModel.id}));
    else
      this.store.dispatch(PythonServiceActions.DisableService({id:this.serviceModel.id}));
  }

  expandedChanged(e: boolean) {
    this.isExpanded = e;
    if(this.isExpanded)
      this.store.dispatch(PythonServiceActions.GetServiceLogs({id:this.serviceModel.id}));
  }

  onRestart() {
    this.store.dispatch(PythonServiceActions.RestartService({id:this.serviceModel.id}));
  }

  getStateColor(state: PythonServiceState ) {
    switch (state) {
      case 'ACTIVE':
        return '#00A676';
      case 'INACTIVE':
        return 'grey'
    }
  }

  getRunningSince() {
    if (!this.serviceModel?.started_at) return '';
    return moment(this.serviceModel.started_at).fromNow();
  }

  openProxiedService() {
     window.open(this.serviceModel.proxied_url,'_blank')
  }
}
