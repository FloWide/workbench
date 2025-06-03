import { Inject, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeEditorComponent, EditorOptions, MonacoEditorGlobalConfig } from './code-editor/code-editor.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MaterialModule } from '@material/index';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { CodeEditorPageComponent } from './code-editor-page/code-editor-page.component';
import { RouterModule, Routes } from '@angular/router';
import { ComponentsModule } from '@components/components.module';
import { CommitDialogComponent } from './commit-dialog/commit-dialog.component';
import { BrowserFrameComponent } from './preview-frame/browser-frame/browser-frame.component';
import { PreviewRunnerComponent } from './preview-frame/preview-runner/preview-runner.component';
import { UtilsModule } from '../utils/utils.module';
import { CanCodeEditorPageDeactivate } from './code-editor-page/deactivate.guard';
import { GoldenLayoutModule } from '../golden-layout';
import { BehaviorSubject } from 'rxjs';
import { MonacoEditorModule, MONACO_LOADED } from '../monaco-editor/monaco-editor.module';
import { TerminalComponent } from './terminal/terminal.component';
import { XtermModule } from '../xterm/xterm.module';
import * as monaco from 'monaco-editor';
import { ProcessTreeComponent } from './process-tree/process-tree.component';
import {TreeModule} from '@circlon/angular-tree-component'
import { AutofocusDirective } from './file-tree/auto-focus.directive';
import { FileIconComponent } from './file-tree/file-icons.component';
import { ImagePreviewComponent } from './image-preview/image-preview.component';
import { CommonEditorService } from './common.service';

const routes:Routes = [
  {
    path:'',
    component:CodeEditorPageComponent,
    canDeactivate:[CanCodeEditorPageDeactivate]
  }
]



@NgModule({
  declarations: [CodeEditorComponent, FileTreeComponent, CodeEditorPageComponent, CommitDialogComponent, BrowserFrameComponent, PreviewRunnerComponent,TerminalComponent, ProcessTreeComponent, AutofocusDirective, FileIconComponent, ImagePreviewComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    MaterialModule,
    RouterModule.forChild(routes),
    ComponentsModule,
    UtilsModule,
    GoldenLayoutModule,
    MonacoEditorModule,
    XtermModule,
    TreeModule
  ],
  providers:[
    CanCodeEditorPageDeactivate,
    CommonEditorService,
    {
      provide:MonacoEditorGlobalConfig,
      useFactory:() => new BehaviorSubject<EditorOptions>({})
    }
  ]
})
export class EditorModule {
  constructor(
    @Inject(MONACO_LOADED) private monacoLoaded$: BehaviorSubject<boolean>
    ) {
      monaco.languages.typescript.typescriptDefaults.setModeConfiguration({
        completionItems: false,
        definitions: false,
        hovers: false,
        inlayHints: false,
        rename: false,
        codeActions: false,
        diagnostics: false,
        documentHighlights: false,
        documentRangeFormattingEdits: false,
        documentSymbols: false,
        onTypeFormattingEdits: false,
        references: false,
        signatureHelp: false
      });
    }
 }
