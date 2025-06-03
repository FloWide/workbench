import { ComponentFactoryResolver, ComponentRef, Injectable, InjectionToken, Injector, Type } from '@angular/core';
import { ComponentContainer, Json, JsonValue } from 'golden-layout';
import { GlComponentDirective } from './gl-component.directive';
import type { GoldenLayoutHost } from './golden-layout-host.component';

export const ComponentContainerInjectionToken = new InjectionToken<ComponentContainer>('ComponentContainerInjectionToken');
export const GlHostComponent = new InjectionToken<GoldenLayoutHost>('GoldenLayoutHostComponentInjectionToken');

type GlComponentHook<T extends GlComponentDirective> = (component: ComponentRef<T>, container: ComponentContainer) => void;



interface GlComponentHooks<T extends GlComponentDirective> {
  afterCreation: GlComponentHook<T>;

  beforeBind: GlComponentHook<T>;

  beforeUnbind: GlComponentHook<T>;
}

class ComponentRegistry<T extends GlComponentDirective = GlComponentDirective> implements GlComponentHooks<T> {

  constructor(
    public component: Type<T>
  ) { }
  afterCreation: GlComponentHook<T> = (...args) => { };
  beforeBind: GlComponentHook<T> = (...args) => { };
  beforeUnbind: GlComponentHook<T> = (...args) => { };
}

@Injectable()
export class GoldenLayoutComponentService {

  private componentRegistry: Map<JsonValue, ComponentRegistry> = new Map();

  constructor(private factoryResolve: ComponentFactoryResolver) { }

  registerComponent<T extends GlComponentDirective>(name: JsonValue, comp: Type<T>, hooks?: Partial<GlComponentHooks<T>>) {
    const registeredComponent = new ComponentRegistry(comp);
    Object.assign(registeredComponent, hooks || {});
    this.componentRegistry.set(name, registeredComponent);
  }

  createComponent(name: JsonValue, container: ComponentContainer, host: GoldenLayoutHost, parentInjector?: Injector) {
    const registry = this.componentRegistry.get(name);
    if (!registry) throw Error("Component not found");
    const injector = Injector.create({
      parent: parentInjector,
      providers: [
        {
          provide: ComponentContainerInjectionToken,
          useValue: container
        },
        {
          provide:GlHostComponent,
          useValue:host
        }
      ]
    });
    const factory = this.factoryResolve.resolveComponentFactory(registry.component);
    const compRef = factory.create(injector);
    registry.afterCreation(compRef, container);
    return compRef;
  }

  getComponentRegistry(name: JsonValue) {
    const registry = this.componentRegistry.get(name);
    if (!registry)
      throw Error("Component not found");

    return registry;
  }
}
