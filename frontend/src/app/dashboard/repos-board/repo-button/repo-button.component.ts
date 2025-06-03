import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RepositoryGitService } from '@core/services/repo/repo-git.service';
import { GitAnalyzeResults, GitState, RepositoryModel } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { RepositoryActions } from '@core/store/repo/repo.action';
import { Actions,ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CreateReleaseDialogComponent, CreateReleaseDialogData } from '../create-release-dialog/create-release-dialog.component';
import { ReleasesDialogComponent, ReleasesDialogData } from '../releases-dialog/releases-dialog.component';
import { ReleaseService } from '@core/services/release/release.service';
import { CreateReleaseModel, Release } from '@core/services/release/release.model';

type Tag = {name:string,time:number};

@Component({
  selector: 'app-repo-button',
  templateUrl: './repo-button.component.html',
  styleUrls: ['./repo-button.component.scss']
})
export class RepoButtonComponent implements OnDestroy,OnInit{

  private _repo: RepositoryModel = null;

  private destroy$ = new Subject();

  private pollTimeout: ReturnType<typeof setTimeout> = null;

  @Output() edit = new EventEmitter<RepositoryModel>();
  @Output() fork = new EventEmitter<RepositoryModel>();
  @Output() delete = new EventEmitter<RepositoryModel>();

  @Output() update = new EventEmitter<RepositoryModel>();

  @Input() set repo(value: RepositoryModel) {
    this._repo = value
    if (!this._repo.ready) {
      this.pollTimeout = setTimeout(this.pollReady.bind(this),3000)
      return
    } else if (this.pollTimeout) {
      clearTimeout(this.pollTimeout)
      this.pollTimeout = null
    }
    Promise.all([
      this.getReleases(),
      this.getGitState()
    ]);
  };

  get repo() {
    return this._repo
  }

  GIT_ANALYZE_RESULTS = GitAnalyzeResults

  forkParent$: Observable<RepositoryModel> = null;

  upstream_results : GitAnalyzeResults = GitAnalyzeResults.UP_TO_DATE;
  
  releases: Release[] = []

  gitState: GitState = null;

  constructor(
    private store: Store<AppState>,
    private releaseService: ReleaseService,
    private repoGitService: RepositoryGitService,
    private dialog: MatDialog,
    private actions$: Actions
  ) { }


  ngOnInit(): void {
      this.actions$.pipe(
        ofType(RepositoryActions.CreateRepositoryReleaseSuccess),
        filter((action) => action.release.repo_id === this.repo.id),
        takeUntil(this.destroy$)
      ).subscribe((action) => {
        this.getReleases();
      })
      this.store.select(Select.repoById,this.repo.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe((repo) => {
        this._repo = repo;
      })
  }
  
  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  private async getReleases() {
    try {
      this.releases = await this.releaseService.getReleaseForRepo(this.repo.id).toPromise()
    } catch {
      this.releases = []
    }
  }

  private async getGitState() {
    try {
      this.gitState = await this.repoGitService.getGitState(this.repo.id).toPromise()
    } catch {
      this.gitState = null;
    }
  }

  openReleaseList() {
    const dialog = this.dialog.open<ReleasesDialogComponent,ReleasesDialogData>(ReleasesDialogComponent,{
      data:{
        releases:this.releases,
        repo:this.repo
      }
    })
  }

  pollReady() {
    this.store.dispatch(RepositoryActions.GetRepository({id:this.repo.id}))
  }

  async createRelease() {
    await this.getReleases()
    await this.getGitState()
    const result = await this.dialog.open<CreateReleaseDialogComponent,CreateReleaseDialogData,CreateReleaseModel>(
      CreateReleaseDialogComponent,
      {
        data:{
          releases:this.releases,
          gitState:this.gitState,
          repo:this.repo
        }
      }
    ).afterClosed().toPromise();

    if (result) {
      TODO: 
      this.store.dispatch(RepositoryActions.CreateRepositoryRelease({args:result}));
    }

  }

}
