import { Inject, Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";
import { filter, takeUntil,take, switchMap, withLatestFrom } from "rxjs/operators";
import { MONACO_LOADED } from "src/app/monaco-editor/monaco-editor.module";

import { CloseAction, ErrorAction, MonacoServices, MessageTransports } from 'monaco-languageclient';
import { RepositoryEditService, Status } from "@core/services/repo/repo-edit.service";
import * as monaco from 'monaco-editor';
import { CustomHttpService } from "@core/services";
import {LanguageClient, LanguageClientMiddlewares, MessageReader, MessageWriter} from './lsp'

import * as monacoyaml from 'monaco-yaml'
import { AppState, Select } from "@core/store";
import { Store } from "@ngrx/store";
import { LanguageService } from "@core/services/repo/repo.model";
import { CodeEditorHandlingService } from "./code-editor-handling.service";
import { CodeEditorTextModelsService } from "./code-editor-text-models.service";
import { WorkBenchConfigCodeLensProvider } from "./lsp/workbench-config-lens";
import {relative, basename} from 'path-browserify';



function isLanguageService(obj: unknown): obj is LanguageService {
    return typeof obj === 'object' && 'cmd' in obj && 'languages' in obj
}


@Injectable()
export class CodeEditorLspService implements OnDestroy {

    private destroy$ = new Subject();

    private clients: Record<string, LanguageClient> = {};

    private middlewares: LanguageClientMiddlewares = new LanguageClientMiddlewares(this.editHandler, this.editService, this.textModelService);

    private statusBehavior$ = new BehaviorSubject<Status>({state:'starting'});

    private disposables: monaco.IDisposable[] = [];

    constructor(
        @Inject(MONACO_LOADED) private monacoLoaded$: BehaviorSubject<boolean>,
        private store: Store<AppState>,
        private editService: RepositoryEditService,
        private editHandler: CodeEditorHandlingService,
        private textModelService: CodeEditorTextModelsService,
        private http: CustomHttpService,
        workbenchLensService: WorkBenchConfigCodeLensProvider
    ) {
        this.disposables.push(monaco.languages.registerCodeLensProvider('yaml',workbenchLensService));
        this.disposables.push(monaco.editor.registerEditorOpener({
            openCodeEditor: this.newEditorOpener.bind(this),
        }))
        this.monacoLoaded$.pipe(
            takeUntil(this.destroy$),
            filter((v) => v),
            take(1)
        ).subscribe(() => {
            this.disposables.push(MonacoServices.install(monaco as any));
            this.setupSchemaValidation();
        });
        this.editService.status$.pipe(takeUntil(this.destroy$)).subscribe(this.statusBehavior$);
        this.editService.onLspServiceStarted$.pipe(
            takeUntil(this.destroy$),
            switchMap(() => this.statusBehavior$),
            filter((status) => status.state === 'ready'),
            withLatestFrom(this.store.select(Select.workbenchConfig))
        ).subscribe(([_, config]) => {
            this.stopClients();

            if (config.development?.languageService) {
                Object.entries(config.development.languageService).forEach(([name, lspConfig]) => {
                    if (isLanguageService(lspConfig)) {
                        this.startLspService(name, lspConfig.languages)
                    } else {
                        this.startLspService(name, [name])
                    }
                })
            }
        })
    }

    async startLspService(lang: string, documentSelector: string[]) {
        try {
            await this.editService.connectToLsp(lang)
        } catch(e) {
            console.warn(e);
        }
        const writer = new MessageWriter(lang,this.editService);
        const reader = new MessageReader(lang, this.editService);
        const languageClient = this.createLanguageClient(lang,documentSelector, {reader,writer})
        languageClient.start();
        this.clients[lang] = languageClient;
    }

    private createLanguageClient (lang: string, documentSelector: string[],transports: MessageTransports): LanguageClient {
        return new LanguageClient({
            name: `${lang} lsp client`,
            clientOptions: {
                // use a language id as a document selector
                documentSelector: documentSelector,
                // disable the default error handler
                middleware:this.middlewares,
                errorHandler: {
                    error: () => ({ action: ErrorAction.Continue }),
                    closed: () => ({ action: CloseAction.DoNotRestart })
                }
            },
            // create a language client connection from the JSON RPC connection on demand
            connectionProvider: {
                get: () => {
                    return Promise.resolve(transports);
                }
            }
        });
    }
    
    private setupSchemaValidation() {
        monacoyaml.setDiagnosticsOptions(
            {
              enableSchemaRequest: true,
              hover: true,
              completion: true,
              validate: true,
              format: true,
              schemas:[
                  {
                    // Id of the first schema
                    uri: `${this.http.API.api}/schemas/workbench.schema`,
                    // Associate with our model
                    fileMatch: [String('workbench.yml')]
                  },
              ]
            }
          )
    }

    private async newEditorOpener(source: monaco.editor.ICodeEditor, resource: monaco.Uri, selectionOrPosition?: monaco.IRange | monaco.IPosition): Promise<boolean> {
        const fullPath = decodeURIComponent(resource.toString().replace('file://',''));
        const cwd = await this.editService.getCwd();
        const path = relative(cwd, fullPath);
        const [active, inactive] = this.editHandler.getByPath(path);
        if(active && active.length > 0) {
            active[0].component.reveal(selectionOrPosition);
            return true;
        } else if(inactive && inactive.length > 0) {
            inactive[0].component.reveal(selectionOrPosition);
            return true;
        } else {
            this.editHandler.createComponent(path, {
                openedFile:{
                    absolutePath:fullPath,
                    isDirectory:false,
                    modified:false,
                    path:path,
                    mimeType:'text/plain',
                    name:basename(path)
                },
                selectionOrPosition:selectionOrPosition
            })
        }
        return true;
    }


    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
        this.stopClients();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }

    stopClients() {
        if (this.clients) {
            Object.entries(this.clients).forEach(([id, client]) => {
                client.stop();
                delete this.clients[id];
            })
        }
    }
}