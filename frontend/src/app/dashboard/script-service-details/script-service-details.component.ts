import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ScriptModel } from '@core/services';
import { PythonServiceModel } from '@core/services/python-service/python-service.model';
import { Subject } from 'rxjs';
import * as moment from 'moment';
import { AppState, Select } from '@core/store';
import { Store } from '@ngrx/store';
import { takeUntil } from 'rxjs/operators';
import { Repositories } from '@core/services/repo/repo.model';

@Component({
  selector: 'app-script-service-details',
  templateUrl: './script-service-details.component.html',
  styleUrls: ['./script-service-details.component.scss']
})
export class ScriptServiceDetailsComponent implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  private repos: Repositories = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public object: PythonServiceModel | ScriptModel,
    private store: Store<AppState>
  ) { }

  ngOnInit(): void {
    this.store.select(Select.repos).pipe(
      takeUntil(this.destroy$)
    ).subscribe((repos) => {
      this.repos = repos;
    }) 
  }

  ngOnDestroy(): void { 
    this.destroy$.next(null);
    this.destroy$.complete();
  }


  prettyTime(time: string) {
    return moment(time).fromNow();
  }

  prettyRepo(id: number) {
    return this.repos.find((v => v.id === id))?.name || ''

  }

}
