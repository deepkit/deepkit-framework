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
import {ClassProvider, ExistingProvider, FactoryProvider, getProviders, Provider, ProviderWithScope, ValueProvider} from './provider';
import {ClassType, CompilerContext, getClassName, isClass, isFunction} from '@deepkit/core';
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

    public type!: T;

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
    readonly optional: this;

    /**
     * Resolves the dependency token from the root injector.
     */
    readonly root: this;
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

    Object.defineProperty(fn, 'optional', {
        get() {
            injectOptions.optional = true;
            return fn;
        }
    });

    Object.defineProperty(fn, 'root', {
        get() {
            injectOptions.optional = true;
            return fn;
        }
    });

    return fn as InjectDecorator;
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

let CircularDetector: any[] = [];

export interface BasicInjector {
    get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R;
}

export class Injector {
    public circularCheck: boolean = true;
    public allowUnknown: boolean = false;

    protected resolved: any[] = [];

    protected retriever(injector: Injector, token: any, frontInjector?: Injector): any {
        for (const parent of injector.parents) {
            const v = parent.retriever(parent, token, frontInjector);
            if (v !== undefined) return v;
        }
        return undefined;
    }

    constructor(
        protected providers: Provider[] = [],
        public parents: Injector[] = [],
        protected factories = new Map<any, (rootInjector?: Injector) => any>(),
        protected injectorContext?: InjectorContext
    ) {
        if (providers.length) {
            this.addProviders(providers);
        }
    }

    addProviders(providers: Provider[] = [], withBuild = true) {
        for (const provider of providers) this.addProvider(provider, false);
        if (withBuild) {
            this.retriever = this.buildRetriever();
        }
    }

    /**
     * Creates a clone of this instance, maintains the provider structure, but drops provider instances.
     * Note: addProviders() in the new fork changes the origin, since providers array is not cloned.
     */
    public fork(parents?: Injector[], injectorContext?: InjectorContext) {
        const injector = new Injector(undefined, parents || this.parents, this.factories, injectorContext);
        injector.providers = this.providers;
        injector.retriever = this.retriever;
        return injector;
    }

    public isRoot() {
        return this.parents.length === 0;
    }

    protected getRoot(): Injector {
        if (this.parents.length) return this.parents[0].getRoot();

        return this;
    }

    public addProvider(provider: Provider, withBuild = true) {
        if (this.factories.size === 0) {
            this.factories.set(Injector, (frontInjector?: Injector) => {
                return this;
            });
        }

        if (isValueProvider(provider)) {
            this.factories.set(provider.provide, function (frontInjector?: Injector) {
                return provider.useValue;
            });
        } else if (isClassProvider(provider)) {
            this.factories.set(provider.provide, (frontInjector?: Injector) => {
                return this.create(provider.useClass, frontInjector);
            });
        } else if (isExistingProvider(provider)) {
            this.factories.set(provider.provide, (frontInjector?: Injector) => {
                return (frontInjector || this).get(provider.useExisting, frontInjector);
            });
        } else if (isFactoryProvider(provider)) {
            this.factories.set(provider.provide, (frontInjector?: Injector) => {
                const deps: any[] = (provider.deps || []).map(v => (frontInjector || this).get(v, frontInjector));
                return provider.useFactory(...deps);
            });
        } else if (isClass(provider)) {
            this.factories.set(provider, (frontInjector?: Injector) => {
                return this.create(provider, frontInjector);
            });
        }
        if (withBuild) {
            this.retriever = this.buildRetriever();
        }
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
                if (token instanceof ConfigDefinition) {
                    args.push(token.getModule().getConfig());
                } else if (token instanceof ConfigToken) {
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

    protected buildRetriever(): (injector: Injector, token: any, frontInjector?: Injector) => any {
        const compiler = new CompilerContext();
        const lines: string[] = [];
        this.resolved = [];

        const injectorContextClassType = compiler.reserveVariable('injectorContextClassType', InjectorContext);
        lines.push(`
            case ${injectorContextClassType}: return injector.injectorContext;
        `);

        let resolvedIds = 0;
        for (const [provide, factory] of this.factories.entries()) {
            const resolvedId = resolvedIds++;
            this.resolved.push(undefined);
            const tokenVar = compiler.reserveVariable('token', provide);
            const resolvedIdVar = compiler.reserveVariable('resolvedId', resolvedId);
            const factoryVar = compiler.reserveVariable('factory', factory);
            lines.push(`
                case ${tokenVar}: {
                    const r = injector.resolved[${resolvedIdVar}];
                    if (r !== undefined) return r;
                    return injector.resolved[${resolvedIdVar}] = ${factoryVar}(frontInjector);
                }
            `);
        }

        const parents: string[] = [];
        for (let i = 0; i < this.parents.length; i++) {
            parents.push(`
                {
                    const v = injector.parents[${i}].retriever(injector.parents[${i}], token, frontInjector);
                    if (v !== undefined) return v;
                }
            `);
        }

        return compiler.build(`
        switch (token) {
            ${lines.join('\n')}
        }
        
        ${parents.join('\n')}

        return undefined;
        `, 'injector', 'token', 'frontInjector') as any;
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        try {
            if (this.circularCheck && -1 !== CircularDetector.indexOf(token)) {
                const path = [...CircularDetector, token].map(tokenLabel).join(' -> ');
                throw new CircularDependencyError(`Circular dependency found ${path}`);
            }

            CircularDetector.push(token);

            const v = this.retriever(this, token, frontInjector || this);
            if (v !== undefined) return v;

            throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
        } finally {
            CircularDetector.pop();
        }
    }
}

export class MemoryInjector extends Injector {

    constructor(protected providers: { provide: any, useValue: any }[]) {
        super();
    }

    fork(parents?: Injector[]): Injector {
        return this;
    }

    protected retriever(injector: Injector, token: any) {
        return injector.get(token);
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        for (const p of this.providers) {
            if (p.provide === token) return p.useValue;
        }
        throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
    }
}

export class ContextRegistry {
    public contexts: Context[] = [];

    get size(): number {
        return this.contexts.length;
    }

    get(id: number): Context {
        return this.contexts[id];
    }

    set(id: number, value: Context) {
        this.contexts[id] = value;
    }
}

export class ScopedContextScopeCaches {
    protected caches: { [name: string]: ScopedContextCache } = {};

    constructor(protected size: number) {
    }


    getCache(scope: string): ScopedContextCache {
        let cache = this.caches[scope];

        if (!cache) {
            cache = new ScopedContextCache(this.size);
            this.caches[scope] = cache;
        }

        return cache;
    }
}

export class ScopedContextCache {
    protected injectors: (Injector | undefined)[] = new Array(this.size);

    constructor(protected size: number) {
    }

    get(contextId: number): Injector | undefined {
        return this.injectors[contextId];
    }

    set(contextId: number, injector: Injector) {
        this.injectors[contextId] = injector;
    }
}

export class Context {
    providers: ProviderWithScope[] = [];

    constructor(
        public readonly id: number,
        public readonly parent?: Context,
    ) {
    }
}

export class InjectorContext {
    protected injectors: (Injector | undefined)[] = new Array(this.contextManager.contexts.length);
    public readonly scopeCaches: ScopedContextScopeCaches;
    protected cache: ScopedContextCache;

    public static contextSymbol = Symbol('context');

    constructor(
        public readonly contextManager: ContextRegistry = new ContextRegistry,
        public readonly scope: string = 'module',
        public readonly parent?: InjectorContext,
        public readonly additionalInjectorParent?: Injector,
        scopeCaches?: ScopedContextScopeCaches,
    ) {
        this.scopeCaches = scopeCaches || new ScopedContextScopeCaches(this.contextManager.size);
        this.cache = this.scopeCaches.getCache(this.scope);
    }

    static forProviders(providers: ProviderWithScope[]) {
        const registry = new ContextRegistry();
        const context = new Context(0);
        registry.set(0, context);
        context.providers.push(...providers);
        return new InjectorContext(registry);
    }

    public getInjector(contextId: number): Injector {
        let injector = this.injectors[contextId];
        if (injector) return injector;

        // injector = this.cache.get(contextId);
        // if (injector) return injector;

        const parents: Injector[] = [];
        parents.push(this.parent ? this.parent.getInjector(contextId) : new Injector());
        if (this.additionalInjectorParent) parents.push(this.additionalInjectorParent.fork(undefined, this));

        const context = this.contextManager.get(contextId);
        if (context.parent) parents.push(this.getInjector(context.parent.id));

        injector = this.cache.get(contextId);
        if (injector) {
            //we have one from cache. Clear it, and return
            injector = injector.fork(parents, this);
            return this.injectors[contextId] = injector;
        }

        const providers = getProviders(context.providers, this.scope);

        injector = new Injector(providers, parents, undefined, this);
        this.injectors[contextId] = injector;
        this.cache.set(contextId, injector);

        return injector;
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const context = token ? (token as any)[InjectorContext.contextSymbol] as Context : undefined;
        const injector = this.getInjector(context ? context.id : 0);
        return injector.get(token, frontInjector);
    }

    public createChildScope(scope: string, additionalInjectorParent?: Injector): InjectorContext {
        return new InjectorContext(this.contextManager, scope, this, additionalInjectorParent, this.scopeCaches);
    }
}
