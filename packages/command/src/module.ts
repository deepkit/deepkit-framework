/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { JSONPartial, jsonSerializer, ValidationFailed } from '@deepkit/type';
import { ConfigDefinition, InjectorModule, InjectToken, ProviderWithScope } from '@deepkit/injector';
import { ClassType, CustomError } from '@deepkit/core';
import { EventListener } from '@deepkit/event';
import type { WorkflowDefinition } from '@deepkit/workflow';

export type DefaultObject<T> = T extends undefined ? {} : T;
export type ExtractImportConfigs<T extends Array<Module<any>> | undefined> = T extends Array<any> ? { [M in T[number]as (ExtractModuleOptions<M>['name'] & string)]?: ExtractPartialConfigOfDefinition<DefaultObject<ExtractModuleOptions<M>['config']>> } : {};
export type ExtractConfigOfDefinition<T> = T extends ConfigDefinition<infer C> ? C : {};
export type ExtractPartialConfigOfDefinition<T> = T extends ConfigDefinition<infer C> ? JSONPartial<C> : {};
export type ExtractModuleOptions<T extends Module<any>> = T extends Module<infer O> ? O : never;
export type ModuleConfigOfOptions<O extends ModuleOptions<any>> = ExtractImportConfigs<O['imports']> & ExtractPartialConfigOfDefinition<DefaultObject<O['config']>>;

export interface ModuleOptions<NAME extends string | undefined> {
    /**
     * The lowercase alphanumeric module name. This is used in the configuration system for example.
     * Choose a short unique name for best usability.
     */
    readonly name?: NAME;

    /**
     * Providers.
     */
    providers?: ProviderWithScope[];

    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: (ClassType | InjectToken | string | Module<any>)[];

    /**
     * Module bootstrap class.
     */
    bootstrap?: ClassType<any>;

    /**
     * Configuration definition.
     *
     * @example
     * ```typescript
     * import {t} from '@deepkit/type';
     *
     * const MyModule = createModule({
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
    imports?: Module<any>[];
}

function cloneOptions<T extends ModuleOptions<any>>(options: T): T {
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

export class Module<T extends ModuleOptions<any>> extends InjectorModule<T['name'], ExtractConfigOfDefinition<DefaultObject<T['config']>>> {
    public root: boolean = false;
    public parent?: Module<any>;
    protected configLoaded: boolean = false;

    constructor(
        public options: T,
        public configValues: { [path: string]: any } = {},
        public setups: ((module: Module<T>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void)[] = [],
        public readonly id: number = moduleId++,
    ) {
        super(options.name, {} as any);
        if (options.config instanceof ConfigDefinition) {
            options.config.setModule(this);
        }
        if (this.options.imports) {
            for (const module of this.options.imports) {
                module.setParent(this);
            }
        }
    }

    getImports(): Module<ModuleOptions<any>>[] {
        return this.options.imports || [];
    }

    getExports() {
        return this.options.exports || [];
    }

    hasImport(module: Module<any>): boolean {
        for (const importModule of this.getImports()) {
            if (importModule.id === module.id) return true;
        }
        return false;
    }

    /**
     * Modifies this module and adds a new import, returning the same module.
     */
    addImport(...modules: Module<any>[]): this {
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
            const path = this.options.name ? this.options.name + '.' + option.name : option.name;
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

    setParent(module: Module<any>) {
        this.parent = module;
    }

    clone(): Module<T> {
        const m = new Module(cloneOptions(this.options), { ...this.configValues }, this.setups.slice(0), this.id);
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

    getName(): string {
        return this.options.name || '';
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the application bootstraps (thus loading all services/controllers/etc).
     *
     * Returns a new forked module of this with the changes applied.
     */
    setup(callback: (module: Module<T>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void): Module<T> {
        const m = this.clone();
        m.setups.push(callback);
        return m;
    }

    /**
     * Sets configured values that no longer are inherited from the parent.
     * Returns a new forked module of this with the changes applied.
     */
    configure(config: ModuleConfigOfOptions<T>): Module<T> {
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
                const path = this.options.name ? this.options.name + '.' + option.name : option.name;
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
    forRoot(): Module<T> {
        const m = this.clone();
        m.root = true;
        return m;
    }
}

export function createModule<O extends ModuleOptions<NAME>, NAME extends string>(options: O & { name?: NAME }): Module<O> {
    return new Module(options);
}
