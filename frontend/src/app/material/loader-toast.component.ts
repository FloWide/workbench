import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Observable, Subject } from "rxjs";
import { map } from "rxjs/operators";


export interface LoaderToastData {
    message: string;
    total: number;
    progress$: Observable<number>;
    format?: (value: number) => string;
    cancel$?: Subject<void>;
}

@Component({
    selector: 'loader-toast',
    template: `
        <div class="loader-toast" (dblclick)="dismiss()">
            <div class="message-container">
                <span class="message">{{ data.message }}</span>
                <button mat-stroked-button class="cancel-button" (click)="cancel()">Cancel</button>
            </div>
            <div class="progress-container" *ngIf="data.total && data.total > 0">
                <mat-progress-bar color="primary" mode="determinate" [value]="percentage$ | async"></mat-progress-bar>
                <span class="progress-text">
                    {{ format((data.progress$ | async)) }} / {{ format(data.total) }} 
                    ({{ percentage$ | async }}%)
                </span>
            </div>
            <div class="progress-container" *ngIf="!data.total || data.total === 0">
                <mat-progress-bar color="primary" mode="query"></mat-progress-bar>
            </div>
        </div>
    `,
    styles: [`
        .loader-toast {
            display: flex;
            flex-direction: column;
            padding: 6px 10px;
            min-width: 320px;
        }

        .message {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .progress-container {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
        }

        mat-progress-bar {
            flex-grow: 1;
            height: 6px;
            border-radius: 6px;
        }

        .progress-text {
            font-size: 0.75rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .message-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
       }
       .cancel-button {
            padding: 0 6px;
            font-size: 0.75rem;
            line-height: 1;
            height: 20px;
            min-width: unset;
        }
    `]
})
export class LoaderToastComponent {

    percentage$ = this.data.progress$.pipe(
        map((value) => Math.floor(value / this.data.total * 100))
    )

    format = this.data.format || this.defaultFormat;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: LoaderToastData,
        private dialogRef: MatDialogRef<LoaderToastComponent>
    ) {}

    dismiss() {
        this.dialogRef.close();
    }

    cancel() {
        if (this.data.cancel$) {
            this.data.cancel$.next();
            this.data.cancel$.complete();
        }
        this.dialogRef.close();
    }

    private defaultFormat(value: number) {
        return value.toFixed(2)
    }

}