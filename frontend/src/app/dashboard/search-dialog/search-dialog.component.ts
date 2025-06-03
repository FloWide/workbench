import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { isScriptModel, ScriptModel, Scripts } from '@core/services';
import { PythonServiceModel, PythonServices } from '@core/services/python-service/python-service.model';
import { isRepositoryModel, RepositoryModel } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-search-dialog',
  templateUrl: './search-dialog.component.html',
  styleUrls: ['./search-dialog.component.scss']
})
export class SearchDialogComponent implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  inputField = new FormControl();

  repos$ = this.store.select(Select.repos).pipe(
    takeUntil(this.destroy$),
    map((repos): RepositoryModel[] => Object.values(repos))
  );

  scripts$ = this.store.select(Select.scripts).pipe(
    takeUntil(this.destroy$),
    map((data) => transform<Scripts,ScriptModel>(data))
  )

  services$ = this.store.select(Select.services).pipe(
    takeUntil(this.destroy$),
    map((data) => transform<PythonServices,PythonServiceModel>(data))
  )

  constructor(
    private dialogRef: MatDialogRef<SearchDialogComponent>,
    private store: Store<AppState>,
    private router: Router
  ) { }

  ngOnInit(): void {
    
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  displayFn(el: RepositoryModel | ScriptModel | PythonServiceModel) {
    if (!el) return ''
    if('release' in el) {
      return `${el.name} / ${el.release.name}`
    }
    return el.name
  }

  onSearch() {
    const el = this.inputField.value
    if (isRepositoryModel(el)) {
      this.router.navigate(['edit',el.id])
    } else if (isScriptModel(el)) {
        this.router.navigate(['script',el.id])
    } else {
      this.router.navigateByUrl('/', {skipLocationChange: true}).then(() =>
      this.router.navigate(['services'],{
        state:{
          service:el
        }
      }))
    }
    this.dialogRef.close();
  }

}

function transform<T,U>(data: T): U[] {
  let array: U[] = [];
  for(const value of Object.values(data)) {
    array.push(
      ...(Object.values(value) as U[])
    )
  }
  return array
}