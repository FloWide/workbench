import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullWidthDirective } from './full-width.directive';
import { MaxSizeDirective } from './max-size.directive';
import { UrlsafePipe } from './urlsafe.pipe';



@NgModule({
  declarations: [FullWidthDirective, MaxSizeDirective,UrlsafePipe],
  imports: [
    CommonModule
  ],
  exports:[FullWidthDirective,MaxSizeDirective,UrlsafePipe]
})
export class UtilsModule { }
