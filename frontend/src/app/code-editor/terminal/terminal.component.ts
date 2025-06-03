import { Component, ElementRef, Inject, Input, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AppState, Select } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ComponentContainer } from 'golden-layout';
import { Subject } from 'rxjs';
import { filter, map, take, takeUntil } from 'rxjs/operators';
import { ComponentContainerInjectionToken, GlComponentDirective } from 'src/app/golden-layout';
import { BaseTermComponent } from 'src/app/xterm/base-term.component';
import { Terminal } from 'xterm';
import { TerminalBufferService } from './terminal-buffer.service';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';

const RED="\x1b[0;31m";
const GREEN="\x1b[0;32m";
const RESET="\x1b[0m";

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent extends GlComponentDirective implements OnDestroy{

  private terminal: Terminal = null;

  private destroy$ = new Subject();
  
  @Input() id: number | string;

  @Input() readonly: boolean = false;

  @Input() name?: string

  @ViewChild(BaseTermComponent,{static:true}) terminalComponent: BaseTermComponent;

  @ViewChild('tabTemplate', {read:TemplateRef, static:true}) tabTemplate: TemplateRef<any>;

  active: boolean = true;
  exitCode: number = null;

  appName$ = this.store.select(Select.appsToProcesses).pipe(
    takeUntil(this.destroy$),
    map((appsToProcess) => {
      return Object.keys(appsToProcess).find((key) => appsToProcess[key] === this.id)
    }),
    take(1)
  )

  constructor(
    elementRef: ElementRef,
    private store: Store<AppState>,
    private terminalBufferService: TerminalBufferService,
    private actions$: Actions,
    @Inject(ComponentContainerInjectionToken) private container: ComponentContainer,
    private editService: RepositoryEditService
  ) {
    super(elementRef.nativeElement);
   }
  

  onReady(term: Terminal) {
    this.terminal = term;
    this.container.focus();
    this.terminal.focus();
    const proposedDimensions = this.terminalComponent.fit.proposeDimensions();
    if (proposedDimensions)
      this.editService.resizeProcessTerm(this.id,proposedDimensions.cols,proposedDimensions.rows);
    this.terminalBufferService.getBuffer(this.id).forEach((line) => {
      this.terminal.write(line);
      // this.terminalBufferService.clear(this.pid)
    })
    this.terminal.onData((data) => {
      if (!this.readonly)
        this.editService.streamWrite(this.id as number, data)
    });

    this.editService.onStream$.pipe(
      filter((stream) => stream.pid === this.id),
      map((stream) => stream.data),
      takeUntil(this.destroy$)
    ).subscribe((data) => {
      this.terminal.write(data);
    });
    this.editService.onTaskStream$.pipe(
      filter((stream) => stream.id === this.id),
      map((stream) => stream.data),
      takeUntil(this.destroy$)
    ).subscribe((data) => {
      this.terminal.write(data);
    })

    this.container.on('resize',() => {
      this.terminalComponent.onResize();
    });
    this.terminal.onResize(async ({cols,rows}) => {
      if (this.active)
        await this.editService.resizeProcessTerm(this.id,cols,rows)
    });

    this.actions$.pipe(
      ofType(CodeEditorActions.ProcessExited),
      filter((action) => action.pid === this.id),
      takeUntil(this.destroy$)
    ).subscribe(({data}) => {
      this.terminal.write(`${data.exitCode === 0 ? GREEN : RED}Process exited with code ${data.exitCode}${RESET}\r\n`);
      this.active = false;
      this.exitCode = data.exitCode;
    });

    this.actions$.pipe(
      ofType(CodeEditorActions.TaskFinished),
      filter((action) => action.id == this.id),
      takeUntil(this.destroy$)
    ).subscribe((data) => {
      this.terminal.write(`${data.exit_code === 0 ? GREEN : RED}Task finished with exit code ${data.exit_code}${RESET}\r\n`);
      this.active = false;
      this.exitCode = data.exit_code;
    })
  }

  close() {
    this.container.close();
  }

  async stop() {
    try {
      if (typeof this.id === 'number')
        await this.editService.killProcess(this.id);
    } catch(e) {
      console.error(e);
    }
  }

  clear() {
    if(this.terminal)
      this.terminal.clear();
  }

  focus() {
    this.terminal?.focus()
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }
}
