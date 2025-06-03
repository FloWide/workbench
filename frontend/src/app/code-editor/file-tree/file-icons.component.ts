import { Component, Input } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";



@Component({
    selector:'file-icon',
    template:`
        <img class="file-icon" [src]="icon" />
    `,
    styles:[`
        .file-icon {
            height: 1.2em;
            display: inline-block;
        }
    `]
})
export class FileIconComponent {
    ROOT = 'assets/icons'

    private _icon: SafeUrl;

    get icon(): string {
        return this._icon as string;
    }

    @Input() set icon(value: string) {
        this._icon = this.sanitizer.bypassSecurityTrustResourceUrl(`${this.ROOT}/${value}`)
    }

    constructor(private sanitizer: DomSanitizer) {}

}