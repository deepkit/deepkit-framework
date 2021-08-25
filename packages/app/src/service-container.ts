/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, ClassType, getClassName, isClass, isPrototypeOfBase } from '@deepkit/core';
import { EventDispatcher } from '@deepkit/event';
import { AppModule, ConfigurationInvalidError, MiddlewareConfig, ModuleOptions } from './module';
import { ConfiguredProviderRegistry, Context, ContextRegistry, Injector, InjectorContext, InjectorModule, ProviderWithScope, TagProvider, tokenLabel } from '@deepkit/injector';
import { cli } from './command';
import { WorkflowDefinition } from '@deepkit/workflow';
import { ClassSchema, jsonSerializer, validate } from '@deepkit/type';

export interface OnInit {
    onInit: () => Promise<void>;
}

export interface onDestroy {
    onDestroy: () => Promise<void>;
}


export class CliControllers {
    public readonly controllers = new Map<string, { controller: ClassType, module: InjectorModule }>();
}

export type MiddlewareRegistryEntry = { config: MiddlewareConfig, module: AppModule<any> };

export class MiddlewareRegistry {
    public readonly configs: MiddlewareRegistryEntry[] = [];
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

export interface ConfigLoader {
    load(module: AppModule<any, any>, config: { [name: string]: any }, schema: ClassSchema): void;
}

export class ServiceContainer<C extends ModuleOptions = ModuleOptions> {
    public readonly cliControllers = new CliControllers;
    public readonly middlewares = new MiddlewareRegistry;
    public readonly workflowRegistry = new WorkflowRegistry([]);

    protected currentIndexId = 0;

    protected contextManager = new ContextRegistry();
    protected injectorContext = new InjectorContext(this.contextManager, 'module', new ConfiguredProviderRegistry);
    protected eventListenerContainer = new EventDispatcher(this.injectorContext);

    protected rootContext?: Context;
    protected moduleContexts = new Map<AppModule<ModuleOptions>, Context[]>();

    protected configLoaders: ConfigLoader[] = [];

    public appModule: AppModule<any, any>;

    /**
     * All modules in the whole module tree.
     * This is stored to call service container hooks like handleControllers/handleProviders.
     */
    protected modules = new Set<AppModule<any, any>>();

    constructor(
        appModule: AppModule<any, any>,
        protected providers: ProviderWithScope[] = [],
    ) {
        this.appModule = appModule;
    }

    addConfigLoader(loader: ConfigLoader) {
        this.configLoaders.push(loader);
    }

    public process() {
        if (this.rootContext) return;

        this.setupHook(this.appModule);
        this.findModules(this.appModule);

        this.providers.push({ provide: ServiceContainer, useValue: this });
        this.providers.push({ provide: EventDispatcher, useValue: this.eventListenerContainer });
        this.providers.push({ provide: CliControllers, useValue: this.cliControllers });
        this.providers.push({ provide: MiddlewareRegistry, useValue: this.middlewares });
        this.providers.push({ provide: InjectorContext, useValue: this.injectorContext });

        this.rootContext = this.processModule(this.appModule, undefined, this.providers);

        this.postProcess();
        this.bootstrapModules();
    }

    protected postProcess() {
        for (const m of this.modules) {
            m.postProcess();
            for (const [provider, calls] of m.getConfiguredProviderRegistry().calls) {
                this.injectorContext.configuredProviderRegistry.add(provider, ...calls);
            }
        }
    }

    protected findModules(module: AppModule<any, any>) {
        if (this.modules.has(module)) return;
        this.modules.add(module);

        for (const m of module.getImports()) {
            this.findModules(m);
        }
    }

    public getInjectorContext() {
        this.process();
        return this.injectorContext;
    }

    private setupHook(module: AppModule<any, any>) {
        let config = module.getConfig();

        if (module.options.config) {
            const configSerializer = jsonSerializer.for(module.options.config.schema);

            for (const loader of this.configLoaders) {
                loader.load(module, config, module.options.config.schema);
            }

            //config loads can set arbitrary values (like string for numbers), so we try deserialize them automatically
            Object.assign(config, configSerializer.deserialize(config));

            for (const setupConfig of module.setupConfigs) setupConfig(module, config);

            //at this point, no deserialization needs to happen anymore, so validation happens on the config object itself.
            const errors = validate(module.options.config.schema, config);
            if (errors.length) {
                const errorsMessage = errors.map(v => v.toString(module.getName())).join(', ');
                throw new ConfigurationInvalidError(`Configuration for module ${module.getName() || 'root'} is invalid. Make sure the module is correctly configured. Error: ` + errorsMessage);
            }
        }

        module.process();

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

    public getInjectorFor(module: AppModule<any, any>): Injector {
        this.process();
        return this.injectorContext.getInjectorForModule(module);
    }

    public getModuleForModuleClass<T extends AppModule<any, any>>(moduleClass: ClassType<T>): T {
        return this.getInjectorContext().getModuleForModuleClass(moduleClass) as T;
    }

    public getModuleForModule<T extends AppModule<any, any>>(module: T): T {
        return this.getInjectorContext().getModuleForModule(module) as T;
    }

    public getInjectorForModuleClass(moduleClass: ClassType<AppModule<any, any>>): Injector {
        return this.getInjectorContext().getInjectorForModuleClass(moduleClass);
    }

    public getInjectorForModule(module: AppModule<any, any>): Injector {
        return this.getInjectorContext().getInjectorForModule(module);
    }

    public getRootInjector(): Injector {
        this.process();
        if (!this.rootContext) throw new Error('No root context set');
        return this.injectorContext.getInjector(this.rootContext.id);
    }

    protected getContext(id: number): Context {
        const context = this.contextManager.get(id);
        if (!context) throw new Error(`No context for ${id} found`);

        return context;
    }

    public getModulesForName(name: string): AppModule<any, any>[] {
        return [...this.moduleContexts.keys()].filter(v => v.name === name);
    }

    protected getNewContext(module: AppModule<any, any>, parent?: Context): Context {
        if (this.contextManager.contextLookup[module.id] !== undefined) {
            throw new Error(`Module ${getClassName(module)} already imported. You can not import the same module instance twice.`);
        }

        const newId = this.currentIndexId++;
        const context = new Context(module, newId, parent);
        module.setContextId(newId);
        this.contextManager.contextLookup[module.id] = newId;
        this.contextManager.add(context);

        let contexts = this.moduleContexts.get(module);
        if (!contexts) {
            contexts = [];
            this.moduleContexts.set(module, contexts);
        }

        contexts.push(context);
        return context;
    }

    protected processModule(
        module: AppModule<ModuleOptions>,
        parentContext?: Context,
        additionalProviders: ProviderWithScope[] = [],
    ): Context {
        if (module.hasContextId()) throw new Error(`Module ${getClassName(module)}.${module.name} was already imported. Can not re-use module instances.`);

        const exports = module.getExports();
        const providers = module.getProviders();
        const controllers = module.options.controllers ? module.options.controllers.slice(0) : [];
        let imports = module.getImports();
        const listeners = module.options.listeners ? module.options.listeners.slice(0) : [];
        const middlewares = module.options.middlewares ? module.options.middlewares.slice(0) : [];

        providers.push(...additionalProviders);

        //we add the module to its own providers so it can depend on its module providers.
        //when we would add it to root it would have no access to its internal providers.
        if (module.options.bootstrap) providers.push(module.options.bootstrap);

        const forRootContext = module.root;

        if (module.options.workflows) {
            for (const w of module.options.workflows) this.workflowRegistry.add(w);
        }

        //we have to call getNewContext() either way to store this module in this.contexts.
        let context = this.getNewContext(module, parentContext);
        const actualContext = context;
        if (forRootContext) {
            context = this.getContext(0);
        }

        for (const provider of providers.slice(0)) {
            if (provider instanceof TagProvider) {
                if (!isProvided(providers, provider)) {
                    providers.unshift(provider.provider);
                }
                this.injectorContext.tagRegistry.tags.push(provider);
            }
        }

        for (const middleware of middlewares) {
            const config = middleware();

            for (const fnOrClassTye of config.getClassTypes()) {
                if (!isClass(fnOrClassTye)) continue;
                if (!isProvided(providers, fnOrClassTye)) {
                    providers.unshift(fnOrClassTye);
                }
            }
            this.middlewares.configs.push({ config, module });
        }

        for (let token of exports.slice(0)) {
            if (isClass(token) && isPrototypeOfBase(token, AppModule)) {
                //exports: [ModuleClassType], so we need to find the correct import
                for (const moduleImport of imports) {
                    if (moduleImport instanceof token) {
                        //we remove the export ClassType here, because we overwrite `token` in next line
                        arrayRemoveItem(exports, token);
                        token = moduleImport;
                        break;
                    }
                }
            }

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
                //listeners needs to be exported, otherwise the EventDispatcher can't instantiate them, since
                //we do not store the injector context yet.
                exports.unshift(listener);
                this.eventListenerContainer.registerListener(listener, module);
            } else {
                this.eventListenerContainer.add(listener.eventToken, { fn: listener.callback, order: listener.order });
            }
        }

        for (const controller of controllers) {
            this.handleController(module, controller);
        }

        //if there are exported tokens, their providers will be added to the parent or root context
        //and removed from module providers.
        const exportToContext = forRootContext ? this.getContext(0) : parentContext;
        if (exportToContext) {
            if (exportToContext !== actualContext) {
                exportToContext.exportedContexts.push(actualContext);
            }

            for (const token of exports) {
                if (token instanceof AppModule) throw new Error(`${getClassName(token)} should already be handled`);
                if (isClass(token) && isPrototypeOfBase(token, AppModule)) throw new Error(`${getClassName(token)} should already be handled`);

                const provider = providers.findIndex(v => {
                    if (v instanceof TagProvider) return false;
                    const providerToken = isClass(v) ? v : v.provide;
                    return token === providerToken;
                });
                if (provider === -1) {
                    throw new Error(`Export ${tokenLabel(token)}, but not provided in providers.`);
                }
                exportToContext.providers.push(providers[provider]);
                providers.splice(provider, 1);
            }
        }

        this.handleProviders(module, providers);
        context.providers.push(...providers);

        return context;
    }

    protected handleProviders(module: AppModule<any, any>, providers: ProviderWithScope[]) {
        for (const m of this.modules) {
            m.handleProviders(module, providers);
        }
    }

    protected handleController(module: AppModule<any>, controller: ClassType) {
        const cliConfig = cli._fetch(controller);
        if (cliConfig) {
            if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'cli' });
            this.cliControllers.controllers.set(cliConfig.name, { controller, module });
        }

        for (const m of this.modules) {
            m.handleController(module, controller);
        }
    }
}
