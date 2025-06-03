import { ComponentRef, Directive, ElementRef, HostBinding, Injector, Input, OnInit, Renderer2, ViewContainerRef } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Directive({
  selector: '[spinOn]'
})
export class SpinnerDirective implements OnInit {

  private shouldShow = false;

  spinner: ComponentRef<MatProgressSpinner>;

  @HostBinding('class.spin-on-container') isSpinnerExist = false;

  @Input('spinOn') 
  set spinOn(value: boolean) {
      if (value) {
        this.show();
      } else {
        this.hide();
      }
      this.shouldShow = value;
  }

  constructor(
    private view: ViewContainerRef,
    private renderer:Renderer2,
    private element:ElementRef) { }

  ngOnInit(): void {
    if(this.shouldShow)
      this.show();
  }

  show() {
    if(!this.isSpinnerExist) {
      this.spinner = this.view.createComponent(MatProgressSpinner);
      this.spinner.location.nativeElement.style.position = 'absolute';
      this.spinner.location.nativeElement.style.top = 'calc(50% - 50px)';
      this.spinner.location.nativeElement.style.left = 'calc(50% - 50px)';
      this.spinner.instance.color = 'warn';
      this.spinner.instance.mode = 'indeterminate';
      this.renderer.appendChild(this.element.nativeElement,this.spinner.location.nativeElement);
      this.isSpinnerExist = true;
    }
  }

  hide() {
    if(this.isSpinnerExist) {
      this.view.remove();
      this.isSpinnerExist = false;
    }
  }

}
