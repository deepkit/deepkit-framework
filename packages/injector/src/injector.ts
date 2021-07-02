/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, ExtractClassDefinition, FieldDecoratorWrapper, getClassSchema, jsonSerializer, PlainSchemaProps, PropertySchema, t } from '@deepkit/type';
import { getProviders, isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, Provider, ProviderWithScope, Tag, TagProvider, TagRegistry } from './provider';
import { ClassType, CompilerContext, CustomError, getClassName, isClass, isFunction, isPrototypeOfBase } from '@deepkit/core';
import { InjectorModule } from './module';


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
            config: { enumerable: false, value: config },
            names: { enumerable: false, value: names },
            bag: { enumerable: false, writable: true },
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

    valueOf() {
        return { ...this };
    }
}

export class ConfigDefinition<T extends {}> {
    protected module?: InjectorModule;

    public type!: T;

    constructor(
        public readonly schema: ClassSchema<T>
    ) {
    }

    setModule(module: InjectorModule) {
        this.module = module;
    }

    hasModule(): boolean {
        return this.module !== undefined;
    }

    getModule(): InjectorModule {
        if (!this.module) throw new Error('ConfigDefinition module not set. Make sure your config is assigned to a single module. See createModule({config: x}).');

        return this.module;
    }

    getConfigOrDefaults(): any {
        if (this.module) return this.module.getConfig();
        return jsonSerializer.for(this.schema).validatedDeserialize({});
    }

    all(): ClassType<T> {
        const self = this;
        return class extends ConfigSlice<T> {
            constructor() {
                super(self, [...self.schema.getProperties()].map(v => v.name) as any);
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

export class InjectorReference {
    constructor(public readonly to: any) {
    }
}

export function injectorReference<T>(classTypeOrToken: T): any {
    return new InjectorReference(classTypeOrToken);
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

export class CircularDependencyError extends CustomError {
}

export class TokenNotFoundError extends CustomError {
}

export class DependenciesUnmetError extends CustomError {
}

export function tokenLabel(token: any): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (token instanceof TagProvider) return 'Tag(' + getClassName(token.provider.provide) + ')';
    if (isClass(token)) return getClassName(token);
    if (isFunction(token.toString)) return token.toString();

    return token + '';
}

export interface ConfigContainer {
    get(path: string): any;
}

let CircularDetector: any[] = [];
let CircularDetectorResets: (() => void)[] = [];

export interface BasicInjector {
    get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R;
}

export class Injector implements BasicInjector {
    public circularCheck: boolean = true;

    protected resolved: any[] = [];

    protected retriever(injector: Injector, token: any, frontInjector?: Injector): any {
        for (const parent of injector.parents) {
            const v = 'retriever' in parent ? parent.retriever(parent, token, frontInjector) : parent.get(token, frontInjector);
            if (v !== undefined) return v;
        }
        return undefined;
    }

    constructor(
        protected providers: Provider[] = [],
        protected parents: (BasicInjector | Injector)[] = [],
        protected injectorContext: InjectorContext = new InjectorContext,
        protected configuredProviderRegistry: ConfiguredProviderRegistry | undefined = undefined,
        protected tagRegistry: TagRegistry = new TagRegistry()
    ) {
        if (!this.configuredProviderRegistry) this.configuredProviderRegistry = injectorContext.configuredProviderRegistry;
        if (this.providers.length) this.retriever = this.buildRetriever();
    }

    /**
     * Creates a clone of this instance, maintains the provider structure, but drops provider instances.
     * Note: addProviders() in the new fork changes the origin, since providers array is not cloned.
     */
    public fork(parents?: Injector[], injectorContext?: InjectorContext) {
        const injector = new Injector(undefined, parents || this.parents, injectorContext, this.configuredProviderRegistry, this.tagRegistry);
        injector.providers = this.providers;
        injector.retriever = this.retriever;
        return injector;
    }

    /**
     * Changes the provider structure of this injector.
     *
     * Note: This is very performance sensitive. Every time you call this function a new dependency injector function
     * is generated, which si pretty slow. So, it's recommended to create a Injector with providers in the constructor
     * and not change it.
     */
    public addProviders(...providers: Provider[]) {
        this.providers.push(...providers);
        this.retriever = this.buildRetriever();
    }

    public isRoot() {
        return this.parents.length === 0;
    }

    protected createFactoryProperty(property: PropertySchema, compiler: CompilerContext, classTypeVar: string, argPosition: number, notFoundFunction: string) {
        const options = property.data['deepkit/inject'] as InjectOptions | undefined;
        let token: any = property.resolveClassType;
        const isOptional = options && options.optional;

        if (options && options.token) {
            token = isFunction(options.token) ? options.token() : options.token;
        }

        if (token instanceof ConfigDefinition) {
            if (token.hasModule()) {
                const module = this.injectorContext.getModule(token.getModule().getName());
                return compiler.reserveVariable('fullConfig', module.getConfig());
            } else {
                return compiler.reserveVariable('fullConfig', token.getConfigOrDefaults());
            }
        } else if (token instanceof ConfigToken) {
            if (token.config.hasModule()) {
                const module = this.injectorContext.getModule(token.config.getModule().getName());
                const config = module.getConfig();
                return compiler.reserveVariable(token.name, (config as any)[token.name]);
            } else {
                const config = token.config.getConfigOrDefaults();
                return compiler.reserveVariable(token.name, (config as any)[token.name]);
            }
        } else if (isClass(token) && (Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice || Object.getPrototypeOf(token) === ConfigSlice)) {
            const value: ConfigSlice<any> = new token;
            if (!value.bag) {
                if (value.config.hasModule()) {
                    const module = this.injectorContext.getModule(value.config.getModule().getName());
                    value.bag = module.getConfig();
                } else {
                    value.bag = value.config.getConfigOrDefaults();
                }
                return compiler.reserveVariable('configSlice', value);
            }
        } else if (token === TagRegistry) {
            return compiler.reserveVariable('tagRegistry', this.tagRegistry);
        } else if (isPrototypeOfBase(token, Tag)) {
            const tokenVar = compiler.reserveVariable('token', token);
            const providers = compiler.reserveVariable('tagRegistry', this.tagRegistry.resolve(token));
            return `new ${tokenVar}(${providers}.map(v => frontInjector.retriever(frontInjector, v, frontInjector)))`;
        } else {
            if (token === undefined) throw new Error(`Argument type of '${property.name}' at position ${argPosition} is undefined. Imported reflect-metadata correctly? For circular references use @inject(() => T) ${property.name}:T.`);
            const tokenVar = compiler.reserveVariable('token', token);
            const orThrow = isOptional ? '' : `|| ${notFoundFunction}(${classTypeVar}, ${JSON.stringify(property.name)}, ${argPosition}, ${tokenVar})`;

            return `frontInjector.retriever(frontInjector, ${tokenVar}, frontInjector) ${orThrow}`;
        }

        return 'undefined';
    }

    protected createFactory(compiler: CompilerContext, classType: ClassType): string {
        const schema = getClassSchema(classType);
        const args: string[] = [];
        const propertyAssignment: string[] = [];
        const classTypeVar = compiler.reserveVariable('classType', classType);

        for (const property of schema.getMethodProperties('constructor')) {
            args.push(this.createFactoryProperty(property, compiler, classTypeVar, args.length, 'constructorParameterNotFound'));
        }

        for (const property of schema.getProperties()) {
            if (!('deepkit/inject' in property.data)) continue;
            if (property.methodName === 'constructor') continue;
            propertyAssignment.push(`v.${property.name} = ${this.createFactoryProperty(property, compiler, classTypeVar, args.length, 'propertyParameterNotFound')};`);
        }

        return `v = new ${classTypeVar}(${args.join(',')});\n${propertyAssignment.join('\n')}`;
    }

    protected buildRetriever(): (injector: Injector, token: any, frontInjector?: Injector) => any {
        const compiler = new CompilerContext();
        const lines: string[] = [];
        const resets: string[] = [];
        this.resolved = [];

        lines.push(`
            case ${compiler.reserveVariable('injectorContextClassType', InjectorContext)}: return injector.injectorContext;
            case ${compiler.reserveVariable('injectorClassType', Injector)}: return injector;
        `);

        let resolvedIds = 0;
        const normalizedProviders = new Map<any, Provider>();

        //make sure that providers that declare the same provider token will be filtered out so that the last will be used.
        for (const provider of this.providers) {
            if (provider instanceof TagProvider) {
                normalizedProviders.set(provider, provider);
            } else if (isValueProvider(provider)) {
                normalizedProviders.set(provider.provide, provider);
            } else if (isClassProvider(provider)) {
                normalizedProviders.set(provider.provide, provider);
            } else if (isExistingProvider(provider)) {
                normalizedProviders.set(provider.provide, provider);
            } else if (isFactoryProvider(provider)) {
                normalizedProviders.set(provider.provide, provider);
            } else if (isClass(provider)) {
                normalizedProviders.set(provider, provider);
            }
        }

        for (let provider of normalizedProviders.values()) {
            const resolvedId = resolvedIds++;
            this.resolved.push(undefined);
            let transient = false;
            let factory = '';
            let token: any;
            const tagToken = provider instanceof TagProvider ? provider : undefined;
            if (provider instanceof TagProvider) {
                provider = provider.provider;
            }

            if (isValueProvider(provider)) {
                transient = provider.transient === true;
                token = provider.provide;
                const valueVar = compiler.reserveVariable('useValue', provider.useValue);
                factory = `v = ${valueVar};`;
            } else if (isClassProvider(provider)) {
                transient = provider.transient === true;
                token = provider.provide;
                factory = this.createFactory(compiler, provider.useClass || provider.provide);
            } else if (isExistingProvider(provider)) {
                transient = provider.transient === true;
                token = provider.provide;
                factory = this.createFactory(compiler, provider.useExisting);
            } else if (isFactoryProvider(provider)) {
                transient = provider.transient === true;
                token = provider.provide;

                const deps: any[] = (provider.deps || []).map(v => `frontInjector.get(${compiler.reserveVariable('dep', v)}, frontInjector)`);
                factory = `v = ${compiler.reserveVariable('factory', provider.useFactory)}(${deps.join(', ')});`;
            } else if (isClass(provider)) {
                token = provider;
                factory = this.createFactory(compiler, provider);
            } else {
                throw new Error('Invalid provider');
            }

            if (tagToken) token = tagToken;

            const tokenVar = compiler.reserveVariable('token', token);
            const creatingVar = compiler.reserveVariable('creating', false);
            const configuredProviderCalls = this.configuredProviderRegistry?.get(token);

            const configureProvider: string[] = [];
            if (configuredProviderCalls) {
                for (const call of configuredProviderCalls) {
                    if (call.type === 'stop') break;
                    if (call.type === 'call') {
                        const args: string[] = [];
                        const methodName = 'symbol' === typeof call.methodName ? '[' + compiler.reserveVariable('arg', call.methodName) + ']' : call.methodName;
                        for (const arg of call.args) {
                            if (arg instanceof InjectorReference) {
                                args.push(`frontInjector.get(${compiler.reserveVariable('forward', arg.to)})`);
                            } else {
                                args.push(`${compiler.reserveVariable('arg', arg)}`);
                            }
                        }

                        configureProvider.push(`v.${methodName}(${args.join(', ')});`);
                    }
                    if (call.type === 'property') {
                        const property = 'symbol' === typeof call.property ? '[' + compiler.reserveVariable('property', call.property) + ']' : call.property;
                        const value = call.value instanceof InjectorReference ? `frontInjector.get(${compiler.reserveVariable('forward', call.value.to)})` : compiler.reserveVariable('value', call.value);
                        configureProvider.push(`v.${property} = ${value};`);
                    }
                }
            } else {
                configureProvider.push('//no custom provider setup');
            }

            resets.push(`${creatingVar} = false;`);

            lines.push(`
                //${tokenLabel(token)}
                case ${tokenVar}: {
                    ${transient ? 'let v;' : `let v = injector.resolved[${resolvedId}]; if (v !== undefined) return v;`}
                    CircularDetector.push(${tokenVar});
                    if (${creatingVar}) {
                        throwCircularDependency();
                    }
                    ${creatingVar} = true;
                    ${factory}
                    ${transient ? '' : `injector.resolved[${resolvedId}] = v;`}
                    ${creatingVar} = false;
                    ${configureProvider.join('\n')}
                    CircularDetector.pop();
                    return v;
                }
            `);
        }

        const parents: string[] = [];
        for (let i = 0; i < this.parents.length; i++) {
            let retriever = 'retriever' in this.parents[i] ? `injector.parents[${i}].retriever(injector.parents[${i}], ` : `injector.parents[${i}].get(`;
            parents.push(`
                {
                    const v = ${retriever}token, frontInjector);
                    if (v !== undefined) return v;
                }
            `);
        }

        compiler.context.set('CircularDetector', CircularDetector);
        compiler.context.set('throwCircularDependency', throwCircularDependency);
        compiler.context.set('CircularDetectorResets', CircularDetectorResets);
        compiler.context.set('constructorParameterNotFound', constructorParameterNotFound);
        compiler.context.set('propertyParameterNotFound', propertyParameterNotFound);

        compiler.preCode = `
            CircularDetectorResets.push(() => {
                ${resets.join('\n')};
            });
        `;

        return compiler.build(`
        frontInjector = frontInjector || injector;

        switch (token) {
            ${lines.join('\n')}
        }

        ${parents.join('\n')}

        return undefined;
        `, 'injector', 'token', 'frontInjector') as any;
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const v = this.retriever(this, token, frontInjector || this);
        if (v !== undefined) return v;

        for (const reset of CircularDetectorResets) reset();
        throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
    }
}

function constructorParameterNotFound(classType: ClassType, name: string, position: number, token: any) {
    const argsCheck: string[] = [];
    for (let i = 0; i < position - 1; i++) argsCheck.push('✓');
    argsCheck.push('?');

    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown constructor argument ${name} of ${getClassName(classType)}(${argsCheck.join(', ')}). Make sure '${tokenLabel(token)}' is provided.`
    );
}

function propertyParameterNotFound(classType: ClassType, name: string, position: number, token: any) {
    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown property parameter ${name} of ${getClassName(classType)}. Make sure '${tokenLabel(token)}' is provided.`
    );
}

function throwCircularDependency() {
    const path = CircularDetector.map(tokenLabel).join(' -> ');
    CircularDetector.length = 0;
    for (const reset of CircularDetectorResets) reset();
    throw new CircularDependencyError(`Circular dependency found ${path}`);
}

export class MemoryInjector extends Injector {
    constructor(protected providers: ({ provide: any, useValue: any } | { provide: any, useFactory: () => any })[]) {
        super();
    }

    fork(parents?: Injector[]): Injector {
        return this;
    }

    protected retriever(injector: Injector, token: any) {
        for (const p of this.providers) {
            if (p.provide === token) return 'useFactory' in p ? p.useFactory() : p.useValue;
        }
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const result = this.retriever(this, token);
        if (result === undefined) throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
        return result;
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
        public readonly module: InjectorModule,
        public readonly id: number,
        public readonly parent?: Context,
    ) {
    }
}

export type ConfiguredProviderCalls = {
        type: 'call', methodName: string | symbol | number, args: any[]
    }
    | { type: 'property', property: string | symbol | number, value: any }
    | { type: 'stop' }
    ;

export class ConfiguredProviderRegistry {
    public calls = new Map<any, ConfiguredProviderCalls[]>();

    public add(token: any, ...newCalls: ConfiguredProviderCalls[]) {
        this.get(token).push(...newCalls);
    }

    public get(token: any): ConfiguredProviderCalls[] {
        let calls = this.calls.get(token);
        if (!calls) {
            calls = [];
            this.calls.set(token, calls);
        }
        return calls;
    }

    clone(): ConfiguredProviderRegistry {
        const c = new ConfiguredProviderRegistry;
        for (const [token, calls] of this.calls.entries()) {
            c.calls.set(token, calls.slice());
        }
        return c;
    }
}

export type ConfigureProvider<T> = { [name in keyof T]: T[name] extends (...args: infer A) => any ? (...args: A) => ConfigureProvider<T> : T[name] };

/**
 * Returns a configuration object that reflects the API of the given ClassType or token. Each call
 * is scheduled and executed once the provider has been created by the dependency injection container.
 */
export function setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, registry: ConfiguredProviderRegistry): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
    const proxy = new Proxy({}, {
        get(target, prop) {
            return (...args: any[]) => {
                registry.add(classTypeOrToken, { type: 'call', methodName: prop, args: args });
                return proxy;
            };
        },
        set(target, prop, value) {
            registry.add(classTypeOrToken, { type: 'property', property: prop, value: value });
            return true;
        }
    });

    return proxy as any;
}

export class InjectorContext implements BasicInjector {
    protected injectors: (Injector | undefined)[] = new Array(this.contextManager.contexts.length);
    public readonly scopeCaches: ScopedContextScopeCaches;
    protected cache: ScopedContextCache;

    public static contextSymbol = Symbol('context');

    constructor(
        public readonly contextManager: ContextRegistry = new ContextRegistry,
        public readonly scope: string = 'module',
        public readonly configuredProviderRegistry: ConfiguredProviderRegistry = new ConfiguredProviderRegistry,
        public readonly parent: InjectorContext | undefined = undefined,
        public readonly additionalInjectorParent: Injector | undefined = undefined,
        public readonly modules: { [name: string]: InjectorModule } = {},
        scopeCaches?: ScopedContextScopeCaches,
        public tagRegistry: TagRegistry = new TagRegistry(),
    ) {
        this.scopeCaches = scopeCaches || new ScopedContextScopeCaches(this.contextManager.size);
        this.cache = this.scopeCaches.getCache(this.scope);
    }

    getModule(name: string): InjectorModule {
        if (!this.modules[name]) throw new Error(`No Module with name ${name} registered`);
        return this.modules[name];
    }

    registerModule(module: InjectorModule, config?: ConfigDefinition<any>) {
        if (this.modules[module.getName()]) throw new Error(`Module ${module.getName()} already registered`);

        if (config) config.setModule(module);
        this.modules[module.getName()] = module;

        for (const [provider, calls] of module.getConfiguredProviderRegistry().calls) {
            this.configuredProviderRegistry.add(provider, ...calls);
        }
    }

    /**
     * Returns a configuration object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider has been created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.configuredProviderRegistry);
    }

    getModuleNames(): string[] {
        return Object.keys(this.modules);
    }

    static forProviders(providers: ProviderWithScope[]) {
        const registry = new ContextRegistry();
        const context = new Context(new InjectorModule('', {}), 0);
        registry.set(0, context);
        context.providers.push(...providers);
        return new InjectorContext(registry);
    }

    public getInjector(contextId: number): Injector {
        let injector = this.injectors[contextId];
        if (injector) return injector;

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

        injector = new Injector(providers, parents, this, this.configuredProviderRegistry, this.tagRegistry);
        this.injectors[contextId] = injector;
        this.cache.set(contextId, injector);

        return injector;
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const context = typeof token === 'object' || typeof token === 'function' ? (token as any)[InjectorContext.contextSymbol] as Context : undefined;
        const injector = this.getInjector(context ? context.id : 0);
        return injector.get(token, frontInjector);
    }

    public createChildScope(scope: string, additionalInjectorParent?: Injector): InjectorContext {
        return new InjectorContext(this.contextManager, scope, this.configuredProviderRegistry, this, additionalInjectorParent, this.modules, this.scopeCaches, this.tagRegistry);
    }
}
