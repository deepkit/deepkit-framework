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

import {
    ClassSchema,
    ExtractClassDefinition,
    ExtractClassType,
    FieldDecoratorWrapper,
    getClassSchema,
    jsonSerializer,
    PlainSchemaProps,
    t,
    validate,
    ValidationFailed,
    ValidationFailedItem
} from '@deepkit/type';
import {ClassProvider, ExistingProvider, FactoryProvider, Provider, ValueProvider,} from './provider';
import {ClassType, getClassName, isClass, isFunction} from '@deepkit/core';
import {Module} from '../module';

export class ConfigToken<T extends ClassSchema> {
    constructor(public config: ConfigDefinition<T>, public name: keyof ExtractClassType<T> & string) {
    }

    getConfigPath(): string {
        const moduleName = this.config.getModule().getName();
        return moduleName ? moduleName + '.' + this.name : this.name;
    }
}

export class ConfigSlice<T extends ClassSchema> {
    public bag?: { [name: string]: any };

    constructor(public config: ConfigDefinition<T>, public names: (keyof ExtractClassType<T> & string)[]) {
        for (const name of names) {
            Object.defineProperty(this, name, {
                get: () => {
                    return this.bag ? this.bag[name] : undefined;
                }
            });
        }
    }
}

export class ConfigDefinition<T extends ClassSchema> {
    protected module?: Module;

    constructor(
        public readonly schema: T
    ) {
    }

    setModule(module: Module) {
        this.module = module;
    }

    getModule(): Module {
        if (!this.module) throw new Error('ConfigDefinition module not set. Make sure your config is actually assigned to a single module. See createModule({config: x}).');

        return this.module;
    }

    slice<N extends (keyof ExtractClassType<T> & string)[], C = ExtractClassType<T>>(...names: N): ClassType<Pick<ExtractClassType<T>, N[number]>> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, names);
            }
        } as any;
    }

    token<N extends keyof ExtractClassType<T> & string>(name: N): ConfigToken<T> {
        return new ConfigToken(this, name);
    }
}

export function createConfig<T extends PlainSchemaProps>(config: T): ConfigDefinition<ClassSchema<ExtractClassDefinition<T>>> {
    return new ConfigDefinition(t.schema(config));
}

export interface InjectDecorator {
    (target: object, property?: string, parameterIndexOrDescriptor?: any): any;

    /**
     * Mark as optional.
     */
    optional(): this;

    /**
     * Resolves the dependency token from the root injector.
     */
    root(): this;

    /**
     * Resolves a dependency value from a path, defined in the Configuration (.env file)
     */
    config(path: string): this;
}

type InjectOptions = {
    token: any | ForwardRef<any>;
    optional: boolean;
    config?: string;
    root: boolean;
};

type ForwardRef<T> = () => T;

export function inject(type?: any | ForwardRef<any>): InjectDecorator {
    const injectOptions: InjectOptions = {
        optional: false,
        root: false,
        token: type,
    };

    const fn = (target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => {
        FieldDecoratorWrapper((target: object, property, returnType) => {
            property.data['deepkit/inject'] = injectOptions;
            property.setFromJSType(returnType);
        })(target, propertyOrMethodName, parameterIndexOrDescriptor);
    };

    fn.optional = () => {
        injectOptions.optional = true;
        return fn;
    };

    fn.root = () => {
        injectOptions.root = true;
        return fn;
    };

    fn.config = (path: string) => {
        injectOptions.config = path;
        return fn;
    };

    return fn;
}

export class InjectToken {
    constructor(public readonly name: string) {
    }

    toString() {
        return 'InjectToken=' + this.name;
    }
}

export function injectable() {
    return (target: object) => {
        //don't do anything. This is just used to generate type metadata.
    };
}

export function isValueProvider(obj: any): obj is ValueProvider {
    return obj.provide && obj.hasOwnProperty('useValue');
}

export function isClassProvider(obj: any): obj is ClassProvider {
    return obj.provide && obj.hasOwnProperty('useClass');
}

export function isExistingProvider(obj: any): obj is ExistingProvider {
    return obj.provide && obj.hasOwnProperty('useExisting');
}

export function isFactoryProvider(obj: any): obj is FactoryProvider {
    return obj.provide && obj.hasOwnProperty('useFactory');
}

const CircularDetector = new Set();

export class CircularDependencyError extends Error {
}

export class TokenNotFoundError extends Error {
}

export class DependenciesUnmetError extends Error {
}

export class ConfigurationInvalidError extends Error {
}

export function tokenLabel(token: any): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (isClass(token)) return getClassName(token);
    if (isFunction(token.toString)) return token.toString();

    return token + '';
}

export interface ConfigContainer {
    get(path: string): any;
}

export class Injector {
    protected fetcher = new Map<any, (rootInjector?: Injector) => any>();
    protected resolved = new Map<any, any>();
    public circularCheck: boolean = true;
    public allowUnknown: boolean = false;

    public configContainer?: ConfigContainer;

    constructor(
        protected providers: Provider[] = [],
        protected parents: Injector[] = [],
    ) {
        this.addProviders(providers);
        this.addProvider({provide: Injector, useValue: this});
    }

    addProviders(providers: Provider[] = []) {
        for (const provider of providers) this.addProvider(provider);
    }

    /**
     * Creates clone of this instance, maintains the provider structure, but drops provider instances.
     * Note: addProviders() in the new fork changes the origin, since providers array is not cloned.
     */
    public fork(newRoot?: Injector) {
        const injector = new Injector();
        if (newRoot && (this.parents.length === 0 || (this.parents.length === 1 && this.parents[0].isRoot()))) {
            injector.parents = [newRoot];
        } else {
            injector.parents = this.parents.map(v => v.fork(newRoot));
        }

        injector.fetcher = this.fetcher;
        injector.providers = this.providers;
        return injector;
    }

    public isRoot() {
        return this.parents.length === 0;
    }

    public addProvider(provider: Provider) {
        if (isValueProvider(provider)) {
            this.fetcher.set(provider.provide, (frontInjector?: Injector) => {
                return provider.useValue;
            });
        } else if (isClassProvider(provider)) {
            this.fetcher.set(provider.provide, (frontInjector?: Injector) => {
                const resolved = this.resolved.get(provider.useClass);
                if (resolved) return resolved;
                return this.create(provider.useClass, frontInjector);
            });
        } else if (isExistingProvider(provider)) {
            this.fetcher.set(provider.provide, (frontInjector?: Injector) => {
                return this.fetcher.get(provider.useExisting)!(frontInjector);
            });
        } else if (isFactoryProvider(provider)) {
            this.fetcher.set(provider.provide, (frontInjector?: Injector) => {
                const deps: any[] = (provider.deps || []).map(v => this.get(v, frontInjector));
                return provider.useFactory(...deps);
            });
        } else if (isClass(provider)) {
            this.fetcher.set(provider, (frontInjector?: Injector) => {
                return this.create(provider, frontInjector);
            });
        }
    }

    public isDefined(token: any) {
        if (this.fetcher.has(token)) return true;

        for (const parent of this.parents) {
            if (parent.isDefined(token)) return true;
        }

        return false;
    }

    protected create<T>(classType: ClassType<T>, frontInjector?: Injector): T {
        const args: any[] = [];
        const argsCheck: string[] = [];
        const schema = getClassSchema(classType);

        for (const property of schema.getMethodProperties('constructor')) {
            const options = property.data['deepkit/inject'] as InjectOptions | undefined;
            let token: any = property.resolveClassType;
            const isOptional = options && options.optional;

            if (options && options.token) {
                token = isFunction(options.token) ? options.token() : options.token;
            }

            //todo: root vs front injector. Root means something different: means we need the latest parent.
            // const injectorToUse = options && options.root ? frontInjector || this : this;
            const injectorToUse = frontInjector || this;

            if (options && options.config) {
                token = 'config.' + options.config;
            }

            try {
                if (token instanceof ConfigToken) {
                    try {
                        const value = injectorToUse.get('config.' + token.getConfigPath(), frontInjector);
                        args.push(value);
                    } catch (e) {
                        argsCheck.push('x');
                        throw new DependenciesUnmetError(
                            `Unmet configuration dependency ${token.getConfigPath()} for argument ${argsCheck.length} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                            `Make sure configuration value '${token.getConfigPath()}' is set. ` + e
                        );
                    }
                } else if (isClass(token) && Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice) {
                    const value: ConfigSlice<any> = new token;

                    if (!value.bag) {
                        const bag: { [name: string]: any } = {};
                        const moduleName = value.config.getModule().getName();
                        for (const name of value.names) {
                            const path = moduleName ? moduleName + '.' + name : name;
                            try {
                                bag[name] = injectorToUse.get('config.' + path, frontInjector);
                            } catch (e) {
                                if (e instanceof TokenNotFoundError) {
                                    argsCheck.push('x');
                                    throw new DependenciesUnmetError(
                                        `Unmet configuration dependency ${path} for argument ${argsCheck.length} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                                        `Make sure configuration value '${path}' is set. ` + e
                                    );
                                }
                                throw e;
                            }
                        }

                        try {
                            value.bag = jsonSerializer.for(value.config.schema).validatedDeserialize(bag) as any;
                            args.push(value);
                        } catch (e) {
                            if (e instanceof ValidationFailed) {
                                const errorsMessage = e.errors.map(v => v.toString()).join(', ');
                                throw new ConfigurationInvalidError(`Configuration for module ${value.config.getModule().getName()} is invalid: ` + errorsMessage);
                            }
                            throw e;
                        }
                    }
                } else {
                    const value = injectorToUse.get(token, frontInjector);
                    args.push(value);
                }

                argsCheck.push('✓');
            } catch (e) {
                if (e instanceof TokenNotFoundError) {
                    if (isOptional) {
                        argsCheck.push('✓');
                        args.push(undefined);
                    } else {
                        argsCheck.push('?');
                        if (options && options.config) {
                            throw new DependenciesUnmetError(
                                `Undefined configuration value at argument ${argsCheck.length} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                                `Make sure '${tokenLabel(token)}' is defined either via .env files or Application.run().`
                            );
                        } else {
                            throw new DependenciesUnmetError(
                                `Unknown constructor argument ${argsCheck.length} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                                `Make sure '${tokenLabel(token)}' is provided. ` + e
                            );
                        }
                    }
                } else {
                    throw e;
                }
            }
        }

        return new classType(...args);
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const root = CircularDetector.size === 0;

        try {
            let resolved = this.resolved.get(token);
            if (resolved !== undefined) return resolved;

            const builder = this.fetcher.get(token);
            if (builder) {
                if (this.circularCheck) {
                    if (CircularDetector.has(token)) {
                        const path = [...CircularDetector.values(), token].map(tokenLabel).join(' -> ');
                        throw new CircularDependencyError(`Circular dependency found ${path}`);
                    }

                    CircularDetector.add(token);
                }

                resolved = builder(frontInjector);
                this.resolved.set(token, resolved);
                return resolved;
            }

            //check first parents before we simply create the class instance
            for (const parent of this.parents) {
                if (parent.isDefined(token)) return parent.get(token, frontInjector ?? this);
            }

            if (frontInjector?.isDefined(token)) return frontInjector.get(token);

            if (this.allowUnknown && isClass(token)) {
                resolved = this.create(token, frontInjector);
                this.resolved.set(token, resolved);
                return resolved;
            }

            throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
        } finally {
            CircularDetector.delete(token);
            if (root) CircularDetector.clear();
        }
    }
}
