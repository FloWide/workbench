import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Release, CreateReleaseModel } from '@core/services/release/release.model';
import { GitState, RepositoryModel } from '@core/services/repo/repo.model';


export interface CreateReleaseDialogData {
  releases: Release[];
  gitState: GitState;
  repo: RepositoryModel
}

@Component({
  selector: 'app-create-release-dialog',
  templateUrl: './create-release-dialog.component.html',
  styleUrls: ['./create-release-dialog.component.scss']
})
export class CreateReleaseDialogComponent implements OnInit {

  creationForm = new FormGroup({
    name: new FormControl('',[Validators.required]),
    tag: new FormControl('', [Validators.required])
  })

  target_refish: string = this.data.gitState.head;

  constructor(
    private dialogRef: MatDialogRef<CreateReleaseDialogComponent,CreateReleaseModel>,
    @Inject(MAT_DIALOG_DATA) public data: CreateReleaseDialogData
  ) { }

  ngOnInit(): void {
  }

  onClose() {
    this.dialogRef.close(null);
  }

  onSubmit() {
    this.dialogRef.close({
      name: this.creationForm.get('name').value,
      git_tag: this.creationForm.get('tag').value,
      repo_id:this.data.repo.id,
      target_refish: this.target_refish || this.data.gitState.head
    })
  }
}
