import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConnectorModel, ScriptModel, ScriptsService } from '@core/services';
import { AppState, Select } from '@core/store';
import { ScriptActions } from '@core/store/script/script.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { from, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ScriptRunnerService } from '../script-runner.service';
import { Terminal } from 'xterm';
import { BaseTermComponent } from 'src/app/xterm/base-term.component';


@Component({
  selector: 'app-script-runner',
  templateUrl: './script-runner.component.html',
  styleUrls: ['./script-runner.component.scss'],
  providers:[ScriptRunnerService]
})
export class ScriptRunnerComponent implements OnInit,OnDestroy{


  private destroy$ = new Subject();

  @Input() header = true;

  scriptModel: ScriptModel = null;

  state: string = '';

  url = '';

  frameRefresh: boolean = false;

  showTerminal: boolean = false;

  private dcm: ConnectorModel = null;

  private terminal: Terminal = null;
  private initialLoad: boolean = false;

  @ViewChild('frame',{read: ElementRef, static: false}) set frame(frame: ElementRef) {
    if (!frame) return;
    frame.nativeElement.onload = () => {
      if (!this.initialLoad) {
        setTimeout(() => this.refresh(),500);
        this.initialLoad = true;
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private store: Store<AppState>,
    private actions$: Actions,
    public scriptService: ScriptsService,
    private cd: ChangeDetectorRef,
    private scriptRunnerService: ScriptRunnerService
  ) { }
  

  ngOnInit(): void {
    this.store.dispatch(ScriptActions.GetScripts());

    this.actions$.pipe(
      ofType(ScriptActions.GetScriptsSuccess),
      switchMap(() => this.route.params),
      map((params) => Number(params['id'])),
      switchMap((id) => {
        return this.store.select(Select.scriptById,id);
      }),
      tap((script) => {
        if (!script)
          this.router.navigate(['404'],{skipLocationChange:true});
      }),
      switchMap((script) => {
        console.log(script)
        return this.scriptRunnerService.connect(script).pipe(
          map(() => script as ScriptModel) // @ts-ignore
        ) 
      }),
      switchMap((script) => {
        return from(this.scriptRunnerService.init()).pipe(
          tap((url) => this.url = url),
          map(() => script)
        )
      }),
      takeUntil(this.destroy$),
    ).subscribe(async (script: ScriptModel) => {
      this.scriptModel = script
      await this.scriptRunnerService.run();
    });
    
    this.scriptRunnerService.onStatus$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((state) => {
      this.state = state.state;
    })

    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe((params) => {
      if (params.h !== undefined)
        this.header = params.h !== 'false';
    });

    this.store.select(Select.selectedDcmConnection).pipe(
      takeUntil(this.destroy$)
    ).subscribe((dcm) => {
      this.dcm = dcm;
    })
  }

  onTerminalReady(term: Terminal, component: BaseTermComponent) { 
    this.terminal = term;
    const proposedDimensions = component.fit.proposeDimensions();
    if (proposedDimensions)
      this.scriptRunnerService.resize(proposedDimensions.cols,proposedDimensions.rows);
    this.terminal.onData((data) => {
        this.scriptRunnerService.streamWrite(data);
    });

    this.scriptRunnerService.onStream$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data) => {
      this.terminal.write(data);
    });
    this.terminal.onResize(async ({cols,rows}) => {
      await this.scriptRunnerService.resize(cols,rows)
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
    this.scriptRunnerService.stop().then(() => {
      this.scriptRunnerService.disconnect();
    });
    
  }

  async scriptControlClick() {
    if (this.state === 'active') {
      await this.scriptRunnerService.stop()
      if (this.url) {
        this.router.navigate(['apps'])
      }
    } else {
      if (this.terminal) {
        this.terminal.clear();
      }
      await this.scriptRunnerService.run();
    }
  }

  refresh() {
    this.frameRefresh = true;

    setTimeout(() => {
        this.frameRefresh = false;
        this.cd.detectChanges();
    }, 10);

    this.cd.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  toggleTerminal(event: KeyboardEvent) {
    if ( event.ctrlKey && event.altKey && event.key == 't')
      this.showTerminal = !this.showTerminal
  }
}
