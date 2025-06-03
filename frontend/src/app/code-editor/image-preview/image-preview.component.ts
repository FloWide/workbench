import { Component, ElementRef, Input, OnInit } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { RepositoryEditService } from "@core/services/repo/repo-edit.service";
import { CodeTab } from "@core/store/code-editor/code-editor.state";
import { from } from "rxjs";
import { GlComponentDirective } from "src/app/golden-layout";
import {getIconForFile} from 'vscode-icons-ts'


@Component({
    selector:'app-image-preview',
    template:`
        <img [src]="src" [alt]="tab.name">

        <ng-template #tabTemplate let-container="container" let-title="title">
            <file-icon [icon]="getIconForFile(tab.name)" style="height:1em;margin: 0px 5px 0px 5px"></file-icon>
            <span class="lm_title" (click)="container.focus()">{{title}}</span>
            <div class="lm_close_tab" (click)="container.close()"></div>
        </ng-template>
    `,
    styles:[`
        :host {
            display: block;
            overflow-y: scroll;
            overflow-x: scroll;
        }
        img {
            max-width: 100%;
            max-height: 100%;
        }
    `]
})
export class ImagePreviewComponent extends GlComponentDirective implements OnInit {
    
    @Input() tab: CodeTab

    src: SafeResourceUrl = "";

    getIconForFile = getIconForFile

    constructor(
        el: ElementRef,
        private editService: RepositoryEditService,
        private sanitizer: DomSanitizer
    ) {
        super(el.nativeElement)
    }

    ngOnInit(): void {
        from(this.editService.getBase64FileContent(this.tab.path)).subscribe((data) => {
            this.src = this.sanitizer.bypassSecurityTrustResourceUrl(`data:${this.tab.mimeType};base64, ${data}`);
        })
    }

    focus(): void {
        
    }

}