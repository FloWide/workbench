import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-commit-dialog',
  templateUrl: './commit-dialog.component.html',
  styleUrls: ['./commit-dialog.component.scss']
})
export class CommitDialogComponent{

  constructor(private dialogRef:MatDialogRef<CommitDialogComponent>) { }

  onClose() {
    this.dialogRef.close();
  }

  onSubmit(value:string) {
    this.dialogRef.close(value);
  }

}
