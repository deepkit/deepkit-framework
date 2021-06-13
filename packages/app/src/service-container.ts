/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, ClassType, isClass } from '@deepkit/core';
import { EventDispatcher } from '@deepkit/event';
import { AppModule, ModuleOptions } from './module';
import { ConfiguredProviderRegistry, Context, ContextRegistry, Injector, InjectorContext, ProviderWithScope, TagProvider, tokenLabel } from '@deepkit/injector';
import { cli } from './command';
import { WorkflowDefinition } from '@deepkit/workflow';

export interface OnInit {
    onInit: () => Promise<void>;
}

export interface onDestroy {
    onDestroy: () => Promise<void>;
}


export class CliControllers {
    public readonly controllers = new Map<string, ClassType>();
}

export class WorkflowRegistry {
    constructor(public readonly workflows: WorkflowDefinition<any>[]) {
    }

    public get(name: string): WorkflowDefinition<any> {
        for (const w of this.workflows) {
            if (w.name === name) return w;
        }

        throw new Error(`Workflow with name ${name} does not exist`);
    }

    public add(workflow: WorkflowDefinition<any>) {
        this.workflows.push(workflow);
    }
}

export function isProvided(providers: ProviderWithScope[], token: any): boolean {
    return providers.find(v => !(v instanceof TagProvider) ? token === (isClass(v) ? v : v.provide) : false) !== undefined;
}

export class ServiceContainer<C extends ModuleOptions = ModuleOptions> {
    public readonly cliControllers = new CliControllers;
    public readonly workflowRegistry = new WorkflowRegistry([]);

    protected currentIndexId = 0;

    protected contextManager = new ContextRegistry();
    protected rootInjectorContext = new InjectorContext(this.contextManager, 'module', new ConfiguredProviderRegistry);
    protected eventListenerContainer = new EventDispatcher(this.rootInjectorContext);

    protected rootContext?: Context;
    protected moduleContexts = new Map<AppModule<ModuleOptions>, Context[]>();
    protected moduleIdContexts = new Map<number, Context[]>();

    constructor(
        public appModule: AppModule<any, any>,
        protected providers: ProviderWithScope[] = [],
        protected imports: AppModule<any, any>[] = [],
    ) {
    }

    public process() {
        if (this.rootContext) return;

        this.setupHook(this.appModule);

        this.providers.push({ provide: ServiceContainer, useValue: this });
        this.providers.push({ provide: EventDispatcher, useValue: this.eventListenerContainer });
        this.providers.push({ provide: CliControllers, useValue: this.cliControllers });
        this.providers.push({ provide: InjectorContext, useValue: this.rootInjectorContext });

        this.rootContext = this.processModule(this.appModule, undefined, this.providers, this.imports);
        this.bootstrapModules();
    }

    public getRootInjectorContext() {
        this.process();
        return this.rootInjectorContext;
    }

    private setupHook(module: AppModule<any, any>) {
        const config = module.getConfig();
        for (const setup of module.setups) setup(module, config);

        for (const importModule of module.getImports()) {
            this.setupHook(importModule);
        }
        return module;
    }

    bootstrapModules(): void {
        for (const module of this.moduleContexts.keys()) {
            if (module.options.bootstrap) {
                this.getInjectorFor(module).get(module.options.bootstrap);
            }
        }
    }

    public getContextFor(module: AppModule<any, any>): Context {
        this.process();
        const contexts = this.moduleIdContexts.get(module.id) || [];
        if (!contexts.length) throw new Error('Module not registered.');
        return contexts[0];
    }

    public getInjectorFor(module: AppModule<any, any>): Injector {
        this.process();
        const context = this.getContextFor(module);
        return this.rootInjectorContext.getInjector(context.id);
    }

    public getRootInjector(): Injector {
        this.process();
        if (!this.rootContext) throw new Error('No root context set');
        return this.rootInjectorContext.getInjector(this.rootContext.id);
    }

    protected getContext(id: number): Context {
        const context = this.contextManager.get(id);
        if (!context) throw new Error(`No context for ${id} found`);

        return context;
    }

    protected getNewContext(module: AppModule<any, any>, parent?: Context): Context {
        const newId = this.currentIndexId++;
        const context = new Context(module, newId, parent);
        this.contextManager.set(newId, context);

        let contexts = this.moduleContexts.get(module);
        if (!contexts) {
            contexts = [];
            this.moduleContexts.set(module, contexts);
            this.moduleIdContexts.set(module.id, contexts);
        }

        contexts.push(context);
        return context;
    }

    protected processModule(
        module: AppModule<ModuleOptions>,
        parentContext?: Context,
        additionalProviders: ProviderWithScope[] = [],
        additionalImports: AppModule<any, any>[] = []
    ): Context {
        this.rootInjectorContext.modules[module.getName()] = module;
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

        const forRootContext = module.root;

        if (module.options.workflows) {
            for (const w of module.options.workflows) this.workflowRegistry.add(w);
        }

        //we have to call getNewContext() either way to store this module in this.contexts.
        let context = this.getNewContext(module, parentContext);
        if (forRootContext) {
            context = this.getContext(0);
        }

        for (const provider of providers.slice(0)) {
            if (provider instanceof TagProvider) {
                if (!isProvided(providers, provider)) {
                    providers.unshift(provider.provider);
                }
                this.rootInjectorContext.tagRegistry.tags.push(provider);
            }
        }

        for (const token of exports.slice(0)) {
            // if (isModuleToken(token)) {
            if (token instanceof AppModule) {
                //exported modules will be removed from `imports`, so that
                //the target context (root or parent) imports it
                arrayRemoveItem(exports, token);

                //we remove it from imports as well, so we don't have two module instances
                arrayRemoveItem(imports, token);

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
                providers.unshift({ provide: listener });
                this.eventListenerContainer.registerListener(listener, context);
            } else {
                this.eventListenerContainer.add(listener.eventToken, { fn: listener.callback, order: listener.order });
            }
        }

        for (const [provider, calls] of module.getConfiguredProviderRegistry().calls) {
            this.rootInjectorContext.configuredProviderRegistry.add(provider, ...calls);
        }

        for (const controller of controllers) {
            this.setupController(providers, controller, context);
        }

        //if there are exported tokens, their providers will be added to the parent or root context
        //and removed from module providers.
        const exportedProviders = forRootContext ? this.getContext(0).providers : (parentContext ? parentContext.providers : []);
        for (const token of exports) {
            if (token instanceof AppModule) throw new Error('Should already be handled');

            const provider = providers.findIndex(v => !(v instanceof TagProvider) ? token === (isClass(v) ? v : v.provide) : false);
            if (provider === -1) {
                throw new Error(`Export ${tokenLabel(token)}, but not provided in providers.`);
            }
            exportedProviders.push(providers[provider]);
            providers.splice(provider, 1);
        }

        context.providers.push(...providers);

        return context;
    }

    protected setupController(providers: ProviderWithScope[], controller: ClassType, context: Context) {
        const cliConfig = cli._fetch(controller);
        if (cliConfig) {
            if (!isProvided(providers, controller)) providers.unshift({ provide: controller, scope: 'cli' });
            (controller as any)[InjectorContext.contextSymbol] = context;
            this.cliControllers.controllers.set(cliConfig.name, controller);
        }
    }
}
