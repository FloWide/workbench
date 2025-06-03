import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[fullWidth]'
})
export class FullWidthDirective {

  constructor(el:ElementRef) {
    el.nativeElement.style.width = '100%'
   }
}
