import { Injectable, OnDestroy } from '@angular/core';
import { WorkBenchConfig } from '@core/services/repo/repo.model';
import { AppState, Select } from '@core/store';
import { CodeEditorActions } from '@core/store/code-editor/code-edior.action';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import * as monaco from 'monaco-editor';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {EventEmitter} from 'vscode'


@Injectable()
export class WorkBenchConfigCodeLensProvider implements monaco.languages.CodeLensProvider, OnDestroy {

    private destroy$ = new Subject();

    private workbenchConfig: WorkBenchConfig;
    
    private runningApps: string[] = []

    private runningTasks: Set<string> = new Set();

    private networks: Record<string, string> = {};

    constructor(
        private store: Store<AppState>,
        private actions$: Actions
    ) {

        this.store.select(Select.workbenchConfig).pipe(
            takeUntil(this.destroy$)
        ).subscribe((workbenchConfig) => {
            this.workbenchConfig = workbenchConfig;
        });

        this.store.select(Select.appsToProcesses).pipe(
            takeUntil(this.destroy$)
        ).subscribe((apps) => {
            this.runningApps = Object.keys(apps);
            this.onChange.fire(this);
        });

        this.actions$.pipe(
            takeUntil(this.destroy$),
            ofType(CodeEditorActions.TaskStarted)
        ).subscribe((action) => {
            if (this.runningTasks.has(action.name)) return;
            this.runningTasks.add(action.name);
            this.onChange.fire(this);
        });

        this.actions$.pipe(
            takeUntil(this.destroy$),
            ofType(CodeEditorActions.TaskFinished)
        ).subscribe((action) => {
            if (!this.runningTasks.has(action.name)) return;
            this.runningTasks.delete(action.name);
            this.onChange.fire(this);
        });

        this.actions$.pipe(
            takeUntil(this.destroy$),
            ofType(CodeEditorActions.NetworkConnected)
        ).subscribe((action) => {
            this.networks[action.name] = action.ip;
            this.onChange.fire(this);
        });

        this.actions$.pipe(
            takeUntil(this.destroy$),
            ofType(CodeEditorActions.NetworkDisconnected)
        ).subscribe((action) => {
            delete this.networks[action.name];
            this.onChange.fire(this);
        });

    }


    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
        this.runningApps = [];
        this.workbenchConfig = null;
        this.runningTasks.clear();
        this.onChange.fire(this);
    }

    private onChange = new EventEmitter<this>();

    onDidChange?: monaco.IEvent<this> = this.onChange.event;
    provideCodeLenses(model: monaco.editor.ITextModel, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CodeLensList> {
        const lenses: monaco.languages.CodeLens[] = []

        if (!model.uri.path.endsWith('workbench.yml')) {
            return {
                lenses:lenses,
                dispose: () => {}
            }
        }
        return {
            lenses:[
                ...this.appCodeLens(model),
                ...this.buildCodeLens(model),
                ...this.setupScriptCodeLens(model),
                ...this.extraPackagesCodeLens(model),
                ...this.networksCodeLens(model)
            ],
            dispose: () => {}
        }
    }
    resolveCodeLens?(model: monaco.editor.ITextModel, codeLens: monaco.languages.CodeLens, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CodeLens> {
        return codeLens
    }

    private appCodeLens(model: monaco.editor.ITextModel): monaco.languages.CodeLens[] {
        const apps = [...Object.keys(this.workbenchConfig?.apps || {}), ...Object.keys(this.workbenchConfig?.services || {})];

        const result: monaco.languages.CodeLens[] = [];

        for(const app of apps) {
            const appMatches = model.findMatches(`${app}:`,false,false,false,null,true);
            if (appMatches.length === 0) continue;

            let command: monaco.languages.Command = null;
            if (this.runningApps.includes(app)) {
                command = {
                     id:'STOP_APP',
                     title:'\u{25A0} Stop',
                     arguments:[app]
                }
            } else {
                command = {
                    id:'RUN_APP',
                    title:'\u{25BA} Run',
                    arguments:[app]
                }
            }

            result.push({
                range:appMatches[0].range,
                id:app,
                command:command
            })
        }
        return result
    }

    private buildCodeLens(model: monaco.editor.ITextModel) : monaco.languages.CodeLens[] {
        if (!this.workbenchConfig?.build?.cmd) {
            return []
        }

        const matches = model.findMatches('build:', false, false, false, null, true);
        if (matches.length === 0) return [];

        if (this.runningTasks.has('build')) {
            return [{
                range:matches[0].range,
                id:'build',
                command:{
                    id:null,
                    title:'\u{1F6E0} Building...'
                }
            }]
        } else {
            return [{
                range:matches[0].range,
                id:'build',
                command:{
                    id:'RUN_BUILD',
                    title:'\u{1F6E0} Build'
                }
            }]
        }
    }

    private extraPackagesCodeLens(model: monaco.editor.ITextModel) : monaco.languages.CodeLens[] {
        if (!this.workbenchConfig?.setup?.packages) return []

        const matches = model.findMatches('packages:', false, false, false, null, true);
        if (matches.length === 0) return [];


        if (this.runningTasks.has('package_install')) {
            return [{
                range:matches[0].range,
                id:'packages',
                command:{
                    id:null,
                    title:' \u{1F504} Installing...'
                }
            }]
        } else {
            return [{
                range:matches[0].range,
                id:'packages',
                command:{
                    id:'INSTALL_PACKAGES',
                    title:'\u{25BA} Install'
                }
            }]
        }

    }

    private setupScriptCodeLens(model: monaco.editor.ITextModel) : monaco.languages.CodeLens[] {
        if (!this.workbenchConfig?.setup?.setup_script) return []

        const matches = model.findMatches('setupScript:', false, false, false, null, true);
        if (matches.length === 0) return [];


        if (this.runningTasks.has('setup_script')) {
            return [{
                range:matches[0].range,
                id:'setup_script',
                command:{
                    id:null,
                    title:'\u{1F504} Running...'
                }
            }]
        } else {
            return [{
                range:matches[0].range,
                id:'setup_script',
                command:{
                    id:'RUN_SETUP_SCRIPT',
                    title:'\u{25BA} Run'
                }
            }]
        }

    }

    private networksCodeLens(model: monaco.editor.ITextModel) : monaco.languages.CodeLens[] {
        if (!this.workbenchConfig?.networks) return [];

        const result: monaco.languages.CodeLens[] = [];
        for(const network of this.workbenchConfig.networks) {
            if (!(network in this.networks)) continue;
            const matches = model.findMatches(network, false, false, true, null, true)
            if (matches.length === 0) continue;

            result.push({
                range:matches[0].range,
                id:`${network}-network`,
                command:{
                    id:null,
                    title:this.networks[network]
                }
            })
        }
        return result;

    }

}