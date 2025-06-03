import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KioskPageComponent } from './kiosk-page/kiosk-page.component';
import { RouterModule, Routes } from '@angular/router';
import { ScriptRunnerModule } from '../script-runner/script-runner.module';
import { MaterialModule } from '@material/material.module';

const routes: Routes = [
  {
    path:':name/:version',
    component:KioskPageComponent
  }
]

@NgModule({
  declarations: [
    KioskPageComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ScriptRunnerModule
  ]
})
export class KioskModeModule { }
