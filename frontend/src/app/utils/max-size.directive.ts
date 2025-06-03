import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[maxSize]'
})
export class MaxSizeDirective {

  constructor(el:ElementRef) {
    el.nativeElement.style.width = '100%';
    el.nativeElement.style.height = '100%';
   }

}
