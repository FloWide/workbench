import { Component, HostListener, Inject, Injector, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { InputDialogComponent, InputDialogData } from '@components/dialogs/input-dialog/input-dialog.component';
import { AppState, Select,} from '@core/store';
import { MenuBarComponent, MenuItem } from '@material/menu-bar/menu-bar.component';
import { PickerDialogComponent, PickerDialogData } from '@material/picker-dialog/picker-dialog.component';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ComponentItem, RowOrColumn, Stack } from 'golden-layout';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map, switchMap, take, takeUntil, tap, withLatestFrom } from 'rxjs/operators';
import { GlComponentDirective, GoldenLayoutHost } from 'src/app/golden-layout';
import { Logger } from 'src/app/utils/logger';
import { CodeEditorActions } from '../../core/store/code-editor/code-edior.action';
import { EditorOptions, MonacoEditorGlobalConfig } from '../code-editor/code-editor.component';
import { CommitDialogComponent } from '../commit-dialog/commit-dialog.component';
import { PreviewHandlerService } from '../preview-frame/preview-handler.service';
import { DEFAULT_LAYOUT_CONFIG, MENU_BAR } from './layout-definitions';
import { CodeEditorTextModelsService } from '../code-editor/code-editor-text-models.service';
import { fileToBase64 } from '../utils';
import { RepositoryFileEntry, RepositoryModel} from '@core/services/repo/repo.model';
import { CodeTab } from '@core/store/code-editor/code-editor.state';
import { RepositoryActions } from '@core/store/repo/repo.action';
import { TerminalBufferService } from '../terminal/terminal-buffer.service';
import { CodeEditorLspService } from '../code-editor/code-editor-lsp.service';
import { ToolBarComponent } from '@material/tool-bar/tool-bar.component';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';
import { TerminalHandlingService } from '../terminal/terminal-handling.service';
import { CodeEditorHandlingService } from '../code-editor/code-editor-handling.service';
import { FileTreeHandlerService } from '../file-tree/file-tree-handler.service';
import { ProcessTreeHandlerService } from '../process-tree/process-tree-handler.service';
import { ImagePreviewHandlerService } from '../image-preview/image-preview-handler.service';
import * as monaco from 'monaco-editor';
import { WorkBenchConfigCodeLensProvider } from '../code-editor/lsp/workbench-config-lens';
import {basename} from 'path-browserify';
import { findNeighbors } from '../component-handler.service';
import { KeybindService } from '@material/keybind.service';
import { CommonEditorService } from '../common.service';

@Component({
  selector: 'app-code-editor-page',
  templateUrl: './code-editor-page.component.html',
  styleUrls: ['./code-editor-page.component.scss'],
  providers: [
    CodeEditorTextModelsService,
    TerminalBufferService,
    CodeEditorLspService,
    TerminalHandlingService,
    CodeEditorHandlingService,
    FileTreeHandlerService,
    ProcessTreeHandlerService,
    ImagePreviewHandlerService,
    WorkBenchConfigCodeLensProvider,
    KeybindService,
    PreviewHandlerService
  ]
})
export class CodeEditorPageComponent implements OnInit, OnDestroy {
  

  menuBarSetting = MENU_BAR;

  private destroy$ = new Subject();

  repo: RepositoryModel;

  fullScreen: boolean = true;

  showToolBar: boolean = true;

  showFileTree: boolean = true;

  websocketConnected = false;

  unsavedChanges$: Observable<boolean>;


  appsAndServices$ = new BehaviorSubject<string[]>([]);
  appsAndServicesSubscription = this.store.select(Select.workbenchConfig).pipe(
    takeUntil(this.destroy$),
    filter((config) => !!config?.apps),
    map((config) => [...Object.keys(config.apps),...Object.keys(config.services)])
  ).subscribe(this.appsAndServices$);

  buildExists$ = this.store.select(Select.workbenchConfig).pipe(
    takeUntil(this.destroy$),
    map((config) => !!config?.build?.cmd)
  )

  appsToProcess: Record<string, number> = {};

  selectedApp: string = null;


  private glHost: GoldenLayoutHost;

  @ViewChild('glHost', { static: false }) set goldenLayoutHost(host: GoldenLayoutHost) {
    if (!host && this.glHost) {
      this.glHost = null;
      return;
    }
    if (!host) return;
    if (!this.glHost) {
      this.glHost = host;
      this.onGlReady();
    }
  }

  @ViewChild('menuBar', {static:false}) menuBar: MenuBarComponent;

  private focusedTab: CodeTab;

  private selectedDcm: string;

  private openDialog: MatDialogRef<any> = null;

  constructor(
    private store: Store<AppState>,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private actions$: Actions,
    private router: Router,
    public injector: Injector,
    private previewHandler: PreviewHandlerService,
    @Inject(MonacoEditorGlobalConfig) private editorConfig$: BehaviorSubject<EditorOptions>,
    private terminalBuffer: TerminalBufferService,
    private _: CodeEditorLspService,
    public editService: RepositoryEditService,
    private terminalHandling: TerminalHandlingService,
    private editorHandling: CodeEditorHandlingService,
    private fileTreeHandling: FileTreeHandlerService,
    private processTreeHandling: ProcessTreeHandlerService,
    private imagePreviewHandling: ImagePreviewHandlerService,
    private keyBindService: KeybindService,
    private commonService: CommonEditorService
  ) {
  }


  ngOnInit(): void {
    this.addEditorCommands();
    this.store.dispatch(RepositoryActions.GetRepositories());
    this.unsavedChanges$ = this.store.select(Select.codeEditorUnsavedChanges).pipe(takeUntil(this.destroy$));

    this.actions$.pipe(
      ofType(RepositoryActions.GetRepositoriesSuccess),
      switchMap(() => this.route.params),
      filter((params) => params["id"]),
      map((params) => Number(params["id"])),
      tap((id) => this.store.dispatch(CodeEditorActions.ConnectToEditWebsocket({repo:id}))),
      switchMap(id => this.store.select(Select.repoById,id)),
      tap((repo) => {
        if (!repo)
          this.router.navigate(['404'],{skipLocationChange:true});
      }),
      switchMap((repo) => {
        return this.editService.status$.pipe(
          filter((status) => status.state === 'ready'),
          map((_) => repo)
        )
      }),
      filter<RepositoryModel>(Boolean),
      takeUntil(this.destroy$)
    ).subscribe((repo: RepositoryModel) => {
      this.repo = repo;
      this.store.dispatch(CodeEditorActions.SetRepo({repo:repo}));
      // TODO:
      // this.store.dispatch(CodeEditorActions.SetWorkBenchConfig({config:repo.workbench_config}));
      Logger.logMessage("Repository update", repo);
    })


    this.store.select(Select.repofiles).pipe(
      filter<RepositoryFileEntry[]>(Boolean),
      switchMap((files) => {
        return this.store.select(Select.editingRepo).pipe(
          filter<RepositoryModel>(Boolean),
          map((repo) => [files,repo])
        )
      }),
      takeUntil(this.destroy$),
      take(1)
    ).subscribe(([files,repo]: [RepositoryFileEntry[],RepositoryModel]) => {
      /* TODO: 
      const mainfile = Object.values(repo.workbench_config.apps || {})[0].run
      const fileEntry = files.find((value) => value.path === mainfile)
      if (fileEntry)
        this.store.dispatch(CodeEditorActions.OpenTab({tab:fileEntry as any}));
      */
    });

    this.store.select(Select.appsToProcesses).pipe(
      takeUntil(this.destroy$)
    ).subscribe((apps) => {
      this.appsToProcess = apps;
    })

    this.store.select(Select.focusedCodeTab).pipe(
      takeUntil(this.destroy$),
      filter<CodeTab>(Boolean)
    ).subscribe((tab) => {
      this.focusedTab = tab;
      this.editorHandling.focus(tab.path);
    });

    this.actions$.pipe(
      ofType(CodeEditorActions.OpenTab),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      if (action.tab.mimeType && action.tab.mimeType.startsWith('image')) {
        this.imagePreviewHandling.createComponent(action.tab.path, {tab:action.tab});
      } else {
        this.editorHandling.createComponent(action.tab.path, {openedFile: action.tab});
      }
    });

    this.actions$.pipe(
      ofType(CodeEditorActions.CloseTab),
      takeUntil(this.destroy$)
    ).subscribe((action) => {
      this.editorHandling.closeByPath(action.tab.path);
    });

    this.store.select(Select.selectedDcmConnection).pipe(
      takeUntil(this.destroy$)
    ).subscribe((conn) => {
      this.selectedDcm = conn.api_base_url;
      if (this.focusedTab)
        this.runFile(null);
    });

    this.store.select(Select.editWebsocketState).pipe(
      takeUntil(this.destroy$)
    ).subscribe((connected) => {
      this.websocketConnected = connected;
      this.editorConfig$.next({ readOnly: !connected });
    });
    this.actions$.pipe(
      takeUntil(this.destroy$),
      ofType(CodeEditorActions.ConnectToEditWebsocketError)
    ).subscribe(async () => {
      const result = await this.snackBar.open("Couldn't connect to websocket.There's probably a connection already open.", "Force connection", {
        verticalPosition: 'top',
        duration: 5000

      }).afterDismissed().pipe(take(1)).toPromise();

      if (result.dismissedByAction)
        this.store.dispatch(CodeEditorActions.ConnectToEditWebsocket({ repo: this.repo.id, force: true }))
    });

    this.actions$.pipe(
      ofType(CodeEditorActions.ProcessProxyOpened),
      withLatestFrom(this.store.select(Select.processes)),
      takeUntil(this.destroy$)
    ).subscribe(([action, process]) => {
      const proc = process[action.pid]
      let title = String(action.port)
      if (!proc) {
        const found = Object.values(process).find((v) => action.pid in v.children)
        const child = found ? found.children[action.pid] : null;
        if (child)
          title = child.name
      } else {
        title = proc.args[0]
      }
      this.previewHandler.openPreview(title,action.pid,action.port,action.url)
    });


    this.actions$.pipe(
      ofType(CodeEditorActions.CommitChangesSuccess,CodeEditorActions.CommitChangesError),
      takeUntil((this.destroy$))
    ).subscribe((action) => {
      if (action.type === CodeEditorActions.CommitChangesSuccess.type) {
        this.snackBar.open('Committed changes!')
        this.editService.getGitStatus().then((status) => this.store.dispatch(CodeEditorActions.SetGitStatus({status})))
      } else {
        this.snackBar.open('Failed to commit changes!','Ok',{duration:null});
      }
    });

    this.actions$.pipe(
      takeUntil(this.destroy$),
      ofType(CodeEditorActions.ProcessStarted)
    ).subscribe((action) => {
      this.terminalHandling.openTerminal(action.process);
    });

    
    
  }

  onGlReady() {
    this.glHost.goldenLayout.loadLayout(DEFAULT_LAYOUT_CONFIG);

    this.terminalHandling.ready(this.glHost.goldenLayout, this.glHost.goldenLayout.rootItem.contentItems[1].contentItems[0] as RowOrColumn);
    this.previewHandler.ready(this.glHost.goldenLayout, this.glHost.goldenLayout.rootItem.contentItems[1] as RowOrColumn)
    this.editorHandling.ready(this.glHost.goldenLayout, (this.glHost.goldenLayout.rootItem.contentItems[1].contentItems[0] as RowOrColumn));
    this.fileTreeHandling.ready(this.glHost.goldenLayout, this.glHost.goldenLayout.rootItem.contentItems[0] as RowOrColumn);
    this.processTreeHandling.ready(this.glHost.goldenLayout, this.glHost.goldenLayout.rootItem.contentItems[0] as RowOrColumn)
    this.imagePreviewHandling.ready(this.glHost.goldenLayout, (this.glHost.goldenLayout.rootItem.contentItems[1].contentItems[0] as RowOrColumn))

    this.actions$.pipe(
      takeUntil(this.destroy$),
      ofType(CodeEditorActions.TaskStarted),
      filter(() => !!this.glHost)
    ).subscribe((action) => {
      this.terminalHandling.createComponent(action.name, {id:action.id,name:action.name, readonly: true});
    });

    this.fileTreeHandling.isOpen$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((isOpen) => {
      if (this.menuBar)
        this.menuBar.setChecked('SHOW_FILE_TREE', isOpen);
    });

    this.processTreeHandling.isOpen$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((isOpen) => {
      if (this.menuBar)
        this.menuBar.setChecked('SHOW_RUNNING', isOpen);
    })

    setTimeout(() => {
      this.fileTreeHandling.createComponent('Files',{});
      this.processTreeHandling.createComponent('Running', {})
    },0);

    this.glHost.goldenLayout.on('focus',(event) => {
      if (!(event.target instanceof ComponentItem)) return
      const container = event.target.container;
      findNeighbors(container);
    })

    this.keyBindService.bind('ctrl + alt + ArrowLeft',this.createSwitcherHandler('left'))
    this.keyBindService.bind('ctrl + alt + ArrowRight',this.createSwitcherHandler('right'))
    this.keyBindService.bind('ctrl + alt + ArrowUp',this.createSwitcherHandler('top'))
    this.keyBindService.bind('ctrl + alt + ArrowDown',this.createSwitcherHandler('bottom'))
    this.keyBindService.bind('ctrl + alt + PageUp', this.createStackSwitcherHandler(1));
    this.keyBindService.bind('ctrl + alt + PageDown', this.createStackSwitcherHandler(-1));
  }

  createSwitcherHandler(side: 'top' | 'bottom' | 'right' | 'left') {
    return () => {
      if (!this.glHost.goldenLayout) return
      const neighbors = findNeighbors(this.glHost.goldenLayout.focusedComponentItem.container);
      if (neighbors[side]) {
        const container = neighbors[side].container
        const component = container.component as GlComponentDirective
        const activeComponent = this.glHost.goldenLayout.focusedComponentItem.container.component as GlComponentDirective;
        this.glHost.goldenLayout.focusedComponentItem.container.blur(false);
        activeComponent.blur();
        container.focus()
        component.focus()
      }
    }
  }

  createStackSwitcherHandler(direction: 1 | -1) {
    return () => {
      if (!this.glHost.goldenLayout) return;
      if (!this.glHost.goldenLayout.focusedComponentItem.parent.isStack) return;
      const stack = this.glHost.goldenLayout.focusedComponentItem.parent as Stack;
      const index = stack.contentItems.indexOf(this.glHost.goldenLayout.focusedComponentItem)
      if (index === -1) return;
      let nextIndex = (index + direction) % stack.contentItems.length;
      if (nextIndex < 0) nextIndex = stack.contentItems.length - 1;
      const next = stack.contentItems[nextIndex]
      if ( next instanceof ComponentItem) {
        next.focus()
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
    this.store.dispatch(CodeEditorActions.Clear());
    // this.store.dispatch(StreamlitActions.StopScript({ name: this.project.name }));
    this.store.dispatch(CodeEditorActions.DisconnectFromEditWebsocket());
  }

  async onNewFile() {
    this.commonService.newFile();
  }

  async onNewFolder() {
    this.commonService.newFolder();
  }

  async onFileUpload(files: FileList) {

    if (!files || files.length === 0) return;

    for(const file of Array.from(files)) {
      this.commonService.uploadFile(this.repo.id, file.name, file);
    }
  }

  async onCommit() {
    if (this.openDialog) return;
    this.openDialog = this.dialog.open(CommitDialogComponent, {
      width: '350px',
      minHeight: '100px'
    });
    const result = await this.openDialog.afterClosed().pipe(take(1)).toPromise();

    if (result) {
      this.store.dispatch(CodeEditorActions.CommitChanges({repo:this.repo.id, commitMsg: result }));
      this.store.dispatch(RepositoryActions.GetRepository({id:this.repo.id}));
    }
    this.openDialog = null;
  }

  async onBuild() {
    try {
      await this.editService.runBuild();
    } catch(e) {

    }
  }

  runFile(filePath: string) {

    if (!filePath) {
      return;
    }

    this.snackBar.open("Starting script...", "", {
      duration: 1500,
      verticalPosition: 'top'
    })
    this.store.dispatch(CodeEditorActions.StartProcess({params:{
      path:filePath,
      env:{"DCM":this.selectedDcm}
    }}))
  }

  @HostListener('window:beforeunload', ['$event'])
  async canLeave(event: BeforeUnloadEvent) {
    if (await this.unsavedChanges$.pipe(take(1)).toPromise())
      return event.returnValue = 'Are you sure you want to leave this page? Changes may not be saved';
  }

  async menuAction(el: MenuItem) {
    if (!('id' in el)) return;

    switch (el.id) {
      case 'NEW_FILE':
        this.onNewFile();
        break;
      case 'NEW_FOLDER':
        this.onNewFolder();
        break;
      case 'UPLOAD_FILE':
        this.onUploadFiles();
        break;
      case 'SAVE_FILES':
        this.onSaveFiles();
        break;
      case 'SHOW_TOP_BAR':
        this.fullScreen = !this.fullScreen;
        if (this.glHost)
          this.glHost.goldenLayout.updateRootSize();
        break;
      case 'SHOW_TOOL_BAR':
        this.showToolBar = !this.showToolBar;
        if (this.glHost)
          this.glHost.goldenLayout.updateRootSize();
        break;
      case 'RUN':
        this.onRun(await this.pickAppForRunning());
        break;
      case 'COMMIT':
        this.onCommit();
        break;
      case 'SHOW_FILE_TREE':
        this.fileTreeHandling.toggle('File tree',{});
        break;
      case 'SHOW_RUNNING':
        this.processTreeHandling.toggle('Running', {});
        break;
      case 'FIND':
        this.editorHandling.focused?.monacoEditor?.trigger('', 'actions.find', null);
        break;
      case 'REPLACE':
        this.editorHandling.focused?.monacoEditor?.trigger('', 'editor.action.startFindReplaceAction', null)
        break;
      case 'UNDO':
        this.editorHandling.focused?.monacoEditor?.trigger('', 'undo', null);
        break;
      case 'REDO':
        this.editorHandling.focused?.monacoEditor?.trigger('', 'redo', null);
        break;
      case 'STOP':
        this.onStop(await this.pickAppForStopping())
        break;
      case 'OPEN_TERMINAL':
        this.onOpenTerminal();
        break;
      case 'BUILD':
        this.onBuild();
        break;
    }
  }

  onSaveFiles() {
    this.editorHandling.saveAll();
  }

  onUploadFiles() {
    pickFile(this.onFileUpload.bind(this));
  }

  onOpenTerminal() {
    this.store.dispatch(CodeEditorActions.StartProcess({params:{path:'bash','args':['--login']}}))
  }

  onRun(appName: string) {
    this.store.dispatch(CodeEditorActions.StartAppOrService({name:appName}));
  }

  onStop(appName: string) {
    const pid = this.appsToProcess[appName]
    if (!pid) return;
    this.store.dispatch(CodeEditorActions.StopProcess({pid:pid}));
  }

  reconnectWebsocket() {
    this.store.dispatch(CodeEditorActions.ConnectToEditWebsocket({
      repo:this.repo.id,
      force:true
    }))
  }

  isAppRunning(appName: string) {
    return appName in this.appsToProcess;
  }

  prettyPrintStream(data: string ){
    const ansiEscapeRegex = /(?:\x1B[@-_]|[\x80-\x9F])[0-?]*[ -/]*[@-~]/;
    data = data.replace(ansiEscapeRegex, "")
    return data
  }

  private async pickAppForRunning() {
    // TODO: 
    if (this.openDialog) return;
    this.openDialog = this.dialog.open<PickerDialogComponent, PickerDialogData, string>(PickerDialogComponent, {
      panelClass: 'no-container-dialog',
      position: {
        top: '50px'
      },
      hasBackdrop: true,
      data: {
        options: this.appsAndServices$.getValue(),
        placeholder: 'Choose what to run'
      }
    });
    const result = await this.openDialog.afterClosed().pipe(take(1)).toPromise();
    this.openDialog = null;
    return result;
  }

  private async pickAppForStopping() {
    if (Object.keys(this.appsToProcess).length === 0) {
      this.snackBar.open("Nothing's running");
      return null;
    }
    if (this.openDialog) return;
    this.openDialog = this.dialog.open<PickerDialogComponent, PickerDialogData, string>(PickerDialogComponent, {
      panelClass: 'no-container-dialog',
      position: {
        top: '50px'
      },
      hasBackdrop: true,
      data: {
        options: Object.keys(this.appsToProcess),
        placeholder: 'Choose what to stop'
      }
    });
    const result = await this.openDialog.afterClosed().pipe(take(1)).toPromise();
    this.openDialog = null;
    return result;
  }

  private addEditorCommands() {
    monaco.editor.addCommand({
      id:'RUN_APP',
      run:(_: unknown, name: string) => {
        this.onRun(name)
      }
    });

    monaco.editor.addCommand({
      id:'STOP_APP',
      run:(_:unknown,name: string) => {
        this.onStop(name);
      }
    });

    monaco.editor.addCommand({
      id:'RUN_BUILD',
      run:() => {
        this.onBuild();
      }
    });

    monaco.editor.addCommand({
      id:'INSTALL_PACKAGES',
      run: async () => {
        try {
          await this.editService.installExtraPackages();
        } catch {

        }
      }
    });

    monaco.editor.addCommand({
      id:'RUN_SETUP_SCRIPT',
      run: async () => {
        try {
          await this.editService.runSetupScript();
        } catch {

        }
      }
    });

  }
}

function pickFile(onFilePicked: (file: FileList) => void): void {
  const inputElemenet = document.createElement('input');
  inputElemenet.style.display = 'none';
  inputElemenet.type = 'file';

  inputElemenet.addEventListener('change', () => {
    if (inputElemenet.files) {
      onFilePicked(inputElemenet.files);
    }
  });

  const teardown = () => {
    document.body.removeEventListener('focus', teardown, true);
    setTimeout(() => {
      document.body.removeChild(inputElemenet);
    }, 1000);
  }
  document.body.addEventListener('focus', teardown, true);

  document.body.appendChild(inputElemenet);
  inputElemenet.click();
}