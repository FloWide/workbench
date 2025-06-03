import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Process, ChildProcess } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { filter, map, takeUntil, withLatestFrom } from 'rxjs/operators';
import { GlComponentDirective } from 'src/app/golden-layout';
import {flatten} from 'lodash';
import { PreviewHandlerService } from '../preview-frame/preview-handler.service';
import { TerminalHandlingService } from '../terminal/terminal-handling.service';

@Component({
  selector: 'app-process-tree',
  templateUrl: './process-tree.component.html',
  styleUrls: ['./process-tree.component.scss']
})
export class ProcessTreeComponent extends GlComponentDirective implements OnInit, OnDestroy {
  
  private destroy$ = new Subject();

  processes: Record<number, Process> = {};

  apps: string[] = [];

  processProxies: Record<number, Record<number, string>> = {};

  constructor(
    private store: Store<AppState>,
    private previewHandler: PreviewHandlerService,
    private terminalHandler: TerminalHandlingService,
    elRef: ElementRef
  ) { 
    super(elRef.nativeElement)
  }
  
  appsToProcesses: Record<string, number> = {}

  ngOnInit(): void {
    this.store.select(Select.appsToProcesses).pipe(
      takeUntil(this.destroy$),
    ).subscribe((apps) => {
      this.appsToProcesses = apps;
      this.apps = Object.keys(apps);
    });

    this.store.select(Select.processes).pipe(
      takeUntil(this.destroy$)
    ).subscribe((procs) => {
      this.processes = procs;
    });

    this.store.select(Select.processProxies).pipe(
      takeUntil(this.destroy$)
    ).subscribe((processProxies) => {
      this.processProxies = processProxies
    })
  }

  onStop(app: string) {
    const pid = this.appsToProcesses[app];
    this.store.dispatch(CodeEditorActions.StopProcess({pid:pid}));
  }

  isProxied(app: string) {
    const pid = this.appsToProcesses[app];
    return pid in this.processProxies;
  }

  openPreview(app: string) {
    const pid = this.appsToProcesses[app];
    const proxies = this.processProxies[pid];
    const port = Number(Object.keys(proxies)[0])
    this.previewHandler.openPreview(app,pid, port, proxies[port] + "/")
  }

  openTerminal(app: string) {
    const pid = this.appsToProcesses[app];
    this.terminalHandler.openTerminal(this.processes[pid]);
  }

  focus(): void {
    
  }

  ngOnDestroy(): void {
   this.destroy$.next(null);
   this.destroy$.complete();
  }

}
