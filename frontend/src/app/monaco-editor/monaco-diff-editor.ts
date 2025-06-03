import { Component, Input } from "@angular/core";
import { BaseEditorComponent } from "./base-editor.component";


@Component({
    selector:'monaco-diff-editor',
    template:`<div class="editor-container" #editorContainer></div>`,
    styles:[`
        :host {
            display: block;
            height: 100%;
        }
        .editor-container {
            width: 100%;
            height: 100%;
        }
    `]
})
export class MonacoDiffEdtitor extends BaseEditorComponent {

    protected initMonaco(): void {
        throw new Error("Method not implemented.");
    }

}