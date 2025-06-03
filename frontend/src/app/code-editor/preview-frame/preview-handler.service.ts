import { ComponentRef, Injectable, OnDestroy } from '@angular/core';
import { ComponentContainer, GoldenLayout, RowOrColumn } from 'golden-layout';
import { BehaviorSubject, Subject } from 'rxjs';
import { ComponentHandlerService } from '../component-handler.service';
import { PreviewRunnerComponent } from './preview-runner/preview-runner.component';
import { GoldenLayoutComponentService } from 'src/app/golden-layout';
import { Actions, ofType } from '@ngrx/effects';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { takeUntil } from 'rxjs/operators';

interface PreviewRunnerState {
  pid: number;
  port: number;
  url: string;
  title: string;
  state: 'active' | 'inactive'
}

@Injectable()
export class PreviewHandlerService extends ComponentHandlerService<PreviewRunnerComponent, PreviewRunnerState> implements OnDestroy {
  

  private childWindows: Map<string, Window> = new Map();

  private destroy$ = new Subject();

  constructor(
    glComponents: GoldenLayoutComponentService,
    private actions$: Actions
  ) { 
    super(glComponents, PreviewRunnerComponent, 'preview-runner')
  }
  

  ready(gl: GoldenLayout, defaultTarget: RowOrColumn): void {
    super.ready(gl, defaultTarget);

    this.actions$.pipe(
      ofType(CodeEditorActions.ProcessProxyClosed),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      const id = `${action.pid}-${action.port}`
      this.deactivateComponent(id)
      this.setState(id, {state:'inactive'});
    })


  }

  protected onAngularComponentCreated(componentRef: ComponentRef<PreviewRunnerComponent>, container: ComponentContainer): void {
    super.onAngularComponentCreated(componentRef, container);
    componentRef.instance.onOpenPopout$.subscribe(() => this.openPopoutWindow(componentRef.instance));
  }

  openPreview(title: string,pid: number, port: number, url: string) {
    this.createComponent(title,{
      pid:pid,
      port:port,
      url:url,
      title:title,
      state:'active'
    })
  } 

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  protected getId(component: PreviewRunnerComponent) {
    return `${component.pid}-${component.port}`
  }


  openPopoutWindow(for_: PreviewRunnerComponent): void {
    const id = this.getId(for_);
    if (!for_.url) return;
    const childWindow = window.open(for_.url, '_blank', 'popout')
    this.childWindows.set(id, childWindow);
    this.closeComponent(id);
    const checkChild = setInterval(() => {
      if (childWindow.closed) {
        this.childWindows.delete(id)
        this.openPreview(for_.title,for_.pid,for_.port,for_.url);
        clearInterval(checkChild)
      }
    },500)
  }

  closePopoutWindow(id: any) {
    if (this.childWindows.has(id)) {
      this.childWindows.get(id).close();
      this.childWindows.delete(id);
    }
  }
}
