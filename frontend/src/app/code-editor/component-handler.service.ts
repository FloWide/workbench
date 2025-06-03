import { GoldenLayout, RowOrColumn, EventEmitter, ComponentContainer, ComponentItem, Stack, ItemType, JsonValue, Tab, ContentItem } from "golden-layout";
import { GlComponentDirective, GlTabContext, GoldenLayoutComponentService } from "../golden-layout";
import { ComponentRef, EmbeddedViewRef, Type } from "@angular/core";
import { Logger } from "../utils/logger";
import { BehaviorSubject, Subject } from "rxjs";



export class ComponentWithContainer<Component extends GlComponentDirective> {
    constructor(
        public component: Component,
        public container: ComponentContainer
    ) {}
}

export class ComponentTab {
    constructor(
        public tab: Tab,
        public embedRef: EmbeddedViewRef<GlTabContext>
    ) {}
}

export abstract class ComponentHandlerService<Component extends GlComponentDirective, ComponentState extends object = {}> {

    protected gl: GoldenLayout;

    protected defaultTarget: RowOrColumn = null;

    protected stackTarget: Stack = null;

    protected activeComponents: Map<any, ComponentWithContainer<Component>> = new Map();

    protected inactiveComponents: Map<any, ComponentWithContainer<Component>> = new Map();

    protected componentRefs: Map<any, ComponentRef<Component>> = new Map();

    protected tabRefs: Map<any, ComponentTab> = new Map();

    constructor(
        glComponents: GoldenLayoutComponentService,
        protected componentType: Type<Component>,
        protected componentName: string
    ) {
        glComponents.registerComponent(this.componentName, this.componentType,{
            beforeBind:this.onAngularComponentCreated.bind(this),
            beforeUnbind:this.onAngularComponentRemoved.bind(this)
        })
    }


    ready(
        gl: GoldenLayout,
        defaultTarget: RowOrColumn
    ) {
        this.gl = gl;
        this.defaultTarget = defaultTarget
        this.gl.on('itemCreated', this.onItemCreated.bind(this))
        this.gl.on('itemDestroyed', this.onItemDestroyed.bind(this))
        this.gl.on('tabCreated', this.onTabCreated.bind(this));
    }


    createComponent(title: string, state: ComponentState) {
        const id = this.getId(state);
        if (this.activeComponents.has(id)) {
            Logger.logWarning("No duplicates please");
            return;
        }
        if (this.inactiveComponents.size > 0) {
            const [id, free]: [any, ComponentWithContainer<Component>] = this.inactiveComponents.entries().next().value;
            this.inactiveComponents.delete(id)
            const componentTab = this.tabRefs.get(id);
            free.container.replaceComponent({
                type:ItemType.component,
                componentType:this.componentName,
                componentState:state,
                title:title,
                header:{
                    popout:false
                }
            });
            if (componentTab) {
                componentTab.embedRef.destroy();
                this.tabRefs.delete(id);
            }
            free.component = free.container.component as Component
            if (componentTab) {
                const template = free.component.getTabTemplate();
                const embedRef = template.createEmbeddedView({container:free.container,title:free.container.title})
                embedRef.detectChanges();
                componentTab.tab.element.replaceChildren(...embedRef.rootNodes);
                free.component.setTabEmbedRef(embedRef);
                patchTab(componentTab.tab, embedRef.rootNodes);
                this.tabRefs.set(this.getId(free.component), new ComponentTab(componentTab.tab, embedRef));
            }
            free.container.focus();
            this.activeComponents.set(this.getId(free.component),free)
        } else {
            const target = this.stackTarget ? this.stackTarget : this.defaultTarget
            target.addItem({
                type:ItemType.component,
                componentType:this.componentName,
                componentState:state,
                title:title,
                header:{
                    popout:false
                }
            })
        }
    }

    closeComponent(id: any) {
        if (this.activeComponents.has(id)) {
            this.activeComponents.get(id).container.close();
        } else if (this.inactiveComponents.has(id)) {
            this.inactiveComponents.get(id).container.close();
        }
    }

    setState(id: any, state: Partial<ComponentState>) {
        if (!this.componentRefs.has(id)) return;
        
        const compRef = this.componentRefs.get(id);
        Object.assign(compRef.instance, state)
        compRef.changeDetectorRef.detectChanges();
    }

    getComponent(id: any): [ComponentWithContainer<Component>, boolean] {
        if (this.activeComponents.has(id)) {
            return [this.activeComponents.get(id), true]
        } else if (this.inactiveComponents.has(id)) {
            return [this.inactiveComponents.get(id), false]
        } else {
            return [null, null]
        }
    }

    setInactive(component: Component) {
        this.deactivateComponent(this.getId(component));
    }

    protected deactivateComponent(id: any) {
        const component = this.activeComponents.get(id)
        if (!component) return;
        this.inactiveComponents.set(id, component)
        this.activeComponents.delete(id)
    }

    protected onItemCreated(args: EventEmitter.BubblingEvent) {
        const container = this.getComponentContainer(args)
        if (!container) return null
        if (!this.stackTarget) {
            this.stackTarget = container.parent.parent as Stack;
        }
        const component = container.component as Component
        const id = this.getId(component)
        const withContainer = new ComponentWithContainer(component, container)
        this.activeComponents.set(this.getId(component), withContainer)
        return withContainer
    }

    protected onItemDestroyed(args: EventEmitter.BubblingEvent) {
        this.checkStackDestroyed(args);
        const container = this.getComponentContainer(args)
        if (!container) return
        const component = container.component as Component
        const id = this.getId(component)
        let rv: ComponentWithContainer<Component> = null;
        if (this.activeComponents.has(id)) {
            rv = this.activeComponents.get(id);
            this.activeComponents.delete(id)
        } else if (this.inactiveComponents.has(id)) {
            rv = this.inactiveComponents.get(id)
            this.inactiveComponents.delete(id);
        }
        const componentTab = this.tabRefs.get(id);
        if (componentTab) {
            componentTab.embedRef.destroy();
        }
        return rv;
    }

    protected onTabCreated(tab: Tab) {
        if (tab.componentItem.type !== ItemType.component) return;
        if (tab.componentItem.componentType !== this.componentName) return;
        const component = tab.componentItem.component as Component;
        const container = tab.componentItem.container;
        const templateRef = component.getTabTemplate();
        if (!templateRef) return;
        const id = this.getId(component);
        const embedViewRef = templateRef.createEmbeddedView({container:container, title:tab.componentItem.title});
        embedViewRef.detectChanges();
        const originalChildren = Array.from(tab.element.childNodes);
        tab.element.replaceChildren(...embedViewRef.rootNodes);
        component.setTabEmbedRef(embedViewRef);
        patchTab(tab, embedViewRef.rootNodes);
        this.tabRefs.set(id, new ComponentTab(tab, embedViewRef));
    }

    protected onAngularComponentCreated(componentRef: ComponentRef<Component>, container: ComponentContainer) {
        this.componentRefs.set(
            this.getId(componentRef.instance),
            componentRef
        )
    }

    protected onAngularComponentRemoved(componentRef: ComponentRef<Component>, container: ComponentContainer) {
        this.componentRefs.delete(
            this.getId(componentRef.instance)
        )
    }

    protected abstract getId(component: Component | ComponentState): any;

    protected getComponentContainer(args: EventEmitter.BubblingEvent): ComponentContainer | null {
        if ( !(args.target instanceof ComponentItem))
            return null
        if ( args.target.componentType !== this.componentName)
            return null
        return args.target.container
    }

    private checkStackDestroyed(args: EventEmitter.BubblingEvent) {
        if (args.target instanceof Stack) {
            if (args.target === this.stackTarget) {
                this.stackTarget = null;
            }
        }
    }
}


export abstract class ToggleableComponentHandlerService<Component extends GlComponentDirective, ComponentState extends object = {}> extends ComponentHandlerService<Component, ComponentState> {

    isOpen$ = new BehaviorSubject<boolean>(false);

    createComponent(title: string, state: ComponentState): void {
        this.isOpen$.next(true)
        return super.createComponent(title, state)
    }

    closeComponent(id: any): void {
        this.isOpen$.next(false);
        return super.closeComponent(this.getId(null));
    }

    toggle(title: string, state: ComponentState) {
        if (this.isOpen$.value) {
            this.closeComponent(this.getId(null))
        } else {
            this.createComponent(title, state);
        }
        return this.isOpen$.value
    }

    protected onItemCreated(args: EventEmitter.BubblingEvent): ComponentWithContainer<Component> {
        const ret = super.onItemCreated(args);
        if (this.activeComponents.size > 0) {
            this.isOpen$.next(true);
        }
        return ret;
    }

    protected onItemDestroyed(args: EventEmitter.BubblingEvent): ComponentWithContainer<Component> {
        const ret = super.onItemDestroyed(args);
        if (this.activeComponents.size === 0) {
            this.isOpen$.next(false);
        }
        return ret;
    }
}

// CHEATING
// Replacing the tab's draglistener with an other one that includes the extra nodes that were created
// This allows custom tabs to be dragged as the original tabs
function patchTab(tab: Tab, extraNodes: Node[]) {
    if (!tab.reorderEnabled) return tab;
    const anyTab: any = tab;
    const dragListenerCtor = anyTab._dragListener.constructor;
    anyTab._dragListener.off('dragStart', anyTab._dragStartListener);
    anyTab._dragListener = new dragListenerCtor(anyTab._element,extraNodes);
    anyTab._dragListener.on('dragStart', anyTab._dragStartListener);
}


export function findNeighbors(container: ComponentContainer) : {left?: ComponentItem, right?: ComponentItem, top?: ComponentItem, bottom?: ComponentItem} {
    
    function recursiveFindNeighbors(node: ContentItem, targetType: ItemType): [ComponentItem, ComponentItem] | null {
        if (!node || !node.parent) return [null, null];
        if (node.parent.type === targetType) {
            const index = node.parent.contentItems.findIndex((v) => v === node)
            const prevIndex = nullClamp(index - 1, 0, node.parent.contentItems.length)
            const nextIndex = nullClamp(index + 1, 0, node.parent.contentItems.length)
            const prev = drillToComponent(node.parent.contentItems[prevIndex]) || recursiveFindNeighbors(node.parent, targetType)[0]
            const next = drillToComponent(node.parent.contentItems[nextIndex]) || recursiveFindNeighbors(node.parent, targetType)[1]
            return [prev, next]

        }
        else if (node.parent) return recursiveFindNeighbors(node.parent, targetType)
        else return [null, null]
    }

    function drillToComponent(node: ContentItem): ComponentItem | null {
        if (!node) return null

        if (node.type === ItemType.component) {
            if ((node as ComponentItem).container.visible)
                return node as ComponentItem
            else 
                return null
        }
            
        for(const item of node.contentItems) {
            const ret = drillToComponent(item)
            if (ret) return ret
        }

        return null
    }

    function nullClamp(number: number, min: number, max: number) {
        if (number < min || number > max) return null
        else return number
    }
    
    const rowNeighbors = recursiveFindNeighbors(container.parent,'row')
    const [left,right] = rowNeighbors
    
    const columnNeighbors = recursiveFindNeighbors(container.parent, 'column')
    const [top, bottom] = columnNeighbors

    return {
        left,
        top,
        right,
        bottom
    }
}