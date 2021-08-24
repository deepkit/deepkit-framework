/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ExtractClassDefinition, JSONPartial, jsonSerializer, PlainSchemaProps, t } from '@deepkit/type';
import { ConfigDefinition, InjectorModule, InjectToken, ProviderWithScope } from '@deepkit/injector';
import { ClassType, CustomError } from '@deepkit/core';
import { EventListener } from '@deepkit/event';
import type { WorkflowDefinition } from '@deepkit/workflow';

export type DefaultObject<T> = T extends undefined ? {} : T;
export type ExtractAppModuleName<T extends AppModule<any, any>> = T extends AppModule<any, infer NAME> ? NAME : never;
export type ExtractImportConfigs<T extends Array<AppModule<any, any>> | undefined> = T extends Array<any> ? { [M in T[number] as (ExtractAppModuleName<M> & string)]?: ExtractPartialConfigOfDefinition<DefaultObject<ExtractModuleOptions<M>['config']>> } : {};
export type ExtractConfigOfDefinition<T> = T extends ConfigDefinition<infer C> ? C : {};
export type ExtractPartialConfigOfDefinition<T> = T extends ConfigDefinition<infer C> ? JSONPartial<C> : {};
export type ExtractModuleOptions<T extends AppModule<any, any>> = T extends AppModule<infer O, any> ? O : never;
export type ModuleConfigOfOptions<O extends ModuleOptions> = ExtractImportConfigs<O['imports']> & ExtractPartialConfigOfDefinition<DefaultObject<O['config']>>;

export interface MiddlewareConfig {
    getClassTypes(): ClassType[];
}

export type MiddlewareFactory = () => MiddlewareConfig;

export interface ModuleOptions {
    /**
     * Providers.
     */
    providers?: ProviderWithScope[];

    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: (ClassType | InjectToken | string | AppModule<any, any>)[];

    /**
     * Module bootstrap class. This class is instantiated on bootstrap and can
     * setup various injected services. A more flexible alternative is to use .setup() with compiler passes.
     */
    bootstrap?: ClassType;

    /**
     * Configuration definition.
     *
     * @example
     * ```typescript
     * import {t} from '@deepkit/type';
     *
     * const myModuleConfig = new AppModuleConfig({
     *     debug: t.boolean.default(false),
     * });
     *
     * const myModule = new AppModule({
     *     config: myModuleConfig
     * });
     * ```
     */
    config?: ConfigDefinition<any>;

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

    /**
     * Import another module.
     */
    imports?: AppModule<any, any>[];
}

function cloneOptions<T extends ModuleOptions>(options: T): T {
    const copied = { ...options };
    copied.imports = copied.imports?.slice(0);
    copied.exports = copied.exports?.slice(0);
    copied.providers = copied.providers?.slice(0);
    copied.controllers = copied.controllers?.slice(0);
    copied.listeners = copied.listeners?.slice(0);
    copied.workflows = copied.workflows?.slice(0);
    return copied;
}

export class ConfigurationInvalidError extends CustomError {
}

let moduleId = 0;

export class AppModuleConfig<T extends PlainSchemaProps> extends ConfigDefinition<ExtractClassDefinition<T>> {
    constructor(public config: T) {
        super(t.schema(config));
    }
}

export function createModuleConfig<T extends PlainSchemaProps>(config: T): AppModuleConfig<T> {
    return new AppModuleConfig(config);
}

export interface AppModuleClass<T extends ModuleOptions, NAME extends string = ''> {
    new(config?: ModuleConfigOfOptions<T>): AppModule<T, NAME>;
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
 * class MyModule2 extends createModule({}, 'module2') {}
 *
 * //and used like this
 * new CommandApplication({
 *     imports: [new MyModule]
 * });
 *
 * ```
 */
export function createModule<T extends ModuleOptions, NAME extends string = ''>(options: T, name: NAME = '' as NAME): AppModuleClass<T, NAME> {
    return class AnonAppModule extends AppModule<T, NAME> {
        constructor(config?: ModuleConfigOfOptions<T>) {
            super(options, name);
            if (config) {
                this.configure(config);
            }
        }

        clone(to?: AppModule<any, any>) {
            return super.clone(new (this as any).constructor());
        }
    } as any;
}

export class AppModule<T extends ModuleOptions = any, NAME extends string = ''> extends InjectorModule<NAME, ExtractConfigOfDefinition<DefaultObject<T['config']>>> {
    /**
     * Whether this module is for the root module. All its providers are automatically exported and moved to the root level.
     */
    public root: boolean = false;
    public parent?: AppModule<any, any>;
    protected configLoaded: boolean = false;

    public setupConfigs: ((module: AppModule<any, any>, config: any) => void)[] = [];

    /**
     * @internal
     * Note: We keep our own array since store clones.
     */
    public imports: AppModule<any, any>[] = [];

    constructor(
        public options: T,
        public name: NAME = '' as NAME,
        public configValues: { [path: string]: any } = {},
        public setups: ((module: AppModule<any, any>, config: any) => void)[] = [],
        public id: number = moduleId++,
    ) {
        super(name, {} as any, id);
        if (options.config instanceof ConfigDefinition) {
            options.config.setModuleClass(this as InjectorModule);
        }
        if (this.options.imports) {
            for (const module of this.options.imports) {
                const copy = module.clone();
                copy.setParent(this);
                this.imports.push(copy);
            }
        }
    }

    /**
     * When all configuration loaders have been loaded, this method is called.
     * It allows to further manipulate the module state depending on the final config.
     */
    process() {

    }

    getImports(): AppModule<ModuleOptions, any>[] {
        return this.imports;
    }

    getExports() {
        return this.options.exports ||= [];
    }

    hasImport(moduleClass: AppModuleClass<any, any>): boolean {
        for (const importModule of this.getImports()) {
            if (importModule instanceof moduleClass) return true;
        }
        return false;
    }

    /**
     * Modifies this module and adds a new import, returning the same module.
     */
    addImport(...modules: AppModule<any, any>[]): this {
        for (const module of modules) {
            const copied = module.clone();
            copied.setParent(this);
            this.imports.push(copied);
        }
        return this;
    }

    addController(...controller: ClassType[]) {
        if (!this.options.controllers) this.options.controllers = [];

        this.options.controllers.push(...controller);
    }

    addProvider(...provider: ProviderWithScope[]): this {
        if (!this.options.providers) this.options.providers = [];

        this.options.providers.push(...provider);
        return this;
    }

    addListener(...listener: (EventListener<any> | ClassType)[]): this {
        if (!this.options.listeners) this.options.listeners = [];

        this.options.listeners.push(...listener);
        return this;
    }

    addMiddleware(...middlewares: MiddlewareFactory[]): this {
        if (!this.options.middlewares) this.options.middlewares = [];

        this.options.middlewares.push(...middlewares);
        return this;
    }

    private hasConfigOption(path: string): boolean {
        if (path in this.configValues) return true;

        if (this.parent && this.parent.hasConfigOption(path)) return true;

        return false;
    }

    private getConfigOption(path: string): any {
        if (path in this.configValues) return this.configValues[path];

        if (this.parent && this.parent.hasConfigOption(path)) return this.parent.getConfigOption(path);

        return;
    }

    clearConfig(): void {
        this.config = {} as any;
        this.configLoaded = false;
    }

    invalidateConfigCache(): void {
        this.configLoaded = false;
        for (const module of this.getImports()) module.invalidateConfigCache();
    }

    getConfig(): ExtractConfigOfDefinition<DefaultObject<T['config']>> {
        if (this.configLoaded) return this.config;
        const config: any = {};
        if (!this.options.config) return this.config;
        this.configLoaded = true;

        for (const option of this.options.config.schema.getProperties()) {
            //todo: supported nested
            const path = this.name ? this.name + '.' + option.name : option.name;
            config[option.name] = this.getConfigOption(path);
        }

        Object.assign(this.config, jsonSerializer.for(this.options.config.schema).partialDeserialize(config));
        return this.config;
    }

    setParent(module: AppModule<any, any>): this {
        this.parent = module;
        return this;
    }

    clone(to?: AppModule<any, any>): AppModule<T, NAME> {
        //its important to not clone AppModule.config, as we want that the actual config value is re-resolved upon next getConfig call
        const m = to || new AppModule(cloneOptions(this.options), this.name, this.configValues, this.setups.slice(), this.id);
        m.options = cloneOptions(this.options);

        //its important to keep the id, as in the service-container we have only copies, not the real thing, and need a map from original to copy
        m.id = this.id;

        m.name = this.name;
        m.configValues = this.configValues;
        m.root = this.root;
        m.parent = this.parent;
        m.contextId = this.contextId;

        m.setups = this.setups.slice();
        m.setupProviderRegistry = this.setupProviderRegistry.clone();
        m.setupConfigs = this.setupConfigs.slice(0);

        const imports = m.getImports();
        const exports = m.getExports();

        for (let i = 0; i < imports.length; i++) {
            const old = imports[i];
            imports[i] = old.clone();
            imports[i].setParent(m);
            const index = exports.indexOf(old);
            if (index !== -1) exports[index] = imports[i];
        }
        return m;
    }

    getName(): NAME {
        return this.name;
    }

    /**
     * Allows to change the module config before `setup` and bootstrap is called. This is the last step right before the config is validated.
     */
    setupConfig(callback: (module: AppModule<T, any>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void): this {
        this.setupConfigs.push(callback);
        return this;
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the application bootstraps (thus loading all services/controllers/etc).
     */
    setup(callback: (module: AppModule<T, any>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void): this {
        this.setups.push(callback);
        return this;
    }

    /**
     * Sets configured values. Those are no longer inherited from the parent.
     */
    configure(config: ModuleConfigOfOptions<T>): this {
        this.invalidateConfigCache();
        const configValues: { [path: string]: any } = { ...this.configValues };

        if (this.options.imports) {
            for (const module of this.options.imports) {
                if (!module.getName()) continue;
                if (!(module.getName() in config)) continue;
                const moduleConfig = (config as any)[module.getName()];
                for (const [name, value] of Object.entries(moduleConfig)) {
                    const path = module.getName() ? module.getName() + '.' + name : name;
                    configValues[path] = value;
                }
            }
        }

        if (this.options.config) {
            for (const option of this.options.config.schema.getProperties()) {
                if (!(option.name in config)) continue;
                const path = this.name ? this.name + '.' + option.name : option.name;
                configValues[path] = (config as any)[option.name];
            }
        }

        this.configValues = configValues;
        return this;
    }

    /**
     * Overwrites configuration values of the current module.
     */
    setConfig(config: ModuleConfigOfOptions<T>): void {
        const resolvedConfig = this.getConfig();
        if (this.options.config) {
            const configNormalized = jsonSerializer.for(this.options.config.schema).partialDeserialize(config);
            for (const option of this.options.config.schema.getProperties()) {
                if (!(option.name in config)) continue;
                resolvedConfig[option.name] = (configNormalized as any)[option.name];
            }
        }
    }

    /**
     * Makes all the providers, controllers, etc available at the root module, basically exporting everything.
     */
    forRoot(): this {
        this.root = true;
        return this;
    }
}
