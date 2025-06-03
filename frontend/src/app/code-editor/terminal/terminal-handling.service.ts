import { Injectable, OnDestroy } from "@angular/core";
import { GoldenLayout, EventEmitter, ComponentItem, ComponentContainer, RowOrColumn, Stack, Tab } from "golden-layout";
import { GoldenLayoutComponentService } from "src/app/golden-layout";
import { TerminalComponent } from "./terminal.component";
import { Process } from "@core/services/repo/repo.model";
import { Subject } from "rxjs";
import { Actions, ofType } from "@ngrx/effects";
import { CodeEditorActions } from "@core/store/code-editor/code-edior.action";
import { takeUntil } from "rxjs/operators";
import {ComponentHandlerService} from '../component-handler.service'


export interface TerminalState {
    id: string | number;
    readonly?: boolean;
    name?: string;
}

@Injectable()
export class TerminalHandlingService extends ComponentHandlerService<TerminalComponent, TerminalState> implements OnDestroy {
    
    private destroy$ = new Subject()

    constructor(
        glComponents: GoldenLayoutComponentService,
        private actions$: Actions
    ) {
        super(glComponents, TerminalComponent, 'terminal')
    }
    


    ready(
        gl: GoldenLayout,
        defaultTarget: RowOrColumn
    ) {
        super.ready(gl,defaultTarget);

        this.actions$.pipe(
            ofType((CodeEditorActions.ProcessExited), CodeEditorActions.TaskFinished),
            takeUntil(this.destroy$)
        ).subscribe((action) => {
            if ('pid' in action)
                this.deactivateComponent(action.pid);
            else
                this.deactivateComponent(action.id);
        });
    }

    openTerminal(process: Process) {
      this.createComponent(process.args[0],{id:process.pid})
    }

    closeTerminal(pid: number) {
        this.closeComponent(pid);
    }

    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    protected getId(component: TerminalComponent) {
        return component.id;
    }
}