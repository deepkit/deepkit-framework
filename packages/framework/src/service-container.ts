/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {arrayRemoveItem, ClassType, getClassName, isClass, isFunction} from '@deepkit/core';
import {eventClass, EventListenerCallback, EventOfEventToken, EventToken, httpClass, ModuleBootstrap,} from './decorator';
import {Injector, isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, tokenLabel} from './injector/injector';
import {Provider, ProviderProvide, TypeProvider} from './injector/provider';
import {rpcClass} from '@deepkit/framework-shared';
import {cli} from './command';
import {RouterControllers} from './router';
import {Module} from './module';

export interface ProviderScope {
    scope?: 'module' | 'session' | 'request' | 'cli';
}

export interface ProviderSingleScope extends ProviderScope {
    provide: any;
}

export type ProviderWithScope = TypeProvider | (ProviderProvide & ProviderScope) | ProviderSingleScope;


export function isInjectionProvider(obj: any): obj is Provider {
    return isValueProvider(obj) || isClassProvider(obj) || isExistingProvider(obj) || isFactoryProvider(obj);
}

export function isProviderSingleScope(obj: any): obj is ProviderSingleScope {
    return obj.provide !== undefined && !isInjectionProvider(obj);
}


function getProviders(
    providers: ProviderWithScope[],
    requestScope: 'module' | 'session' | 'request' | string,
) {
    const result: Provider[] = [];

    function normalize(provider: ProviderWithScope): Provider {
        if (isClass(provider)) {
            return provider;
        }

        if (isProviderSingleScope(provider)) {
            return {provide: provider.provide, useClass: provider.provide};
        }

        return provider;
    }

    for (const provider of providers) {
        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        const scope = provider.scope || 'module';
        if (scope === requestScope) {
            result.push(normalize(provider));
        }
    }

    return result;
}

export class Context {
    providers: ProviderWithScope[] = [];
    children: Context[] = [];
    parent?: Context;
    injector?: Injector;
    sessionInjector?: Injector;
    requestInjector?: Injector;
    cliInjector?: Injector;

    constructor(public readonly id: number) {
    }

    isRoot(): boolean {
        return this.id === 0;
    }

    getInjector(): Injector {
        if (!this.injector) {
            this.injector = new Injector(getProviders(this.providers, 'module'), this.parent ? [this.parent.getInjector()] : undefined);
        }

        return this.injector;
    }

    getSessionInjector(): Injector {
        if (!this.sessionInjector) {
            this.sessionInjector = new Injector(getProviders(this.providers, 'session'), this.parent ? [this.parent.getSessionInjector()] : undefined);
        }

        return this.sessionInjector;
    }

    getRequestInjector(): Injector {
        if (!this.requestInjector) {
            this.requestInjector = new Injector(getProviders(this.providers, 'request'), this.parent ? [this.parent.getRequestInjector()] : undefined);
        }

        return this.requestInjector;
    }

    getCliInjector(): Injector {
        if (!this.cliInjector) {
            this.cliInjector = new Injector(getProviders(this.providers, 'cli'), this.parent ? [this.parent.getCliInjector()] : undefined);
        }

        return this.cliInjector;
    }
}

export interface OnInit {
    onInit: () => Promise<void>;
}

export interface onDestroy {
    onDestroy: () => Promise<void>;
}

export type SuperHornetController = {
    onDestroy?: () => Promise<void>;
    onInit?: () => Promise<void>;
}

/**
 * Per connection we have a own ControllerContainer
 */
export class RpcControllerContainer {
    constructor(protected controllers: Map<string, ClassType>, protected sessionRootInjector?: Injector) {
    }

    public createController<T>(classType: ClassType<T>): T {
        const context = (classType as any)[ServiceContainer.contextSymbol] as Context;
        if (!context) throw new Error(`Controller ${getClassName(classType)} has no injector context assigned`);

        const contextSessionInjector = context.getSessionInjector().fork(this.sessionRootInjector);
        const injector = new Injector([], [context.getInjector(), contextSessionInjector]);

        return injector.get(classType);
    }

    public resolveController(name: string): ClassType {
        const classType = this.controllers.get(name);
        if (!classType) throw new Error(`Controller not found for ${name}`);

        return classType;
    }
}

export type EventListenerContainerEntryCallback = { priority: number, fn: EventListenerCallback<any> };
export type EventListenerContainerEntryService = { context: Context, priority: number, classType: ClassType, methodName: string };
export type EventListenerContainerEntry = EventListenerContainerEntryCallback | EventListenerContainerEntryService;

function isEventListenerContainerEntryCallback(obj: any): obj is EventListenerContainerEntryCallback {
    return obj && isFunction(obj.fn);
}

function isEventListenerContainerEntryService(obj: any): obj is EventListenerContainerEntryService {
    return obj && isClass(obj.classType);
}

export class EventDispatcher {
    protected listenerMap = new Map<EventToken<any>, EventListenerContainerEntry[]>();
    public rootContext?: Context;
    protected needsSort: boolean = false;

    public registerListener(listener: ClassType, context?: Context) {
        if (!context) {
            if (!this.rootContext) throw new Error('No root context created yet.');
            this.rootContext.getInjector().addProvider(listener);
            context = this.rootContext;
        }
        const config = eventClass._fetch(listener);
        if (!config) return;
        for (const entry of config.listeners) {
            this.add(entry.eventToken, {context, classType: listener, methodName: entry.methodName, priority: entry.priority});
        }
    }

    public add(eventToken: EventToken<any>, listener: EventListenerContainerEntry) {
        this.getListeners(eventToken).push(listener);
        this.needsSort = true;
    }

    protected getListeners(eventToken: EventToken<any>): EventListenerContainerEntry[] {
        let listeners = this.listenerMap.get(eventToken);
        if (!listeners) {
            listeners = [];
            this.listenerMap.set(eventToken, listeners);
        }

        return listeners;
    }

    protected sort() {
        if (!this.needsSort) return;

        for (const listeners of this.listenerMap.values()) {
            listeners.sort((a, b) => {
                if (a.priority > b.priority) return +1;
                if (a.priority < b.priority) return -1;
                return 0;
            });
        }

        this.needsSort = false;
    }

    public dispatch<T extends EventToken<any>>(eventToken: T, event: EventOfEventToken<T>): Promise<void> {
        return this.getCaller(eventToken)(event);
    }

    public getCaller<T extends EventToken<any>>(eventToken: T): (event: EventOfEventToken<T>) => Promise<void> {
        const listeners = this.getListeners(eventToken);

        return async (event) => {
            this.sort();
            for (const listener of listeners) {
                if (isEventListenerContainerEntryCallback(listener)) {
                    await listener.fn(event);
                } else if (isEventListenerContainerEntryService(listener)) {
                    const injector = new Injector([], [listener.context.getInjector(), listener.context.getRequestInjector().fork()]);
                    await injector.get(listener.classType)[listener.methodName](event);
                }
                if (event.isStopped()) {
                    return;
                }
            }
        };
    }
}

export function getClassTypeContext(classType: ClassType): Context {
    const context = (classType as any)[ServiceContainer.contextSymbol] as Context | undefined;
    if (!context) throw new Error(`Class ${getClassName(classType)} is not registered as provider.`);
    return context;
}

export class ServiceContainer {
    public readonly rpcControllers = new Map<string, ClassType>();
    public readonly cliControllers = new Map<string, ClassType>();
    public readonly eventListenerContainer = new EventDispatcher();

    public readonly routerControllers = new RouterControllers([]);

    public static contextSymbol = Symbol('context');

    protected currentIndexId = 0;

    protected contexts = new Map<number, Context>();

    protected rootContext?: Context;
    protected moduleContexts = new Map<Module<any>, Context[]>();

    static getControllerContext(classType: ClassType) {
        const context = (classType as any)[ServiceContainer.contextSymbol] as Context;
        if (!context) throw new Error(`Controller ${getClassName(classType)} has no injector context assigned`);
        return context;
    }

    static assignStandaloneInjector(classTypes: ClassType[]) {
        const injector = new Injector();
        const context = new Context(0);
        context.injector = injector;

        for (const classType of classTypes) {
            if (!(classType as any)[ServiceContainer.contextSymbol]) {
                (classType as any)[ServiceContainer.contextSymbol] = context;
            }
        }
    }

    public processRootModule(
        appModule: Module<any>,
        providers: ProviderWithScope[] = [],
        imports: Module<any>[] = []
    ) {
        providers.push({provide: EventDispatcher, useValue: this.eventListenerContainer});
        providers.push({provide: ServiceContainer, useValue: this});
        providers.push({provide: RouterControllers, useValue: this.routerControllers});

        this.rootContext = this.processModule(appModule, undefined, providers, imports);
        this.eventListenerContainer.rootContext = this.rootContext;
    }

    public getRootContext(): Context {
        if (!this.rootContext) throw new Error(`No root context created yet.`);
        return this.rootContext;
    }

    getRegisteredModules(): ModuleBootstrap[] {
        const result: ModuleBootstrap[] = [];
        for (const [module, contexts] of this.moduleContexts.entries()) {
            for (const context of contexts) {
                if (module.options.bootstrap) {
                    result.push(context.getInjector().get(module.options.bootstrap));
                }
            }
        }
        return result;
    }

    public getContextsForModule(module: Module<any>): Context[] {
        return this.moduleContexts.get(module) || [];
    }

    public getContext(id: number): Context {
        const context = this.contexts.get(id);
        if (!context) throw new Error(`No context for ${id} found`);

        return context;
    }

    protected getNewContext(module: Module<any>, parent?: Context): Context {
        const newId = this.currentIndexId++;
        const context = new Context(newId);
        this.contexts.set(newId, context);

        if (parent) {
            parent.children.push(context);
            context.parent = parent;
        }

        let contexts = this.moduleContexts.get(module);
        if (!contexts) {
            contexts = [];
            this.moduleContexts.set(module, contexts);
        }

        contexts.push(context);
        return context;
    }

    protected processModule(
        module: Module,
        parentContext?: Context,
        additionalProviders: ProviderWithScope[] = [],
        additionalImports: Module<any>[] = []
    ): Context {
        const exports = module.options.exports ? module.options.exports.slice(0) : [];
        const providers = module.options.providers ? module.options.providers.slice(0) : [];
        const controllers = module.options.controllers ? module.options.controllers.slice(0) : [];
        const imports = module.options.imports ? module.options.imports.slice(0) : [];
        const listeners = module.options.listeners ? module.options.listeners.slice(0) : [];

        providers.push(...additionalProviders);
        imports.unshift(...additionalImports);

        //we add the module to its own providers so it can depend on its module providers.
        //when we would add it to root it would have no access to its internal providers.
        if (module.options.bootstrap) providers.push(module.options.bootstrap);

        for (const [name, value] of Object.entries(module.configValues)) {
            const path = module.getName() ? module.getName() + '.' + name : name;
            providers.push({provide: 'config.' + path, useValue: value});
        }

        const forRootContext = module.root;

        //we have to call getNewContext() either way to store this module in this.contexts.
        let context = this.getNewContext(module, parentContext);
        if (forRootContext) {
            context = this.getContext(0);
        }

        for (const token of exports.slice(0)) {
            // if (isModuleToken(token)) {
            if (token instanceof Module) {
                //exported modules will be removed from `imports`, so that
                //the target context (root or parent) imports it
                arrayRemoveItem(exports, token);

                //exported a module. We handle it as if the parent would have imported it.
                this.processModule(token, parentContext);
            }
        }

        for (const imp of imports) {
            if (!imp) continue;
            this.processModule(imp, context);
        }

        for (const listener of listeners) {
            if (isClass(listener)) {
                providers.unshift({provide: listener});
                this.eventListenerContainer.registerListener(listener, context);
            } else {
                this.eventListenerContainer.add(listener.eventToken, {fn: listener.callback, priority: listener.priority});
            }
        }

        for (const controller of controllers) {
            const rpcConfig = rpcClass._fetch(controller);
            if (rpcConfig) {
                providers.unshift({provide: controller, scope: 'session'});
                (controller as any)[ServiceContainer.contextSymbol] = context;
                this.rpcControllers.set(rpcConfig.getPath(), controller);
                continue;
            }

            const httpConfig = httpClass._fetch(controller);
            if (httpConfig) {
                providers.unshift(controller);
                (controller as any)[ServiceContainer.contextSymbol] = context;
                this.routerControllers.add(controller);
                continue;
            }

            const cliConfig = cli._fetch(controller);
            if (cliConfig) {
                providers.unshift({provide: controller, scope: 'cli'});
                (controller as any)[ServiceContainer.contextSymbol] = context;
                this.cliControllers.set(cliConfig.name, controller);
                continue;
            }

            throw new Error(`Controller ${getClassName(controller)} has no @http.controller() or @rpc.controller() decorator`);
        }

        //if there are exported tokens, their providers will be added to the parent or root context
        //and removed from module providers.
        const exportedProviders = forRootContext ? this.getContext(0).providers : (parentContext ? parentContext.providers : []);
        for (const token of exports) {
            if (token instanceof Module) throw new Error('Should already be handled');

            const provider = providers.findIndex(v => token === (isClass(v) ? v : v.provide));
            if (provider === -1) {
                throw new Error(`Export ${tokenLabel(token)}, but not provided in providers.`);
            }
            exportedProviders.push(providers[provider]);
            providers.splice(provider, 1);
        }

        context.providers.push(...providers);

        return context;
    }

}
