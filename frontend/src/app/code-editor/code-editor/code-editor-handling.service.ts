import { GoldenLayoutComponentService } from "src/app/golden-layout";
import { ComponentHandlerService, ComponentWithContainer } from "../component-handler.service";
import { CodeEditorComponent } from "./code-editor.component";
import { CodeTab } from "@core/store/code-editor/code-editor.state";
import { Injectable } from "@angular/core";
import { GoldenLayout, RowOrColumn, EventEmitter, ComponentItem } from "golden-layout";
import { Store } from "@ngrx/store";
import { AppState } from "@core/store";
import { CodeEditorActions } from "@core/store/code-editor/code-edior.action";


export interface CodeEditorState {
    openedFile: CodeTab;
    selectionOrPosition?: monaco.IRange | monaco.IPosition;
    id?: number;
}

@Injectable()
export class CodeEditorHandlingService extends ComponentHandlerService<CodeEditorComponent, CodeEditorState> {

    protected _focused: CodeEditorComponent = null;

    private extraId: number = 0;

    private tabsToComponents: Map<string, Set<String>> = new Map();

    constructor(
        glComponents: GoldenLayoutComponentService,
        private store: Store<AppState>
    ) {
        super(glComponents, CodeEditorComponent, 'editor');
    }


    createComponent(title: string, state: CodeEditorState): void {
        if (!('id' in state) || (state.id === undefined || state.id === null)) {
            state.id = this.extraId++;
        }
        super.createComponent(title, state)
        if (this.tabsToComponents.has(state.openedFile.path)) {
            this.tabsToComponents.get(state.openedFile.path).add(this.getId(state));
        } else {
            this.tabsToComponents.set(state.openedFile.path, new Set());
            this.tabsToComponents.get(state.openedFile.path).add(this.getId(state));
        }
    }

    closeByPath(path: string) {
        const ids = this.tabsToComponents.get(path)
        if (!ids) return;

        ids.forEach((id) => {
            this.closeComponent(id);
        })
    }

    setStateByPath(path: string, state: Partial<CodeEditorState>) {
        const ids = this.tabsToComponents.get(path)
        if (!ids) return;
        ids.forEach((id) => {
            this.setState(id, state);
        });
    }

    getByPath(path: string) {
        const ids = this.tabsToComponents.get(path)
        if (!ids) return [];

        const activeComponents: ComponentWithContainer<CodeEditorComponent>[] = [];
        const inactiveComponents: ComponentWithContainer<CodeEditorComponent>[] = [];

        ids.forEach((id) => {
            const [component, isActive] = this.getComponent(id);
            if (!component) return;
            if (isActive) activeComponents.push(component)
            else inactiveComponents.push(component)
        })

        return [activeComponents, inactiveComponents]
    }

    ready(gl: GoldenLayout, defaultTarget: RowOrColumn): void {
        super.ready(gl, defaultTarget);
        this.gl.on('focus',this.onGlFocus.bind(this))
    }

    focus(path: string) {
        if (!this.tabsToComponents.has(path)) return;

        const first: string = this.tabsToComponents.get(path).values().next().value

        this.activeComponents.get(first).container.focus();
    }

    saveAll() {
        this.activeComponents.forEach((value) => {
            value.component.saveCode();
        })
    }

    get focused() {
        return this._focused
    }

    protected onItemDestroyed(args: EventEmitter.BubblingEvent): ComponentWithContainer<CodeEditorComponent> {
        const comp = super.onItemDestroyed(args)
        if (!comp) return comp
        const id = this.getId(comp.component);
        const path = comp.component.openedFile.path;
        if (this.tabsToComponents.has(path)) {
            this.tabsToComponents.get(path).delete(id)
            if (this.tabsToComponents.get(path).size === 0) {
                this.tabsToComponents.delete(path);
            }
        }

        if(!this.tabsToComponents.has(path)) {
            this.store.dispatch(CodeEditorActions.CloseTab({tab:comp.component.openedFile}));
        }
        return comp;
    }

    protected getId(component: CodeEditorComponent | CodeEditorState) {
        return `${component.openedFile.path}-${component.id}`
    }

    protected onGlFocus(args: EventEmitter.BubblingEvent) {
        if ( !(args.target instanceof ComponentItem)) return;

        if (args.target.componentType !== this.componentName) return;

        this._focused = args.target.component as CodeEditorComponent;
    }

}