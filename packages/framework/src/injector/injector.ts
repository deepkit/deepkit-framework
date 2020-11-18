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

import {ClassSchema, ExtractClassDefinition, FieldDecoratorWrapper, getClassSchema, PlainSchemaProps, t} from '@deepkit/type';
import {ClassProvider, ExistingProvider, FactoryProvider, Provider, ValueProvider,} from './provider';
import {ClassType, getClassName, isClass, isFunction} from '@deepkit/core';
import {Module, ModuleOptions} from '../module';


export class ConfigToken<T extends {}> {
    constructor(public config: ConfigDefinition<T>, public name: keyof T & string) {
    }
}

export class ConfigSlice<T extends {}> {
    public bag?: { [name: string]: any };
    public config!: ConfigDefinition<T>;
    public names!: (keyof T & string)[];

    constructor(config: ConfigDefinition<T>, names: (keyof T & string)[]) {
        //we want that ConfigSlice acts as a regular plain object, which can be serialized at wish.
        Object.defineProperties(this, {
            config: {enumerable: false, value: config},
            names: {enumerable: false, value: names},
            bag: {enumerable: false, writable: true},
        });

        for (const name of names) {
            Object.defineProperty(this, name, {
                enumerable: true,
                get: () => {
                    return this.bag ? this.bag[name] : undefined;
                }
            });
        }
    }
}

export class ConfigDefinition<T extends {}> {
    protected module?: Module<any>;

    constructor(
        public readonly schema: ClassSchema<T>
    ) {
    }

    setModule(module: Module<any>) {
        this.module = module;
    }

    getModule(): Module<ModuleOptions<any>> {
        if (!this.module) throw new Error('ConfigDefinition module not set. Make sure your config is actually assigned to a single module. See createModule({config: x}).');

        return this.module;
    }

    all(): ClassType<T> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, [...self.schema.getClassProperties().values()].map(v => v.name) as any);
            }
        } as any;
    }

    slice<N extends (keyof T & string)[]>(names: N): ClassType<Pick<T, N[number]>> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, names);
            }
        } as any;
    }

    token<N extends (keyof T & string)>(name: N): ConfigToken<T> {
        return new ConfigToken(this, name);
    }
}

export function createConfig<T extends PlainSchemaProps>(config: T): ConfigDefinition<ExtractClassDefinition<T>> {
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
}

type InjectOptions = {
    token: any | ForwardRef<any>;
    optional: boolean;
    root: boolean;
};

type ForwardRef<T> = () => T;

export function inject(token?: any | ForwardRef<any>): InjectDecorator {
    const injectOptions: InjectOptions = {
        optional: false,
        root: false,
        token: token,
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

    protected getRoot(): Injector {
        if (this.parents.length) return this.parents[0].getRoot();

        return this;
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

            const injectorToUse = options?.root ? this.getRoot() : (frontInjector || this);

            try {
                if (token instanceof ConfigToken) {
                    const config = token.config.getModule().getConfig();
                    args.push(config[token.name]);
                } else if (isClass(token) && Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice) {
                    const value: ConfigSlice<any> = new token;

                    if (!value.bag) {
                        const bag: { [name: string]: any } = {};
                        const config = value.config.getModule().getConfig();
                        // console.log('module config', value.config.getModule().getName(), config);
                        for (const name of value.names) {
                            bag[name] = config[name];
                        }
                        value.bag = bag;
                        args.push(value);
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
                        throw new DependenciesUnmetError(
                            `Unknown constructor argument ${property.name} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                            `Make sure '${tokenLabel(token)}' is provided. ` + e
                        );
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
