import { ComponentType } from "@angular/cdk/portal";
import { Injectable } from "@angular/core";
import { DialogPosition, MatDialog, MatDialogRef } from "@angular/material/dialog";


@Injectable()
export class ToastService {

    readonly MAX_TOAST = 5;
    readonly OFFSET = 70;
    readonly START_FROM = 30;
    
    private dialogs: MatDialogRef<unknown>[] = [];

    constructor(private matDialog: MatDialog) {}

    open<T, D = any, R = any>(component: ComponentType<T>, data: D): MatDialogRef<T, R> | null {
        if (this.dialogs.length >= this.MAX_TOAST) {
            return null;
        }
        const dialog = this.matDialog.open(component, {
            panelClass: 'toast-panel',
            hasBackdrop: false,
            data:data,
            position:this.calculatePosition(this.dialogs.length)
        })
        this.dialogs.push(dialog);

        dialog.afterClosed().subscribe(() => {
            this.dialogs.splice(this.dialogs.indexOf(dialog), 1);
            this.updateDialogPositions();
        });
        return dialog;
    }

    closeAll() {
        this.dialogs.forEach(dialog => dialog.close());
    }

    private calculatePosition(index: number): DialogPosition {
        return {
            bottom: `${this.OFFSET * index + this.START_FROM}px`,
            right: '10px'
        }
    }

    private updateDialogPositions() {
        this.dialogs.forEach((dialog, index) => {
            dialog.updatePosition(this.calculatePosition(index));
        });
    }
}