import { Component, Inject, Input, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface PickerDialogData {
  options: string[];
  placeholder:string;
}

@Component({
  selector: 'app-picker-dialog',
  templateUrl: './picker-dialog.component.html',
  styleUrls: ['./picker-dialog.component.scss']
})
export class PickerDialogComponent implements OnInit {

  constructor(
    private dialogRef:MatDialogRef<PickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data:PickerDialogData
    ) { }

  ngOnInit(): void {
  }

  onValueChanged(value: string) {

    if(!this.data.options.includes(value)) return;

    this.dialogRef.close(value);
  }
}
