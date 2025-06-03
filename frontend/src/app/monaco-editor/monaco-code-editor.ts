import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { BaseEditorComponent } from "./base-editor.component";
import * as monaco from 'monaco-editor';


@Component({
    selector:'monaco-code-editor',
    template:`<div class="editor-container" #editorContainer></div>`,
    styles:[`
        :host {
            display: block;
            box-sizing:border-box;
            height: 100%;
        }
        .editor-container {
            box-sizing: border-box;
            width: 100%;
            height: calc(100% - 16px);
        }
    `]
})
export class MonacoCodeEditor extends BaseEditorComponent implements OnChanges {
    
    @Output() onInit = new EventEmitter<monaco.editor.IStandaloneCodeEditor>();

    @Input() options: monaco.editor.IStandaloneEditorConstructionOptions;

    @Input() value?: string;

    protected initMonaco(): void {
        this.editor = monaco.editor.create(this.editorContainer.nativeElement,this.options);
        if (this.value)
            this.editor.setValue(this.value)
        this.onInit.emit(this.editor);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if(!this.editor) return;
        if(changes.value) {
            (this.editor as monaco.editor.IStandaloneCodeEditor).setValue(this.value);
        }
    }

}