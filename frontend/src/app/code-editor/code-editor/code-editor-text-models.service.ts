/// <reference path="../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Injectable, OnDestroy } from '@angular/core';
import { AppState } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Subject, from } from 'rxjs';
import { filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { Logger } from 'src/app/utils/logger';
import * as monaco from 'monaco-editor';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';
import {normalize} from 'path-browserify';

export interface MonacoTextModel {
    model: monaco.editor.ITextModel;
    originalCode: string;
    lastViewState?: any;
}

export interface MonacoTextModels {
  [key: string]: MonacoTextModel
}

@Injectable()
export class CodeEditorTextModelsService implements OnDestroy {

  private textModels: MonacoTextModels = {}

  private destroy$ = new Subject();

  constructor(
    private store: Store<AppState>,
    private actions$: Actions,
    private editService: RepositoryEditService
  ) {

    this.actions$.pipe(
      ofType(CodeEditorActions.CloseTab),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      const model = this.textModels[action.tab.path];
      if (model) {
        model.model.dispose();
        delete this.textModels[action.tab.path];
      }
    });

    this.editService.onFileChanges$.pipe(
      takeUntil(this.destroy$),
      switchMap((changes) => from(changes)),
      filter((change) => (change.path in this.textModels) && change.change !== 'deleted')
    ).subscribe((change) => {
      this.updateModel(change.path);
    })

  }


  ngOnDestroy(): void {
    Logger.logMessage('text model service destroyed');
    for(const [k,v] of Object.entries(this.textModels)) {
      v.model.dispose();
      delete this.textModels[k];
    }
    this.destroy$.next(null);
    this.destroy$.complete();
  }


  async getModel(file: string) {
    if (!(file in this.textModels)) {
      const cwd = await this.editService.getCwd();
      const content = await this.editService.getFileContent(file);
      Logger.logMessage('new model')
      const path = normalize(`${cwd}/${file}`);
      const model = monaco.editor.createModel(content, "", monaco.Uri.file(path));
      this.textModels[file] = { model: model, originalCode: content };
    } else {
      Logger.logMessage('old model') 
    }
    Logger.logMessage(this.textModels)
    return this.textModels[file]
  }

  updateModel(file: string) {
    if (!(file in this.textModels)) return;
    this.getFileContent(file, this.textModels[file]);
  }

  destroyModel(file: string) {
    if (!(file in this.textModels)) return;
    this.textModels[file].model.dispose();
    delete this.textModels[file];
  }

  private async getFileContent(path: string, textModel: MonacoTextModel) {
    try {
      const content = await this.editService.getFileContent(path);
      textModel.originalCode = content;
      textModel.model.pushEditOperations(
        [new monaco.Selection(0,0,0,0)],
        [{
          range: textModel.model.getFullModelRange(),
          text: content,
          forceMoveMarkers:textModel.model.getValue() === '' // only forcemovemarkes on empty model so the selection is kept after updating the content
        }],
        () => [new monaco.Selection(0,0,0,0)]
      );
    } catch(e) {
      textModel.model.dispose();
      textModel.model = null;
    }
  }
}
