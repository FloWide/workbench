import { Component, ElementRef, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { MONACO_LOADED } from './monaco-editor.module';
import * as monaco from 'monaco-editor';

@Component({
  template:''
})
export abstract class BaseEditorComponent implements OnInit,OnDestroy {

  @ViewChild('editorContainer', { static: true }) editorContainer: ElementRef;

  protected destroy$ = new Subject();

  protected editor: monaco.editor.IStandaloneCodeEditor | monaco.editor.IStandaloneDiffEditor;

  constructor(@Inject(MONACO_LOADED) private monacoLoaded$: BehaviorSubject<boolean>) { }
  
  ngOnInit(): void {
    this.monacoLoaded$.pipe(
      takeUntil(this.destroy$),
      filter<Boolean>(Boolean),
      take(1)
    ).subscribe(() => {
      this.initMonaco();
    });
  }

  protected abstract initMonaco() : void;

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();

    if(this.editor) {
      this.editor.dispose();
      this.editor = undefined;
    }
  }
}
