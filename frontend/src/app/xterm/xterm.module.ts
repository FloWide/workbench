import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { XtermComponent } from './xterm/xterm.component';
import { BaseTermComponent } from './base-term.component';



@NgModule({
  declarations: [
    XtermComponent,
    BaseTermComponent
  ],
  imports: [
    CommonModule
  ],
  exports:[
    XtermComponent,
    BaseTermComponent
  ]
})
export class XtermModule { }
