/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ExtractClassDefinition, JSONPartial, jsonSerializer, PlainSchemaProps, t, ValidationFailed } from '@deepkit/type';
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
     * Module bootstrap class.
     */
    bootstrap?: ClassType;

    /**
     * Configuration definition.
     *
     * @example
     * ```typescript
     * import {t} from '@deepkit/type';
     *
     * const myModule = new AppModule({
     *     config: {
     *         debug: t.boolean.default(false),
     *     }
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

export class ConfigurationInvalidError extends CustomError { }

let moduleId = 0;


export class AppModuleConfig<T extends PlainSchemaProps> extends ConfigDefinition<ExtractClassDefinition<T>> {
    constructor(public config: T) {
        super(t.schema(config));
    }
}

export class AppModule<T extends ModuleOptions, NAME extends string = ''> extends InjectorModule<NAME, ExtractConfigOfDefinition<DefaultObject<T['config']>>> {
    public root: boolean = false;
    public parent?: AppModule<any, any>;
    protected configLoaded: boolean = false;

    constructor(
        public options: T,
        /**
         * The lowercase alphanumeric module name. This is used in the configuration system for example.
         * Choose a short unique name for best usability.
         */
        public name: NAME = '' as NAME,
        public configValues: { [path: string]: any } = {},
        public setups: ((module: AppModule<T, NAME>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void)[] = [],
        public readonly id: number = moduleId++,
    ) {
        super(name, {} as any);
        if (options.config instanceof ConfigDefinition) {
            options.config.setModule(this as InjectorModule);
        }
        if (this.options.imports) {
            for (const module of this.options.imports) {
                module.setParent(this);
            }
        }
    }

    getImports(): AppModule<ModuleOptions, any>[] {
        return this.options.imports || [];
    }

    getExports() {
        return this.options.exports || [];
    }

    hasImport(module: AppModule<any, any>): boolean {
        for (const importModule of this.getImports()) {
            if (importModule.id === module.id) return true;
        }
        return false;
    }

    /**
     * Modifies this module and adds a new import, returning the same module.
     */
    addImport(...modules: AppModule<any, any>[]): this {
        for (const module of modules) {
            module.setParent(this);
            if (!this.options.imports) this.options.imports = [];
            this.options.imports.push(module);
        }
        return this;
    }

    addController(...controller: ClassType[]) {
        if (!this.options.controllers) this.options.controllers = [];

        this.options.controllers.push(...controller);
    }

    addProvider(...provider: ProviderWithScope[]) {
        if (!this.options.providers) this.options.providers = [];

        this.options.providers.push(...provider);
    }

    addListener(...listener: ClassType[]) {
        if (!this.options.listeners) this.options.listeners = [];

        this.options.listeners.push(...listener);
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

    getConfig(): ExtractConfigOfDefinition<DefaultObject<T['config']>> {
        if (this.configLoaded) return this.config;
        const config: any = {};
        if (!this.options.config) return this.config;
        this.configLoaded = true;

        for (const option of this.options.config.schema.getProperties()) {
            const path = this.name ? this.name + '.' + option.name : option.name;
            config[option.name] = this.getConfigOption(path);
        }

        try {
            Object.assign(this.config, jsonSerializer.for(this.options.config.schema).validatedDeserialize(config));
            return this.config;
        } catch (e) {
            if (e instanceof ValidationFailed) {
                const errorsMessage = e.errors.map(v => v.toString(this.getName())).join(', ');
                throw new ConfigurationInvalidError(`Configuration for module ${this.getName() || 'root'} is invalid. Make sure the module is correctly configured. Error: ` + errorsMessage);
            }
            throw e;
        }
    }

    setParent(module: AppModule<any, any>) {
        this.parent = module;
    }

    clone(): AppModule<T, NAME> {
        const m = new AppModule(cloneOptions(this.options), this.name, { ...this.configValues }, this.setups.slice(0), this.id);
        m.root = this.root;
        m.parent = this.parent;
        m.setupProviderRegistry = this.setupProviderRegistry.clone();

        const imports = m.getImports();
        const exports = m.getExports();
        for (let i = 0; i < imports.length; i++) {
            const old = imports[i];
            imports[i] = old.clone();
            const index = exports.indexOf(old);
            if (index !== -1) exports[index] = imports[i];
        }
        return m;
    }

    getName(): NAME {
        return this.name;
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the application bootstraps (thus loading all services/controllers/etc).
     *
     * Returns a new forked module of this with the changes applied.
     */
    setup(callback: (module: AppModule<T, any>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void): AppModule<T, NAME> {
        const m = this.clone();
        m.setups.push(callback);
        return m;
    }

    /**
     * Sets configured values that no longer are inherited from the parent.
     * Returns a new forked module of this with the changes applied.
     */
    configure(config: ModuleConfigOfOptions<T>): AppModule<T, NAME> {
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

        const m = this.clone();
        m.configValues = configValues;
        return m;
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
     * Returns a new forked module of this with root enabled.
     */
    forRoot(): AppModule<T, NAME> {
        const m = this.clone();
        m.root = true;
        return m;
    }
}
