import { FocusMonitor } from "@angular/cdk/a11y";
import { Directionality } from "@angular/cdk/bidi";
import { Overlay } from "@angular/cdk/overlay";
import { Directive, ElementRef, HostListener, Inject, Input, NgZone, Optional, Self, ViewContainerRef } from "@angular/core";
import { MAT_MENU_PANEL, MAT_MENU_SCROLL_STRATEGY, MatMenuItem, MatMenuPanel, _MatMenuTriggerBase } from "@angular/material/menu";
import { fromEvent, merge } from "rxjs";

// @Directive declaration styled same as matMenuTriggerFor
// with different selector and exportAs.
@Directive({
  selector: `[matContextMenuTriggerFor]`,
  host: {
    'class': 'mat-menu-trigger',
  },
  exportAs: 'matContextMenuTrigger',
})
export class MatContextMenuTrigger extends _MatMenuTriggerBase {

  constructor(
     _overlay: Overlay,
     _element: ElementRef<HTMLElement>,
     _viewContainerRef: ViewContainerRef,
    @Inject(MAT_MENU_SCROLL_STRATEGY) scrollStrategy: any,
    @Inject(MAT_MENU_PANEL) @Optional() parentMenu: MatMenuPanel,
    // `MatMenuTrigger` is commonly used in combination with a `MatMenuItem`.
    // tslint:disable-next-line: lightweight-tokens
    @Optional() @Self()  _menuItemInstance: MatMenuItem,
    @Optional() _dir: Directionality,
     _focusMonitor: FocusMonitor | null,
    _ngZone?: NgZone,
  ) {
    super(_overlay, _element, _viewContainerRef, scrollStrategy, parentMenu, _menuItemInstance, _dir, _focusMonitor, _ngZone);
  }

  // Duplicate the code for the matMenuTriggerFor binding
  // using a new property and the public menu accessors.
  @Input('matContextMenuTriggerFor')
  get menu_again() {
    return this.menu;
  }
  set menu_again(menu: MatMenuPanel) {
    this.menu = menu;
  }

  // Make sure to ignore the original binding
  // to allow separate menus on each button.
  @Input('matMenuTriggerFor')
  set ignoredMenu(value: any) { }

  // Override _handleMousedown, and call super._handleMousedown 
  // with a new MouseEvent having button numbers 2 and 0 reversed.
  _handleMousedown(event: MouseEvent): void {
    return super._handleMousedown(new MouseEvent(event.type, Object.assign({}, event, { button: event.button === 0 ? 2 : event.button === 2 ? 0 : event.button })));
  }

  // Override _handleClick to make existing binding to clicks do nothing.
  _handleClick(event: MouseEvent): void { }

  // Create a place to store the host element.
  private hostElement: EventTarget | null = null;

  // Listen for contextmenu events (right-clicks), then:
  //  1) Store the hostElement for use in later events.
  //  2) Prevent browser default action.
  //  3) Call super._handleClick to open the menu as expected.
  @HostListener('contextmenu', ['$event'])
  _handleContextMenu(event: MouseEvent): void {
    this.hostElement = event.target;
    if (event.shiftKey) return; // Hold a shift key to open original context menu. Delete this line if not desired behavior.
    event.preventDefault();
    event.stopPropagation();
    super._handleClick(event);
    

  }

  // The complex logic below is to handle submenus and hasBackdrop===false well.
  // Listen for click and contextmenu (right-click) events on entire document.
  // If this menu is open, one of the following conditional actions.
  //   1) If the click came from the overlay backdrop, close the menu and prevent default.
  //   2) If the click came inside the overlay container, it was on a menu. If it was
  //      a contextmenu event, prevent default and re-dispatch it as a click.
  //   3) If the event did not come from our host element, close the menu.
  private contextListenerSub = merge(
    fromEvent(document, "contextmenu"),
    fromEvent(document, "click"),
  ).subscribe(event => {
    if (this.menuOpen) {
      if (event.target) {
        const target = event.target as HTMLElement;
        if (target.classList.contains("cdk-overlay-backdrop")) {
          event.preventDefault();
          this.closeMenu();
        } else {
          let inOverlay = false;
          document.querySelectorAll(".cdk-overlay-container").forEach(e => {
            if (e.contains(target))
              inOverlay = true;
          });
          if (inOverlay) {
            if (event.type === "contextmenu") {
              event.preventDefault();
              event.target?.dispatchEvent(new MouseEvent("click", event));
            }
          } else
            if (target !== this.hostElement)
              this.closeMenu();
        }
      }
    }
  });

  // When destroyed, stop listening for the contextmenu events above, 
  // null the host element reference, then call super.
  ngOnDestroy() {
    this.contextListenerSub.unsubscribe();
    this.hostElement = null;
    return super.ngOnDestroy();
  }
}