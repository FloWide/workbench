import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RepositoryModel } from '@core/services/repo/repo.model';
import { AppState } from '@core/store';
import { RepositoryActions } from '@core/store/repo/repo.action';
import { ThemeService } from '@material/theme.service';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import * as moment from 'moment';
import { Release } from '@core/services/release/release.model';

export interface ReleasesDialogData {
  releases: Release[];
  repo: RepositoryModel
}

@Component({
  selector: 'app-releases-dialog',
  templateUrl: './releases-dialog.component.html',
  styleUrls: ['./releases-dialog.component.scss']
})
export class ReleasesDialogComponent implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  releases: Release[] = []

  private repo: RepositoryModel = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ReleasesDialogData,
    private store: Store<AppState>,
    private actions$: Actions
  ) { 
    this.releases = data.releases;
    this.repo = data.repo
  }
  

  ngOnInit(): void {
    this.actions$.pipe(
      ofType(RepositoryActions.DeleteRepositoryReleaseSuccess),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      this.releases.splice(
        this.releases.findIndex((value) => value.id === action.id),
        1
      )
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  deleteRelease(item: Release) {
    this.store.dispatch(RepositoryActions.DeleteRepositoryRelease({id:item.id}))
  }

  prettyTime(time: string) {
    return moment(time).fromNow();
  }
}
