import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RepositoryCreationModel } from '@core/services/repo/repo.model';

@Component({
  selector: 'app-create-new-dialog',
  templateUrl: './create-new-dialog.component.html',
  styleUrls: ['./create-new-dialog.component.scss']
})
export class CreateNewDialogComponent implements OnInit {

  types = ['streamlit', 'python', 'service', 'nextjs', 'empty']

  creationForm = new FormGroup({
    name: new FormControl('',[Validators.required,this.nameValidator()]),
    template: new FormControl(this.types[0],Validators.required)
  })

  constructor(
    private dialogRef: MatDialogRef<CreateNewDialogComponent,RepositoryCreationModel>,
    @Inject(MAT_DIALOG_DATA) private taken_names: string[]
  ) { }

  ngOnInit(): void {
  }

  onClose() {
    this.dialogRef.close(null);
  }

  onSubmit() {
    this.dialogRef.close(this.creationForm.value as any)
  }

  getErrorMessage(control: AbstractControl) {
    if (control.hasError("name_taken"))
      return "Repository with that name already exists"
    else if(control.hasError('required'))
      return "Name is required"
    return ''
  }

  private nameValidator(): ValidatorFn {
    return (control:AbstractControl): ValidationErrors => {
      if(!control.value) return null;
      const valid = !this.taken_names.includes(control.value)
      return valid ? null : {'name_taken':true}
    }
  }

}
