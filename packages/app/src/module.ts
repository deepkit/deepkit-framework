/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { InjectorModule, ProviderWithScope, Token, NormalizedProvider } from '@deepkit/injector';
import { AbstractClassType, ClassType, CustomError, ExtractClassType, isClass } from '@deepkit/core';
import { EventListener, EventToken } from '@deepkit/event';
import { WorkflowDefinition } from '@deepkit/workflow';
import { getPartialSerializeFunction, reflect, ReflectionFunction, ReflectionMethod, serializer, Type, TypeClass } from '@deepkit/type';
import { ControllerConfig } from './service-container.js';

export type DefaultObject<T> = T extends undefined ? {} : T;

export interface MiddlewareConfig {
    getClassTypes(): ClassType[];
}

export type MiddlewareFactory = () => MiddlewareConfig;

export type ExportType = AbstractClassType | string | AppModule<any> | Type | NormalizedProvider;

/**
 * @reflection never
 */
export interface AddedListener {
    eventToken: EventToken;
    reflection: ReflectionMethod | ReflectionFunction;
    module?: InjectorModule;
    classType?: ClassType;
    methodName?: string;
    order: number;
}

export function stringifyListener(listener: AddedListener): string {
    if (listener.classType) {
        return listener.classType.name + '.' + listener.methodName;
    }
    return listener.reflection.name || 'anonymous function';
}

export interface ModuleDefinition {
    /**
     * Providers.
     */
    providers?: (ProviderWithScope | ProviderWithScope[])[];

    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: ExportType[];

    /**
     * Module bootstrap class|function.
     * This class is instantiated or function executed on bootstrap and can set up various injected services.
     */
    bootstrap?: ClassType | Function;

    /**
     * Configuration definition.
     *
     * @example
     * ```typescript
     *
     * class MyModuleConfig {
     *     debug: boolean = false;
     * });
     *
     * class MyModule extends createModule({
     *     config: MyModuleConfig
     * });
     * ```
     */
    config?: ClassType;

    /**
     * CLI controllers.
     */
    controllers?: ClassType[];

    /**
     * Register created workflows. This allows the Framework Debugger to collect
     * debug information and display the graph of your workflow.
     */
    workflows?: WorkflowDefinition<any>[];

    /**
     * Event listeners.
     *
     * @example with simple functions
     * ```typescript
     * {
     *     listeners: [
     *         onEvent.listen((event: MyEvent) => {console.log('event triggered', event);}),
     *     ]
     * }
     * ```
     *
     * @example with services
     * ```typescript
     *
     * class MyListener {
     *     @eventDispatcher.listen(onEvent)
     *     onEvent(event: typeof onEvent['type']) {
     *         console.log('event triggered', event);
     *     }
     * }
     *
     * {
     *     listeners: [
     *         MyListener,
     *     ]
     * }
     * ```
     */
    listeners?: (EventListener<any> | ClassType)[];

    /**
     * HTTP middlewares.
     */
    middlewares?: MiddlewareFactory[];
}

export interface CreateModuleDefinition extends ModuleDefinition {
    /**
     * Whether all services should be moved to the root module/application.
     */
    forRoot?: true;

    /**
     * Modules can not import other modules in the module definitions.
     * Use instead:
     *
     * ```typescript
     * class MyModule extends createModule({}) {
     *     imports = [new AnotherModule];
     * }
     * ```
     *
     * or
     *
     * ```typescript
     * class MyModule extends createModule({}) {
     *     process() {
     *         this.addModuleImport(new AnotherModule);
     *     }
     * }
     * ```
     *
     * or switch to functional modules
     *
     * ```typescript
     * function myModule(module: AppModule) {
     *     module.addModuleImport(new AnotherModule);
     * }
     * ```
     */
    imports?: undefined;
}

export type FunctionalModule = (module: AppModule<any>) => void;
export type FunctionalModuleFactory = (...args: any[]) => (module: AppModule<any>) => void;

export interface RootModuleDefinition extends ModuleDefinition {
    /**
     * Import another module.
     */
    imports?: (AppModule<any> | FunctionalModule)[];
}

export class ConfigurationInvalidError extends CustomError {
}

let moduleId = 0;

type PartialDeep<T> = T extends string | number | bigint | boolean | null | undefined | symbol | Date
    ? T | undefined
    // Arrays, Sets and Maps and their readonly counterparts have their items made
    // deeply partial, but their own instances are left untouched
    : T extends Array<infer ArrayType>
        ? Array<PartialDeep<ArrayType>>
        : T extends ReadonlyArray<infer ArrayType>
            ? ReadonlyArray<ArrayType>
            : T extends Set<infer SetType>
                ? Set<PartialDeep<SetType>>
                : T extends ReadonlySet<infer SetType>
                    ? ReadonlySet<SetType>
                    : T extends Map<infer KeyType, infer ValueType>
                        ? Map<PartialDeep<KeyType>, PartialDeep<ValueType>>
                        : T extends ReadonlyMap<infer KeyType, infer ValueType>
                            ? ReadonlyMap<PartialDeep<KeyType>, PartialDeep<ValueType>>
                            // ...and finally, all other objects.
                            : {
                                [K in keyof T]?: PartialDeep<T[K]>;
                            };

export interface AppModuleClass<C> {
    new(config?: PartialDeep<C>): AppModule<any, C>;
}

/**
 * Creates a new module class type from which you can extend.
 *
 * name: The lowercase alphanumeric module name. This is used in the configuration system.
 * Choose a short unique name for best usability. If you don't have any configuration
 * or if you want that your configuration options are available without prefix, you can keep this undefined.
 *
 * ```typescript
 * class MyModule extends createModule({}) {}
 *
 * //and used like this
 * new App({
 *     imports: [new MyModule]
 * });
 * ```
 */
export function createModule<T extends CreateModuleDefinition>(options: T, name: string = ''): AppModuleClass<ExtractClassType<T['config']>> {
    return class AnonAppModule extends AppModule<T> {
        constructor(config?: PartialDeep<ExtractClassType<T['config']>>) {
            super(options, name);
            if (config) {
                this.configure(config);
            }
        }
    } as any;
}

export type ListenerType = EventListener<any> | ClassType;

/**
 * The AppModule is the base class for all modules.
 *
 * You  can use `createModule` to create a new module class or extend from `AppModule` manually.
 *
 * @example
 * ```typescript
 *
 * class MyModule extends AppModule {
 *   providers = [MyService];
 *   exports = [MyService];
 *
 *   constructor(config: MyConfig) {
 *      super();
 *      this.setConfigDefinition(MyConfig);
 *      this.configure(config);
 *      this.name = 'myModule';
 *   }
 * }
 *
 */
export class AppModule<T extends RootModuleDefinition = {}, C extends ExtractClassType<T['config']> = any> extends InjectorModule<C, AppModule<any>> {
    public setupConfigs: ((module: AppModule<any>, config: any) => void)[] = [];

    public imports: AppModule<any>[] = [];
    public controllers: ClassType[] = [];
    public commands: { name: string, callback: Function }[] = [];
    public workflows: WorkflowDefinition<any>[] = [];
    public listeners: ListenerType[] = [];
    public middlewares: MiddlewareFactory[] = [];
    public uses: ((...args: any[]) => void)[] = [];

    constructor(
        public options: T = {} as T,
        public name: string = '',
        public setups: ((module: AppModule<any>, config: any) => void)[] = [],
        public id: number = moduleId++,
    ) {
        super();
        if (this.options.imports) for (const m of this.options.imports) this.addModuleImport(m);
        if (this.options.providers) this.providers.push(...this.options.providers.flat());
        if (this.options.exports) this.exports.push(...this.options.exports);
        if (this.options.controllers) this.controllers.push(...this.options.controllers);
        if (this.options.workflows) this.workflows.push(...this.options.workflows);
        if (this.options.listeners) this.listeners.push(...this.options.listeners);
        if (this.options.middlewares) this.middlewares.push(...this.options.middlewares);

        if ('forRoot' in this.options) this.forRoot();

        if (this.options.config) {
            this.setConfigDefinition(this.options.config);
            // this.configDefinition = this.options.config;
            //apply defaults
            // const defaults: any = jsonSerializer.for(this.options.config.schema).deserialize({});
            // //we iterate over so we have the name available on the object, even if its undefined
            // for (const property of this.options.config.schema.getProperties()) {
            //     (this.config as any)[property.name] = defaults[property.name];
            // }
        }
    }

    protected addModuleImport(m: AppModule<any> | FunctionalModule) {
        if (m instanceof AppModule) {
            this.addImport(m);
        } else {
            const module = new AppModule({});
            m(module);
            this.addImport(module);
        }
    }

    /**
     * When all configuration loaders have been loaded, this method is called.
     * It allows to further manipulate the module state depending on the final config.
     */
    process() {

    }

    /**
     * A hook that allows to react on a registered provider in some module.
     */
    processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {

    }

    /**
     * A hook that allows to react on a registered controller in some module.
     */
    processController(module: AppModule<any>, config: ControllerConfig) {

    }

    /**
     * A hook that allows to react on a registered event listeners in some module.
     */
    processListener(module: AppModule<any>, listener: AddedListener) {

    }

    /**
     * After `process` and when all modules have been processed by the service container.
     * This is also after `processController` and `processProvider` have been called and the full
     * final module tree is known. Adding now new providers or modules doesn't have any effect.
     *
     * Last chance to set up the injector context, via this.setupProvider().
     */
    postProcess() {

    }

    /**
     * Renames this module instance.
     */
    rename(name: string): this {
        this.name = name;
        return this;
    }

    getListeners(): ListenerType[] {
        return this.listeners;
    }

    getWorkflows(): WorkflowDefinition<any>[] {
        return this.workflows;
    }

    getMiddlewares(): MiddlewareFactory[] {
        return this.middlewares;
    }

    getControllers(): ClassType[] {
        return this.controllers;
    }

    getCommands(): { name: string, callback: Function }[] {
        return this.commands;
    }

    addCommand(name: string, callback: (...args: []) => any): this {
        this.assertInjectorNotBuilt();
        this.commands.push({ name, callback });
        return this;
    }

    addController(...controller: ClassType[]): this {
        this.assertInjectorNotBuilt();
        this.controllers.push(...controller);
        return this;
    }

    addListener(...listener: (EventListener<any> | ClassType)[]): this {
        this.assertInjectorNotBuilt();

        for (const l of listener) {
            if (!isClass(l)) continue;
            if (this.isProvided(l)) continue;
            this.addProvider(l);
        }
        this.listeners.push(...listener);
        return this;
    }

    addMiddleware(...middlewares: MiddlewareFactory[]): this {
        this.middlewares.push(...middlewares);
        return this;
    }

    /**
     * Allows to change the module config before `setup` and bootstrap is called.
     * This is the last step right before the config is validated.
     */
    setupConfig(callback: (module: AppModule<T>, config: C) => void): this {
        this.setupConfigs.push(callback as any);
        return this;
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the service container is built.
     *
     * This enables you to change the module or its imports depending on the configuration the last time before their services are built.
     *
     * At this point no services can be requested as the service container was not built.
     */
    setup(callback: (module: AppModule<T>, config: C) => void): this {
        this.setups.push(callback);
        return this;
    }

    /**
     * Allows to call services before the application bootstraps.
     *
     * This enables you to configure modules and request their services.
     */
    use(callback: (...args: any[]) => void): this {
        this.uses.push(callback);
        return this;
    }

    getImports(): AppModule<any>[] {
        return super.getImports() as AppModule<any>[];
    }

    getName(): string {
        return this.name;
    }

    /**
     * Sets configured values.
     */
    configure(config: Partial<C>): this {
        for (const module of this.getImports()) {
            if (!module.getName()) continue;
            if (!(module.getName() in config)) continue;
            const newModuleConfig = (config as any)[module.getName()];
            module.configure(newModuleConfig);
        }

        if (this.options.config) {
            const configNormalized = getPartialSerializeFunction(reflect(this.options.config) as TypeClass, serializer.deserializeRegistry)(config);
            Object.assign(this.config, configNormalized);
        }

        return this;
    }
}
