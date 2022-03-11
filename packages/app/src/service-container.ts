/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassName, isClass } from '@deepkit/core';
import { EventDispatcher } from '@deepkit/event';
import { AppModule, ConfigurationInvalidError, MiddlewareConfig, ModuleDefinition } from './module';
import { Injector, InjectorContext, InjectorModule, isProvided, ProviderWithScope, resolveToken, Token } from '@deepkit/injector';
import { cli } from './command';
import { WorkflowDefinition } from '@deepkit/workflow';
import { deserialize, ReflectionClass, validate } from '@deepkit/type';

export class CliControllerRegistry {
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

export interface ConfigLoader {
    load(module: AppModule<any>, config: { [name: string]: any }, schema: ReflectionClass<any>): void;
}

export class ServiceContainer {
    public readonly cliControllerRegistry = new CliControllerRegistry;
    public readonly middlewareRegistry = new MiddlewareRegistry;
    public readonly workflowRegistry = new WorkflowRegistry([]);

    protected injectorContext?: InjectorContext;

    //todo: move that to EventModule
    protected eventDispatcher: EventDispatcher;

    protected configLoaders: ConfigLoader[] = [];

    /**
     * All modules in the whole module tree.
     * This is stored to call service container hooks like processController/processProvider.
     */
    protected modules = new Set<AppModule<any>>();

    constructor(
        public appModule: AppModule<any>
    ) {
        this.eventDispatcher = new EventDispatcher(this.injectorContext);
    }

    addConfigLoader(loader: ConfigLoader) {
        this.configLoaders.push(loader);
    }

    public process() {
        if (this.injectorContext) return;

        this.setupHook(this.appModule);
        this.findModules(this.appModule);

        this.appModule.addProvider({ provide: ServiceContainer, useValue: this });
        this.appModule.addProvider({ provide: EventDispatcher, useValue: this.eventDispatcher });
        this.appModule.addProvider({ provide: CliControllerRegistry, useValue: this.cliControllerRegistry });
        this.appModule.addProvider({ provide: MiddlewareRegistry, useValue: this.middlewareRegistry });
        this.appModule.addProvider({ provide: InjectorContext, useFactory: () => this.injectorContext! });

        this.processModule(this.appModule);

        this.postProcess();

        this.injectorContext = new InjectorContext(this.appModule);
        this.injectorContext.getRootInjector(); //trigger all injector builds
        this.bootstrapModules();
    }

    protected postProcess() {
        for (const m of this.modules) {
            m.postProcess();
        }
    }

    protected findModules(module: AppModule<any>) {
        if (this.modules.has(module)) return;
        this.modules.add(module);

        for (const m of module.getImports()) {
            this.findModules(m);
        }
    }

    public getInjectorContext(): InjectorContext {
        this.process();
        return this.injectorContext!;
    }

    private setupHook(module: AppModule<any>) {
        let config = module.getConfig();

        if (module.configDefinition) {
            const schema = ReflectionClass.from(module.configDefinition);
            for (const loader of this.configLoaders) {
                loader.load(module, config, schema);
            }

            //config loads can set arbitrary values (like string for numbers), so we try deserialize them automatically
            Object.assign(config, deserialize(config, undefined, undefined, schema.type));

            for (const setupConfig of module.setupConfigs) setupConfig(module, config);

            //at this point, no deserialization needs to happen anymore, so validation happens on the config object itself.
            const errors = validate(config, schema.type);
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

    protected bootstrapModules(): void {
        for (const m of this.modules) {
            if (m.options.bootstrap) {
                this.getInjector(m).get(m.options.bootstrap);
            }
        }
    }

    public getInjector<T extends AppModule<any>>(moduleOrClass: ClassType<T> | T): Injector {
        this.process();
        if (!isClass(moduleOrClass)) return this.getInjectorContext().getInjector(moduleOrClass);

        for (const m of this.modules) {
            if (m instanceof moduleOrClass) {
                return this.getInjectorContext().getInjector(m);
            }
        }
        throw new Error(`No module loaded from type ${getClassName(moduleOrClass)}`);
    }

    public getModule(moduleClass: ClassType<AppModule<any>>): AppModule<any> {
        this.process();
        for (const m of this.modules) {
            if (m instanceof moduleClass) {
                return m;
            }
        }
        throw new Error(`No module loaded from type ${getClassName(moduleClass)}`);
    }

    /**
     * Returns all known instantiated modules.
     */
    getModules(): AppModule<any>[] {
        this.process();
        return [...this.modules];
    }

    public getRootInjector(): Injector {
        this.process();
        return this.getInjectorContext().getInjector(this.appModule);
    }

    protected processModule(
        module: AppModule<ModuleDefinition>
    ): void {
        if (module.injector) throw new Error(`Module ${getClassName(module)}.${module.name} was already imported. Can not re-use module instances.`);

        const providers = module.getProviders();
        const controllers = module.getControllers();
        const listeners = module.getListeners();
        const middlewares = module.getMiddlewares();

        if (module.options.bootstrap && !module.isProvided(module.options.bootstrap)) {
            providers.push(module.options.bootstrap);
        }

        for (const w of module.getWorkflows()) this.workflowRegistry.add(w);

        for (const middleware of middlewares) {
            const config = middleware();

            for (const fnOrClassTye of config.getClassTypes()) {
                if (!isClass(fnOrClassTye)) continue;
                if (!isProvided(providers, fnOrClassTye)) {
                    providers.unshift(fnOrClassTye);
                }
            }
            this.middlewareRegistry.configs.push({ config, module });
        }

        for (const listener of listeners) {
            if (isClass(listener)) {
                providers.unshift({ provide: listener });
                this.eventDispatcher.registerListener(listener, module);
            } else {
                this.eventDispatcher.add(listener.eventToken, { fn: listener.callback, order: listener.order, module: listener.module });
            }
        }

        for (const controller of controllers) {
            this.processController(module, controller);
        }

        for (const provider of providers) {
            this.processProvider(module, resolveToken(provider), provider);
        }

        for (const imp of module.getImports()) {
            if (!imp) continue;
            this.processModule(imp);
        }
    }

    protected processController(module: AppModule<any>, controller: ClassType) {
        const cliConfig = cli._fetch(controller);
        if (cliConfig) {
            if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'cli' });
            this.cliControllerRegistry.controllers.set(cliConfig.name, { controller, module });
        }

        for (const m of this.modules) {
            m.processController(module, controller);
        }
    }

    protected processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
        for (const m of this.modules) {
            m.processProvider(module, token, provider);
        }
    }
}
