import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';


export interface InputDialogData {
  title:string;
  submitButton:string;
  inputLabel:string;
  inputPrefix?:string;
  defaultValue?:string;
  hint?:string;
}

@Component({
  selector: 'app-input-dialog',
  templateUrl: './input-dialog.component.html',
  styleUrls: ['./input-dialog.component.scss']
})
export class InputDialogComponent{


  @ViewChild('inputField',{static:true}) inputField: ElementRef;

  constructor(private dialogRef:MatDialogRef<InputDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data:InputDialogData ) { }

  onClose() {
    this.dialogRef.close();
  }

  onSubmit(value:string) {
    this.dialogRef.close(value);
  }

  inputKeyDown(event: KeyboardEvent) {
    if(event.key === 'Enter')
      this.onSubmit(this.inputField.nativeElement.value);
  }

}
