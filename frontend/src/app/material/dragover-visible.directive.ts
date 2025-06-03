import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2, ViewContainerRef } from '@angular/core';
import { fromEvent, merge, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Directive({
  selector: '[dragOverVisible]'
})
export class DragoverVisibleDirective implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  private overlay: HTMLDivElement = null;

  @Input('dragOverVisible') icon: string = '';

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2) {
    
    this.renderer.setStyle(elementRef.nativeElement,'position','relative');
  }
  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }
  ngOnInit(): void {
    this.overlay = this.renderer.createElement('div');
    this.overlay.classList.add('drag-over-overlay');
    this.overlay.innerHTML = `<span class="material-icons">${this.icon}</span>`
    fromEvent(this.elementRef.nativeElement,'dragover').pipe(
      takeUntil(this.destroy$)
    ).subscribe(this.onDragEnter.bind(this));
    
    merge(
      fromEvent(this.elementRef.nativeElement,'dragleave'),
      fromEvent(this.elementRef.nativeElement,'drop'),
      fromEvent(this.elementRef.nativeElement,'dragend')
    ).pipe(
    takeUntil(this.destroy$)
    ).subscribe(this.onDragLeave.bind(this));
  }

  private onDragEnter(event: DragEvent) {
    this.renderer.appendChild(this.elementRef.nativeElement,this.overlay);
  }

  private onDragLeave(event: DragEvent) {
    this.renderer.removeChild(this.elementRef.nativeElement,this.overlay);
  }

}
