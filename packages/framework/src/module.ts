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

import {EventListener} from './decorator';
import {JSONPartial, jsonSerializer, ValidationFailed} from '@deepkit/type';
import {ConfigDefinition, InjectToken} from './injector/injector';
import {ProviderWithScope} from './injector/provider';
import {ClassType, CustomError} from '@deepkit/core';

export type DefaultObject<T> = T extends undefined ? {} : T;
export type ExtractImportConfigs<T extends Array<Module<any>> | undefined> = T extends Array<any> ? { [M in T[number] as (ExtractModuleOptions<M>['name'] & string)]?: ExtractPartialConfigOfDefinition<DefaultObject<ExtractModuleOptions<M>['config']>> } : {};
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
     * RPC/HTTP/CLI controllers.
     */
    controllers?: ClassType[];

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
    const copied = {...options};
    copied.imports = copied.imports?.slice(0);
    copied.exports = copied.exports?.slice(0);
    copied.providers = copied.providers?.slice(0);
    copied.controllers = copied.controllers?.slice(0);
    copied.listeners = copied.listeners?.slice(0);
    return copied;
}

export class ConfigurationInvalidError extends CustomError {}

let moduleId = 0;

export class Module<T extends ModuleOptions<any>> {
    public root: boolean = false;
    public parent?: Module<any>;
    private resolvedConfig: any;

    constructor(
        public options: T,
        public configValues: { [path: string]: any } = {},
        public setups: ((module: Module<T>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void)[] = [],
        public readonly id: number = moduleId++,
    ) {
        if (options.config instanceof ConfigDefinition) {
            options.config.setModule(this);
        }
        if (this.options.imports) {
            for (const module of this.options.imports) {
                module.setParent(this);
            }
        }
    }

    getImports(): Module<any>[] {
        return this.options.imports || [];
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
        if (this.resolvedConfig) return this.resolvedConfig;
        const config: any = {};
        if (!this.options.config) return config;

        for (const option of this.options.config.schema.getClassProperties().values()) {
            const path = this.options.name ? this.options.name + '.' + option.name : option.name;
            config[option.name] = this.getConfigOption(path);
        }

        try {
            return this.resolvedConfig = jsonSerializer.for(this.options.config.schema).validatedDeserialize(config) as any;
        } catch (e) {
            if (e instanceof ValidationFailed) {
                const errorsMessage = e.errors.map(v => v.toString(this.getName())).join(', ');
                throw new ConfigurationInvalidError(`Configuration for module ${this.getName()} is invalid. Make sure the module is correctly configured. Error: ` + errorsMessage);
            }
            throw e;
        }
    }

    setParent(module: Module<any>) {
        this.parent = module;
    }

    clone(): Module<T> {
        const m = new Module(cloneOptions(this.options), {...this.configValues}, this.setups.slice(0), this.id);
        m.root = this.root;
        return m;
    }

    getName(): string {
        return this.options.name || '';
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the application bootstraps (thus loading all services/controllers/etc).
     *
     * Returns a new forked module of this.
     */
    setup(callback: (module: Module<T>, config: ExtractConfigOfDefinition<DefaultObject<T['config']>>) => void): Module<T> {
        const m = this.clone();
        m.setups.push(callback);
        return m;
    }

    /**
     * Sets configured values that no longer are inherited from the parent.
     * Returns a new forked module of this.
     */
    configure(config: ModuleConfigOfOptions<T>): Module<T> {
        const configValues: { [path: string]: any } = {...this.configValues};

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
            for (const option of this.options.config.schema.getClassProperties().values()) {
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
     * Makes all the providers, controllers, etc available at the root module, basically exporting everything.
     * Returns a new forked module of this.
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
