import { AfterViewInit, Component, ComponentRef, ElementRef, HostListener, Injector, Input, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ComponentContainer, GoldenLayout, ResolvedComponentItemConfig, LayoutConfig, LogicalZIndex } from 'golden-layout';
import { Logger } from "../utils/logger";
import { GlComponentDirective } from "./gl-component.directive";
import { GoldenLayoutComponentService } from "./golden-layout-component.service";
import BiMap from 'ts-bidirectional-map';

@Component({
    selector: 'golden-layout-host',
    template: `<ng-template #componentViewContainer></ng-template>`,
    styles: [`
        :host {
            /*width:100%;
            height:100%;*/
            padding:0;
            position:relative;
            top:0;
            left:0;
            display:block;
            overflow:hidden;
        }
    `]
})
export class GoldenLayoutHost implements OnDestroy {

    public goldenLayout: GoldenLayout;

    private goldenLayoutBoundingClientRect: DOMRect = new DOMRect();

    private componentRefMap = new BiMap<ComponentContainer, ComponentRef<GlComponentDirective>>();

    private cachedComponents = new BiMap<string,ComponentRef<GlComponentDirective>>();

    @Input() injector: Injector;

    @ViewChild('componentViewContainer', { read: ViewContainerRef, static: true }) private viewRef: ViewContainerRef;


    constructor(
        private elementRef: ElementRef<HTMLElement>,
        private glComponents: GoldenLayoutComponentService,
    ) { 
        this.goldenLayout = new GoldenLayout(
            this.elementRef.nativeElement,
            this.handleBindComponentEvent.bind(this),
            this.handleUnbindComponentEvent.bind(this)
        );
        this.goldenLayout.beforeVirtualRectingEvent = this.handleBeforeVirtualRectingEvent.bind(this);
    }
    ngOnDestroy(): void {
        Logger.logMessage("host ondestroy");
        this.goldenLayout.destroy();
    }

    private handleBindComponentEvent(container: ComponentContainer, itemConfig: ResolvedComponentItemConfig): ComponentContainer.BindableComponent {

        let componentRef = null;
        if(this.cachedComponents.has(itemConfig.id))
            componentRef  = this.cachedComponents.get(itemConfig.id);
        else
            componentRef = this.glComponents.createComponent(itemConfig.componentType, container, this,this.injector);

        if(itemConfig.componentState && typeof itemConfig.componentState === 'object' && !Array.isArray(itemConfig.componentState)) {
            Object.assign(componentRef.instance,itemConfig.componentState)
            componentRef.changeDetectorRef.markForCheck();
        }

        if(this.componentRefMap.hasValue(componentRef)) {
            throw Error('Component already attached');
            
        }
        Logger.logMessage('bind component',itemConfig);
        this.glComponents.getComponentRegistry(itemConfig.componentType).beforeBind(componentRef,container);
        const component = componentRef.instance;
        this.componentRefMap.set(container, componentRef);

        container.virtualRectingRequiredEvent = this.handleContainerVirtualRectingRequiredEvent.bind(this);
        container.virtualVisibilityChangeRequiredEvent = this.handleContainerVisibilityChangeRequiredEvent.bind(this);
        container.virtualZIndexChangeRequiredEvent = this.handleContainerVirtualZIndexChangeRequiredEvent.bind(this);

        this.viewRef.insert(componentRef.hostView);
        if(itemConfig.id && !this.cachedComponents.has(itemConfig.id))
            this.cachedComponents.set(itemConfig.id,componentRef);

        return {
            component,
            virtual: true
        };
    }

    private handleUnbindComponentEvent(container: ComponentContainer) {
        Logger.logMessage('unbind component')
        const componentRef = this.componentRefMap.get(container);
        if(!componentRef) throw Error("Component not found! Cannot unbinbd");
        this.glComponents.getComponentRegistry(container.componentType).beforeUnbind(componentRef, container);
        const viewRefIndex = this.viewRef.indexOf(componentRef.hostView);
        this.viewRef.detach(viewRefIndex);
        this.componentRefMap.delete(container);
        Logger.logMessage(this.cachedComponents);
        if(!this.cachedComponents.hasValue(componentRef)) {
            componentRef.destroy();
            Logger.logMessage('destroying component');
        }
    }

    private handleBeforeVirtualRectingEvent(count: number) {
        this.goldenLayoutBoundingClientRect = this.elementRef.nativeElement.getBoundingClientRect();
    }

    private handleContainerVirtualRectingRequiredEvent(container: ComponentContainer, width: number, height: number) {
        const containerBoundingClientRect = container.element.getBoundingClientRect();
        const left = containerBoundingClientRect.left - this.goldenLayoutBoundingClientRect.left;
        const top = containerBoundingClientRect.top - this.goldenLayoutBoundingClientRect.top;

        const componentRef = this.componentRefMap.get(container);
        if (componentRef === undefined) {
            throw new Error('handleContainerVirtualRectingRequiredEvent: ComponentRef not found');
        }
        const component = componentRef.instance;
        component.setPositionAndSize(left, top, width, height);
    }

    private handleContainerVisibilityChangeRequiredEvent(container: ComponentContainer, visible: boolean) {
        const componentRef = this.componentRefMap.get(container);
        if (componentRef === undefined) {
            throw new Error('handleContainerVisibilityChangeRequiredEvent: ComponentRef not found');
        }
        const component = componentRef.instance;
        component.setVisibility(visible);
    }

    private handleContainerVirtualZIndexChangeRequiredEvent(container: ComponentContainer, logicalZIndex: LogicalZIndex, defaultZIndex: string) {
        const componentRef = this.componentRefMap.get(container);
        if (componentRef === undefined) {
            throw new Error('handleContainerVirtualZIndexChangeRequiredEvent: ComponentRef not found');
        }
        const component = componentRef.instance;
        component.setZIndex(defaultZIndex);
    }

    @HostListener('window:resize')
    private windowResize() {
        this.goldenLayout.updateRootSize();
    }
}