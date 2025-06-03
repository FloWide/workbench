import { Breakpoints } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import { KeyValue } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ScriptButtonActions as ScriptButtonActions } from '@components/streamlit-script-button/streamlit-script-button.component';
import { ScriptModel, Scripts, UserProfile } from '@core/services';
import { AppState, Select, UserActions } from '@core/store';
import { RepositoryActions } from '@core/store/repo/repo.action';
import { ScriptActions } from '@core/store/script/script.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScriptServiceDetailsComponent } from '../script-service-details/script-service-details.component';
import {groupByField} from '../../utils/group-by-field';
@Component({
  selector: 'app-script-board',
  templateUrl: './script-board.component.html',
  styleUrls: ['./script-board.component.scss']
})
export class ScriptBoardComponent implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  @Input() filter: string = '';

  // group by name
  scripts: Record<string, ScriptModel[]> = {};

  user: UserProfile = null;

  cols = 4

  constructor(
    private store: Store<AppState>,
    private actions$: Actions,
    private router: Router,
    private breakpoint:BreakpointObserver,
    private cd: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }
  

  ngOnInit(): void {
    this.store.dispatch(ScriptActions.GetScripts());
    this.store.dispatch(UserActions.GetMe());
    this.breakpoint.observe([
      Breakpoints.XSmall,
      Breakpoints.Small,
      Breakpoints.Medium,
      Breakpoints.Large,
      Breakpoints.XLarge
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if(result.matches) {
        if (result.breakpoints[Breakpoints.Small] || result.breakpoints[Breakpoints.XSmall]) {
          this.cols = 1;
        }
        else if (result.breakpoints[Breakpoints.Medium]) {
          this.cols = 2;
        }
        else if (result.breakpoints[Breakpoints.Large] || result.breakpoints[Breakpoints.XLarge] ) {
          this.cols = 4;
        }
        this.cd.detectChanges();
      }
    });

    this.store.select(Select.scripts).pipe(
      takeUntil(this.destroy$)
    ).subscribe((scripts) => {
      this.scripts = groupByField(scripts, 'name');
    });

    this.store.select(Select.user).pipe(
      takeUntil(this.destroy$)
    ).subscribe((user) => {
      this.user = user;
    });

    this.actions$.pipe(
      ofType(RepositoryActions.DeleteRepositorySuccess),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      this.store.dispatch(ScriptActions.GetScripts());
    });

  }


  async onScriptAction([script,action]: [ScriptModel,ScriptButtonActions]) {
    switch (action) {
      case ScriptButtonActions.RUN_IN_FULLSCREEN:
        this.router.navigate(['script',script.id],{
          queryParams:{
            h:false
          }
        })
        break;
      case ScriptButtonActions.DETAILS:
        this.dialog.open(ScriptServiceDetailsComponent,{
          data:script
        });
        break;
    }
  }

  onScriptClicked(script: ScriptModel) {
    this.router.navigate(['script',script.id]);
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  trackBy(index: number,item: KeyValue<string,ScriptModel[]>) {
    return `${item.key}/${item.value.length}}`;
  }

}
