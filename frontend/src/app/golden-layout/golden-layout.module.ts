import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoldenLayoutHost } from './golden-layout-host.component';
import { GoldenLayoutComponentService } from './golden-layout-component.service';



@NgModule({
  declarations: [GoldenLayoutHost],
  imports: [
    CommonModule
  ],
  providers:[
    GoldenLayoutComponentService,
  ],
  exports:[
    GoldenLayoutHost
  ],
})
export class GoldenLayoutModule { }
