import { CodeTab } from "@core/store/code-editor/code-editor.state";
import { ComponentHandlerService, ComponentWithContainer } from "../component-handler.service";
import { ImagePreviewComponent } from "./image-preview.component";
import { Injectable } from "@angular/core";
import { GoldenLayoutComponentService } from "src/app/golden-layout";
import { EventEmitter } from "golden-layout";
import { AppState } from "@core/store";
import { Store } from "@ngrx/store";
import { CodeEditorActions } from "@core/store/code-editor/code-edior.action";


export interface ImagePreviewState {
    tab: CodeTab
}

@Injectable()
export class ImagePreviewHandlerService extends ComponentHandlerService<ImagePreviewComponent, ImagePreviewState> {

    constructor(
        glComponents: GoldenLayoutComponentService,
        private store: Store<AppState>
    ) {
        super(glComponents, ImagePreviewComponent, 'image-preview')
    }

    protected getId(component: ImagePreviewState | ImagePreviewComponent) {
        return component.tab.path
    }

    protected onItemDestroyed(args: EventEmitter.BubblingEvent): ComponentWithContainer<ImagePreviewComponent> {
        const comp = super.onItemDestroyed(args);
        if (!comp) return comp;
        const tab = comp.component.tab;
        this.store.dispatch(CodeEditorActions.CloseTab({tab:tab}));
        
    }

}