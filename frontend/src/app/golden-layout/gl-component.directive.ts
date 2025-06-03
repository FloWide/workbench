import { Directive, DoCheck, EmbeddedViewRef, TemplateRef, ViewChild } from '@angular/core';
import { ComponentContainer } from 'golden-layout';

export interface GlTabContext {
    container: ComponentContainer
    title: string;
}

@Directive()
export abstract class GlComponentDirective<TabContext extends GlTabContext = GlTabContext> implements DoCheck {

  @ViewChild('tabTemplate', {read:TemplateRef, static:true}) tabTemplate: TemplateRef<TabContext>;
  
  private tabEmbedRef: EmbeddedViewRef<TabContext> = null;

  constructor(private rootElement: HTMLElement) {
    this.rootElement.style.position = 'absolute';
    this.rootElement.style.overflow = 'hidden';
   }
    ngDoCheck(): void {
        if (this.tabEmbedRef)
            this.tabEmbedRef.detectChanges();
    }

  setPositionAndSize(left: number, top: number, width: number, height: number) {
      this.rootElement.style.left = this.numberToPixels(left);
      this.rootElement.style.top = this.numberToPixels(top);
      this.rootElement.style.width = this.numberToPixels(width);
      this.rootElement.style.height = this.numberToPixels(height);
  } 

  setVisibility(visible: boolean) {
      if (visible) {
          this.rootElement.style.display = '';
      } else {
          this.rootElement.style.display = 'none';
      }
  }

  setZIndex(value: string) {
      this.rootElement.style.zIndex = value;
  }

  getTabTemplate() : TemplateRef<TabContext> | null {
    return this.tabTemplate;
  }

  setTabEmbedRef(ref: EmbeddedViewRef<TabContext>) {
    this.tabEmbedRef = ref;
  }

  focus(): void {

  };

  blur(): void {

  }

  private numberToPixels(value: number): string {
      return value.toString(10) + 'px';
  }

}