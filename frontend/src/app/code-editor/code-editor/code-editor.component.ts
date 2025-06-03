import { Component, OnInit, NgZone, Output, EventEmitter, Input, OnDestroy, ElementRef, Inject, OnChanges, SimpleChanges, InjectionToken, Renderer2, ChangeDetectorRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RepositoryModel } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { CodeTab } from '@core/store/code-editor/code-editor.state';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ComponentContainer, Tab } from 'golden-layout';
import { BehaviorSubject, Subject } from 'rxjs';
import { delay, filter, map, take, takeUntil, } from 'rxjs/operators';
import { ComponentContainerInjectionToken, GlComponentDirective } from 'src/app/golden-layout';
import { Logger } from 'src/app/utils/logger';
import { CodeEditorTextModelsService } from './code-editor-text-models.service';
import * as monaco from 'monaco-editor';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';
import {getIconForFile} from 'vscode-icons-ts'
import { CodeEditorHandlingService } from './code-editor-handling.service';

export type EditorOptions = monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions;

export const MonacoEditorGlobalConfig = new InjectionToken<EditorOptions>('MonacoEditorGlobalConfig');

@Component({
  selector: 'app-code-editor',
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.scss']
})
export class CodeEditorComponent extends GlComponentDirective implements OnDestroy {

  editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    language: 'python',
    automaticLayout: true,
    minimap: {
      enabled: false
    },
    fixedOverflowWidgets:true,
  };

  private editor: monaco.editor.IStandaloneCodeEditor = null;

  private destroy$ = new Subject();

  @Input() openedFile: CodeTab;

  @Input() selectionOrPosition?: monaco.IRange | monaco.IPosition;

  @Input() id: number;
  
  private revealedOnInit: boolean = false;

  readOnly: boolean = false;

  get monacoEditor() {
    return this.editor;
  }

  constructor(
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    private store: Store<AppState>,
    @Inject(ComponentContainerInjectionToken) private container: ComponentContainer,
    @Inject(MonacoEditorGlobalConfig) private editorConfig$: BehaviorSubject<EditorOptions>,
    private textModels: CodeEditorTextModelsService,
    private editService: RepositoryEditService,
    private editHandler: CodeEditorHandlingService,
    private cd: ChangeDetectorRef,
    elRef: ElementRef
  ) {
    super(elRef.nativeElement)
    elRef.nativeElement.style.overflow = '';
    this.container.on('resize', this.layout.bind(this));
    this.container.on('show', () => {
      this.store.dispatch(CodeEditorActions.FocusTab({ tab: this.openedFile }));
    });
  }

  getIconForFile = getIconForFile

  ngOnDestroy(): void {

    this.editor.dispose();

    this.destroy$.next(null);
    this.destroy$.complete();
  }

  editorInit(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.readOnly = this.openedFile.path.startsWith('..');
    this.editor.updateOptions({readOnly:this.readOnly});

    if (this.readOnly) {
      this.editHandler.setInactive(this);
    }
    
    this.initCommandsAndActions();

    this.store.select(Select.editingRepo).pipe(
      takeUntil(this.destroy$)
    ).subscribe((r) => {
      this.updateEditor();
    });
    this.editorConfig$.pipe(
      takeUntil(this.destroy$),
    ).subscribe((options) => {
      const opts = this.editor.getOptions();
      this.editor.updateOptions({...opts,...options});
      if (this.readOnly) {
        this.editor.updateOptions({readOnly:this.readOnly});
      }
    });
    this.editor.onDidChangeModelContent(this.codeChanged.bind(this));
    this.editor.focus();
  }

  async codeChanged() {
    const currentModel = await this.textModels.getModel(this.openedFile.path);
    if (currentModel?.originalCode === null || currentModel?.originalCode === undefined)
      return
    this.openedFile.modified = currentModel?.model?.getValue() !== currentModel?.originalCode;
    this.cd.detectChanges();
    this.store.dispatch(CodeEditorActions.SetTabModified({ tab: this.openedFile }));
  }

  public layout() {
    this.editor?.layout();
  }

  public saveCode() {
    if (this.openedFile)
      this.saveToServer();
  }

  private async updateEditor() {
    if (!this.openedFile) {
      this.editor.setModel(null);
      Logger.logWarning('No file set for editor');
      return;
    }
    const model = await this.textModels.getModel(this.openedFile.path);
    this.editor.setModel(model.model);
    if (!this.revealedOnInit && this.selectionOrPosition) {
      this.reveal(this.selectionOrPosition)
      this.revealedOnInit = true;
    }
  }

  private initCommandsAndActions() {
    this.editor.addAction({
      id: 'SAVE_TO_SERVER',
      label: 'Save to server',
      run: () => this.saveToServer(),
      keybindings: [(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS)]
    });

    this.editor.addAction({
      id: 'TOGGLE_LINE_WRAP',
      label: 'Toggle Line Wrap',
      run: () => {
        const opts = this.editor.getOptions();
        this.editorConfig$.next({wordWrap: opts.get(monaco.editor.EditorOption.wordWrap) === 'off' ? 'on' : 'off' });
      }
    });

    this.editor.addAction({
      id: 'TOGGLE_MINIMAP',
      label: 'Toggle Minimap',
      run: () => {
        const opts = this.editor.getOptions();
        const minimapState = opts.get(monaco.editor.EditorOption.minimap).enabled;
        this.editorConfig$.next({ minimap: { enabled: !minimapState } });
      }
    });

    this.editor.addAction({
      id: 'RUN_FILE',
      label: 'Run file',
      run: () => this.run()
    })

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        // Override Ctrl/Cmd+Click (default go to definition)
        console.log('Cmd+Click disabled');
    }, '');

  }

  private saveToServer() {
    this.editService.updateFile(this.openedFile.path,this.editor.getModel().getValue(), false).then(() =>{
      this.ngZone.run(() => {
        this.snackBar.open('Saved', null, {
          duration: 1500,
          verticalPosition: 'top'
        });
      });
      this.textModels.updateModel(this.openedFile.path);
    }).catch((e) => {
      this.ngZone.run(() => {
        this.snackBar.open('Failed to save', null, {
          duration: 1500,
          verticalPosition: 'top'
        });
      });
      console.error(e)
    })
  }

  public focus() {
    this.container.focus();
    this.editor.focus();
  }

  blur() {
    if (!this.editor.hasTextFocus()) return;

    if ( document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  public close() {
    console.log('Closing editor component', this.openedFile.path);
    this.store.select(Select.codeEditorUnsavedChanges).pipe(
      take(1),
      filter((hasUnsavedChanges) => !hasUnsavedChanges || confirm('You have unsaved changes. Are you sure you want to close?'))
    ).subscribe(() => {
      console.log('Closing editor component');
      this.openedFile.modified = false;
      this.store.dispatch(CodeEditorActions.SetTabModified({ tab: this.openedFile}));
      this.store.dispatch(CodeEditorActions.CloseTab({ tab: this.openedFile }));
    });
  }

  public reveal(selectionOrPosition?: monaco.IRange | monaco.IPosition) {
    if (!this.editor || !selectionOrPosition) {
      return;
    }
    this.focus();
    if (monaco.Range.isIRange(selectionOrPosition)) {
      this.editor.revealRangeNearTop(selectionOrPosition);
    } else if (monaco.Position.isIPosition(selectionOrPosition)) {
      this.editor.revealPositionNearTop(selectionOrPosition);
    }

  }
  run() {
    this.store.dispatch(CodeEditorActions.StartProcess({params:{path:this.openedFile.path}}))
  }

  duplicate() {
    this.store.dispatch(CodeEditorActions.OpenTab({tab:this.openedFile}));
  }
}



