import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';


export interface ExtraConfirmAction {
  button: string;
  value: string;
  color: string;
}

export interface ConfirmDialogData {
  title:string;
  submitButton:string;
  message:string;
  color:string;
  extraActions?: ExtraConfirmAction[];
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent implements OnInit {

  constructor(private dialogRef:MatDialogRef<ConfirmDialogComponent, string>,
    @Inject(MAT_DIALOG_DATA) public data:ConfirmDialogData) { }

  ngOnInit(): void {
  }

  onClose() {
    this.dialogRef.close(null);
  }

  onSubmit(value:string) {
    this.dialogRef.close(value);
  }

}
