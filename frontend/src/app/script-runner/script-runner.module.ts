import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptRunnerComponent } from './script-runner/script-runner.component';
import { RouterModule, Routes } from '@angular/router';
import { ComponentsModule } from '@components/components.module';
import { MaterialModule } from '@material/material.module';
import { UtilsModule } from '../utils/utils.module';
import { XtermModule } from '../xterm/xterm.module';
import { ScriptLoadingComponent } from './script-loading/script-loading.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import {DragDropModule} from '@angular/cdk/drag-drop'

const routes: Routes = [
  {
    path:'',
    component:ScriptRunnerComponent
  }
]

@NgModule({
  declarations: [
    ScriptRunnerComponent,
    ScriptLoadingComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ComponentsModule,
    MaterialModule,
    UtilsModule,
    XtermModule,
    FlexLayoutModule,
    DragDropModule
  ],
  exports:[
    ScriptRunnerComponent,
    ScriptLoadingComponent
  ]
})
export class ScriptRunnerModule { }
