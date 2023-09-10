/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { test } from '@jest/globals';
import { AbstractClassType, arrayRemoveItem, ClassType, CompilerContext, CustomError, getClassName, isClass, isFunction, urlJoin } from '@deepkit/core';
import { isExtendable } from '../src/lib/reflection/extends.js';
import { ReceiveType, reflect, resolveReceiveType } from '../src/lib/reflection/reflection.js';
import { isType, metaAnnotation, ReflectionKind, Type } from '../src/lib/reflection/type.js';
import { IncomingMessage, ServerResponse } from 'http';
import { Writable } from 'stream';
import querystring from 'querystring';
import { entity } from '../src/lib/decorator.js';
import { SerializationOptions, Serializer } from '../src/lib/serializer.js';

export interface ProviderBase {
    /**
     * Per default all instances are singleton (scoped to its scope). Enabling transient makes the
     * Injector create always a new instance for every consumer.
     */
    transient?: true;
}

export type Token<T = any> = symbol | number | bigint | RegExp | boolean | string | InjectorToken<T> | AbstractClassType<T> | Type;

export function provide<T>(provider: Omit<ProviderProvide, 'provide'> | ClassType, type?: ReceiveType<T>): Provider {
    if (isClass(provider)) return { provide: resolveReceiveType(type), useClass: provider };
    return { ...provider, provide: resolveReceiveType(type) };
}

export interface ValueProvider<T> extends ProviderBase {
    /**
     * An injection token.
     */
    provide: Token<T>;

    /**
     * The value to inject.
     */
    useValue: T;
}

export interface ClassProvider<T> extends ProviderBase {
    /**
     * An injection token.
     */
    provide: Token<T>;

    /**
     * Class to instantiate for the `token`.
     */
    useClass?: ClassType<T>;
}

export interface ExistingProvider<T> extends ProviderBase {
    /**
     * An injection token.
     */
    provide: Token<T>;

    /**
     * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
     */
    useExisting: ClassType<T>;
}

export interface FactoryProvider<T> extends ProviderBase {
    /**
     * An injection token.
     */
    provide: Token<T>;

    /**
     * A function to invoke to create a value for this `token`. The function is invoked with
     * resolved values of `token`s in the `deps` field.
     */
    useFactory: (...args: any[]) => T;

    /**
     * A list of `token`s which need to be resolved by the injector. The list of values is then
     * used as arguments to the `useFactory` function.
     *
     * @deprecated not necessary anymore
     */
    deps?: any[];
}

export type Provider<T = any> = ClassType | ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T> | TagProvider<T>;

export type ProviderProvide<T = any> = ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T>;

interface TagRegistryEntry<T> {
    tagProvider: TagProvider<T>;
    module: InjectorModule;
}

export class TagRegistry {
    constructor(
        public tags: TagRegistryEntry<any>[] = []
    ) {
    }

    register(tagProvider: TagProvider<any>, module: InjectorModule) {
        return this.tags.push({ tagProvider, module });
    }

    resolve<T extends ClassType<Tag<any>>>(tag: T): TagRegistryEntry<InstanceType<T>>[] {
        return this.tags.filter(v => v.tagProvider.tag instanceof tag);
    }
}

export class TagProvider<T> {
    constructor(
        public provider: NormalizedProvider<T>,
        public tag: Tag<T>,
    ) {
    }
}

export class Tag<T, TP extends TagProvider<T> = TagProvider<T>> {
    _!: () => T;
    _2!: () => TP;

    constructor(
        public readonly services: T[] = []
    ) {
    }

    protected createTagProvider(provider: NormalizedProvider<any>): TP {
        return new TagProvider(provider, this) as TP;
    }

    static provide<P extends ClassType<T> | ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T>,
        T extends ReturnType<InstanceType<B>['_']>,
        TP extends ReturnType<InstanceType<B>['_2']>,
        B extends ClassType<Tag<any>>>(this: B, provider: P): TP {
        const t = new this;

        if (isClass(provider)) {
            return t.createTagProvider({ provide: provider }) as TP;
        }

        return t.createTagProvider(provider as NormalizedProvider<T>) as TP;
    }
}

export interface ProviderScope {
    scope?: 'module' | 'rpc' | 'http' | 'cli' | string;
}

export type NormalizedProvider<T = any> = ProviderProvide<T> & ProviderScope;

export type ProviderWithScope<T = any> = ClassType | (ProviderProvide<T> & ProviderScope) | TagProvider<any>;

export function isScopedProvider(obj: any): obj is ProviderProvide & ProviderScope {
    return obj.provide && obj.hasOwnProperty('scope');
}

export function isValueProvider(obj: any): obj is ValueProvider<any> {
    return obj.provide && obj.hasOwnProperty('useValue');
}

export function isClassProvider(obj: any): obj is ClassProvider<any> {
    return obj.provide && !isValueProvider(obj) && !isExistingProvider(obj) && !isFactoryProvider(obj);
}

export function isExistingProvider(obj: any): obj is ExistingProvider<any> {
    return obj.provide && obj.hasOwnProperty('useExisting');
}

export function isFactoryProvider(obj: any): obj is FactoryProvider<any> {
    return obj.provide && obj.hasOwnProperty('useFactory');
}

export function isInjectionProvider(obj: any): obj is Provider<any> {
    return isValueProvider(obj) || isClassProvider(obj) || isExistingProvider(obj) || isFactoryProvider(obj);
}

export function isTransient(provider: ProviderWithScope): boolean {
    if (isClass(provider)) return false;
    if (provider instanceof TagProvider) return false;
    return provider.transient === true;
}

export function getProviders(
    providers: ProviderWithScope[],
    requestScope: 'module' | 'session' | 'request' | string,
) {
    const result: Provider<any>[] = [];

    function normalize(provider: ProviderWithScope<any>): Provider<any> {
        if (isClass(provider)) {
            return provider;
        }

        return provider;
    }

    for (const provider of providers) {
        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        const scope = isScopedProvider(provider) ? provider.scope : 'module';
        if (scope === requestScope) {
            result.push(normalize(provider));
        }
    }

    return result;
}


export type ConfigureProvider<T> = { [name in keyof T]: T[name] extends (...args: infer A) => any ? (...args: A) => ConfigureProvider<T> : T[name] };

/**
 * Returns a configuration object that reflects the API of the given ClassType or token. Each call
 * is scheduled and executed once the provider has been created by the dependency injection container.
 */
export function setupProvider<T extends ClassType<T> | any>(classTypeOrToken: Token<T>, registry: SetupProviderRegistry, order: number): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
    const proxy = new Proxy({}, {
        get(target, prop) {
            return (...args: any[]) => {
                registry.add(classTypeOrToken, { type: 'call', methodName: prop, args: args, order });
                return proxy;
            };
        },
        set(target, prop, value) {
            registry.add(classTypeOrToken, { type: 'property', property: prop, value: value, order });
            return true;
        }
    });

    return proxy as any;
}

let moduleIds: number = 0;

export interface PreparedProvider {
    /**
     * The modules from which dependencies can be resolved. The first item is always the module from which this provider was declared.
     *
     * This is per default the module in which the provider was declared,
     * but if the provider was moved (by exporting), then if
     *   a) the parent had this provider already, then this array has additionally the one from which the provider was exported.
     *   b) the parent had no provider of that token, then this array is just the module from which the provider was exported.
     *
     * This is important otherwise exported provider won't have access in their dependencies to their original (encapsulated) injector.
     */
    modules: InjectorModule[];

    /**
     * A token can have multiple providers, for each scope its own entry.
     * Each scoped provider can only exist once.
     */
    providers: NormalizedProvider[];

    /**
     * When this provider was exported to another module and thus is actually instantiated in another module, then this is set.
     * This is necessary to tell the module who declared this provider to not instantiate it, but redirects resolve requests
     * to `resolveFrom` instead.
     */
    resolveFrom?: InjectorModule;
}

function registerPreparedProvider(map: Map<Token<any>, PreparedProvider>, modules: InjectorModule[], providers: NormalizedProvider[], replaceExistingScope: boolean = true) {
    const token = providers[0].provide;
    const preparedProvider = map.get(token);
    if (preparedProvider) {
        for (const m of modules) {
            if (preparedProvider.modules.includes(m)) continue;
            preparedProvider.modules.push(m);
        }
        for (const provider of providers) {
            const scope = getScope(provider);
            //check if given provider has a unknown scope, if so set it.
            //if the scope is known, overwrite it (we want always the last known provider to be valid)
            const knownProvider = preparedProvider.providers.findIndex(v => getScope(v) === scope);
            if (knownProvider === -1) {
                //scope not known, add it
                preparedProvider.providers.push(provider);
            } else if (replaceExistingScope) {
                //scope already known, replace it
                preparedProvider.providers.splice(knownProvider, 1, provider);
            }
        }
    } else {
        //just add it
        map.set(token, { modules, providers: providers.slice(0) });
    }
}

export function findModuleForConfig(config: ClassType, modules: InjectorModule[]): InjectorModule | undefined {
    for (const m of modules) {
        if (m.configDefinition === config) return m;
    }

    return undefined;
}

export type ExportType = Token | InjectorModule;

export function isProvided(providers: ProviderWithScope[], token: any): boolean {
    return providers.find(v => !(v instanceof TagProvider) ? token === (isClass(v) ? v : v.provide) : false) !== undefined;
}

export function getScope(provider: ProviderWithScope): string {
    return (isClass(provider) ? '' : provider instanceof TagProvider ? provider.provider.scope : provider.scope) || '';
}

export class InjectorModule<C extends { [name: string]: any } = any, IMPORT = InjectorModule<any, any>> {
    public id: number = moduleIds++;

    /**
     * Whether this module is for the root module. All its providers are automatically exported and moved to the root level.
     */
    public root: boolean = false;

    /**
     * The built injector. This is set once an Injector for this module has been created.
     */
    injector?: Injector;

    public setupProviderRegistry: SetupProviderRegistry = new SetupProviderRegistry;
    public globalSetupProviderRegistry: SetupProviderRegistry = new SetupProviderRegistry;

    imports: InjectorModule[] = [];

    /**
     * The first stage of building the injector is to resolve all providers and exports.
     * Then the actual injector functions can be built.
     */
    protected processed: boolean = false;

    protected exportsDisabled: boolean = false;

    public configDefinition?: ClassType;

    constructor(
        public providers: ProviderWithScope[] = [],
        public parent?: InjectorModule,
        public config: C = {} as C,
        public exports: ExportType[] = []
    ) {
        if (this.parent) this.parent.registerAsChildren(this);
    }

    registerAsChildren(child: InjectorModule): void {
        if (this.imports.includes(child)) return;
        this.imports.push(child);
    }

    /**
     * When the module exports providers the importer don't want to have then `disableExports` disable all exports.
     */
    disableExports(): this {
        this.exportsDisabled = true;
        return this;
    }

    /**
     * Makes all the providers, controllers, etc available at the root module, basically exporting everything.
     */
    forRoot(): this {
        this.root = true;
        return this;
    }

    /**
     * Reverts the root default setting to false.
     */
    notForRoot(): this {
        this.root = false;
        return this;
    }

    unregisterAsChildren(child: InjectorModule): void {
        if (!this.imports.includes(child)) return;
        child.parent = undefined;
        arrayRemoveItem(this.imports, child);
    }

    getChildren(): InjectorModule[] {
        return this.imports;
    }

    setConfigDefinition(config: ClassType): this {
        this.configDefinition = config;
        const configDefaults = new config;
        this.config = Object.assign(configDefaults, this.config);
        return this;
    }

    setParent(parent: InjectorModule): this {
        if (this.parent === parent) return this;
        this.assertInjectorNotBuilt();
        if (this.parent) this.parent.unregisterAsChildren(this);
        this.parent = parent;
        this.parent.registerAsChildren(this);
        return this;
    }

    getParent(): InjectorModule | undefined {
        return this.parent;
    }

    protected assertInjectorNotBuilt(): void {
        if (!this.injector) return;
        throw new Error(`Injector already built for ${getClassName(this)}. Can not modify its provider or tree structure.`);
    }

    addExport(...controller: ClassType[]): this {
        this.assertInjectorNotBuilt();
        this.exports.push(...controller);
        return this;
    }

    isExported(token: Token): boolean {
        return this.exports.includes(token);
    }

    isProvided(classType: ClassType): boolean {
        return isProvided(this.getProviders(), classType);
    }

    addProvider(...provider: ProviderWithScope[]): this {
        this.assertInjectorNotBuilt();
        this.providers.push(...provider);
        return this;
    }

    getProviders(): ProviderWithScope[] {
        return this.providers;
    }

    getConfig(): C {
        return this.config;
    }

    configure(config: Partial<C>): this {
        Object.assign(this.config, config);
        return this;
    }

    getImports(): InjectorModule[] {
        return this.imports;
    }

    getImportedModulesByClass<T extends InjectorModule>(classType: ClassType<T>): T[] {
        return this.getImports().filter(v => v instanceof classType) as T[];
    }

    getImportedModuleByClass<T extends InjectorModule>(classType: ClassType<T>): T {
        const v = this.getImports().find(v => v instanceof classType);
        if (!v) {
            throw new Error(`No module ${getClassName(classType)} in ${getClassName(this)}#${this.id} imported.`);
        }
        return v as T;
    }

    getImportedModule<T extends InjectorModule>(module: T): T {
        const v = this.getImports().find(v => v.id === module.id);
        if (!v) {
            throw new Error(`No module ${getClassName(module)}#${module.id} in ${getClassName(this)}#${this.id} imported.`);
        }
        return v as T;
    }

    getExports() {
        return this.exports;
    }

    hasImport<T extends InjectorModule>(moduleClass: ClassType<T>): boolean {
        for (const importModule of this.getImports()) {
            if (importModule instanceof moduleClass) return true;
        }
        return false;
    }

    /**
     * Adds a new import at the end.
     */
    addImport(...modules: InjectorModule<any>[]): this {
        this.assertInjectorNotBuilt();
        for (const module of modules) {
            module.setParent(this);
        }
        return this;
    }

    /**
     * Adds a new import at the beginning. Since import order matters, it might be useful to import a module first
     * so its exported providers can be overwritten by imports following this module.
     */
    addImportAtBeginning(...modules: InjectorModule<any>[]): this {
        this.assertInjectorNotBuilt();
        for (const module of modules) {
            module.parent = this;
            this.imports.unshift(module);
        }
        return this;
    }

    /**
     * Allows to register additional setup calls for a provider in this module.
     * The injector token needs to be available in the local module providers.
     * Use setupGlobalProvider to register globally setup calls (not limited to this module only).
     *
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: Token<T>, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.setupProviderRegistry, order);
    }

    /**
     * Allows to register additional setup calls for a provider in the whole module tree.
     * The injector token needs to be available in the local module providers.
     *
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupGlobalProvider<T extends ClassType<T> | any>(classTypeOrToken: Token<T>, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.globalSetupProviderRegistry, order);
    }

    getOrCreateInjector(buildContext: BuildContext): Injector {
        if (this.injector) return this.injector;

        //notify everyone we know to prepare providers
        if (this.parent) this.parent.getPreparedProviders(buildContext);
        this.getPreparedProviders(buildContext);

        //handle exports, from bottom to up
        if (this.parent) this.parent.handleExports(buildContext);
        this.handleExports(buildContext);

        //build the injector context
        if (this.parent) this.parent.getOrCreateInjector(buildContext);
        this.injector = new Injector(this, buildContext);
        for (const child of this.imports) child.getOrCreateInjector(buildContext);

        return this.injector;
    }

    protected preparedProviders?: Map<Token, PreparedProvider>;

    getPreparedProvider(token: Token): { token: Token, provider: PreparedProvider } | undefined {
        if (!this.preparedProviders) return;

        if (isType(token)) {
            let last = undefined as { token: Token, provider: PreparedProvider } | undefined;
            for (const [key, value] of this.preparedProviders.entries()) {
                if (isType(key) && isExtendable(key, token)) last = { token: key, provider: value };
            }
            if (last) return last;
        }

        const provider = this.preparedProviders.get(token);
        if (provider) return { token, provider };
        return;
    }

    resolveToken(token: Token): InjectorModule | undefined {
        const found = this.getPreparedProvider(token);
        if (found) return this;
        if (this.parent) return this.parent.resolveToken(token);
        return;
    }

    getBuiltPreparedProviders(): Map<any, PreparedProvider> | undefined {
        return this.preparedProviders;
    }

    /**
     * Prepared the module for a injector tree build.
     *
     *  - Index providers by token so that last known provider is picked (so they can be overwritten).
     *  - Register TagProvider in TagRegistry
     *  - Put TagProvider in providers if not already made.
     *  - Put exports to parent's module with the reference to this, so the dependencies are fetched from the correct module.
     */
    getPreparedProviders(buildContext: BuildContext): Map<any, PreparedProvider> {
        if (this.preparedProviders) return this.preparedProviders;

        for (const m of this.imports) {
            m.getPreparedProviders(buildContext);
        }

        this.preparedProviders = new Map<any, PreparedProvider>();

        this.globalSetupProviderRegistry.mergeInto(buildContext.globalSetupProviderRegistry);

        //make sure that providers that declare the same provider token will be filtered out so that the last will be used.
        for (const provider of this.providers) {
            if (provider instanceof TagProvider) {
                buildContext.tagRegistry.register(provider, this);

                if (!this.preparedProviders.has(provider.provider.provide)) {
                    //we dont want to overwrite that provider with a tag
                    registerPreparedProvider(this.preparedProviders, [this], [provider.provider]);
                }
            } else if (isClass(provider)) {
                registerPreparedProvider(this.preparedProviders, [this], [{ provide: provider }]);
            } else {
                registerPreparedProvider(this.preparedProviders, [this], [provider]);
            }
        }

        return this.preparedProviders;
    }

    protected exported: boolean = false;

    protected handleExports(buildContext: BuildContext) {
    }

    findRoot(): InjectorModule {
        if (this.parent) return this.parent.findRoot();
        return this;
    }
}


export class CircularDependencyError extends CustomError {
}

export class TokenNotFoundError extends CustomError {
}

export class DependenciesUnmetError extends CustomError {
}

export class InjectorReference {
    constructor(public readonly to: any, public module?: InjectorModule) {
    }
}

export function injectorReference<T>(classTypeOrToken: T, module?: InjectorModule): any {
    return new InjectorReference(classTypeOrToken, module);
}


/**
 * An injector token for tokens that have no unique class or interface.
 *
 * ```typescript
 *  export interface ServiceInterface {
 *      doIt(): void;
 *  }
 *  export const Service = new InjectorToken<ServiceInterface>('service');
 *
 *  {
 *      providers: [
 *          {provide: Service, useFactory() => ... },
 *      ]
 *  }
 *
 *  //user side
 *  const service = injector.get(Service);
 *  service.doIt();
 * ```
 */
export class InjectorToken<T> {
    type!: T;

    constructor(public readonly name: string) {
    }

    toString() {
        return 'InjectToken=' + this.name;
    }
}

export function tokenLabel(token: any): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (token instanceof TagProvider) return 'Tag(' + getClassName(token.provider.provide) + ')';
    if (isClass(token)) return getClassName(token);
    if (isFunction(token.toString)) return token.name;

    return token + '';
}

function constructorParameterNotFound(ofName: string, name: string, position: number, token: any) {
    const argsCheck: string[] = [];
    for (let i = 0; i < position; i++) argsCheck.push('✓');
    argsCheck.push('?');

    throw new DependenciesUnmetError(
        `Unknown constructor argument '${name}: ${tokenLabel(token)}' of ${ofName}(${argsCheck.join(', ')}). Make sure '${tokenLabel(token)}' is provided.`
    );
}

function tokenNotfoundError(token: any, moduleName: string) {
    throw new TokenNotFoundError(
        `Token '${tokenLabel(token)}' in ${moduleName} not found. Make sure '${tokenLabel(token)}' is provided.`
    );
}

function factoryDependencyNotFound(ofName: string, name: string, position: number, token: any) {
    const argsCheck: string[] = [];
    for (let i = 0; i < position; i++) argsCheck.push('✓');
    argsCheck.push('?');

    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown factory dependency argument '${tokenLabel(token)}' of ${ofName}(${argsCheck.join(', ')}). Make sure '${tokenLabel(token)}' is provided.`
    );
}

function propertyParameterNotFound(ofName: string, name: string, position: number, token: any) {
    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown property parameter ${name} of ${ofName}. Make sure '${tokenLabel(token)}' is provided.`
    );
}


let CircularDetector: any[] = [];
let CircularDetectorResets: (() => void)[] = [];

function throwCircularDependency() {
    const path = CircularDetector.map(tokenLabel).join(' -> ');
    CircularDetector.length = 0;
    for (const reset of CircularDetectorResets) reset();
    throw new CircularDependencyError(`Circular dependency found ${path}`);
}

export type SetupProviderCalls = {
        type: 'call', methodName: string | symbol | number, args: any[], order: number
    }
    | { type: 'property', property: string | symbol | number, value: any, order: number }
    | { type: 'stop', order: number }
    ;

export class SetupProviderRegistry {
    public calls = new Map<Token, SetupProviderCalls[]>();

    public add(token: any, ...newCalls: SetupProviderCalls[]) {
        this.get(token).push(...newCalls);
    }

    mergeInto(registry: SetupProviderRegistry): void {
        for (const [token, calls] of this.calls) {
            registry.add(token, ...calls);
        }
    }

    public get(token: Token): SetupProviderCalls[] {
        let calls = this.calls.get(token);
        if (!calls) {
            calls = [];
            this.calls.set(token, calls);
        }
        return calls;
    }
}

interface Scope {
    name: string;
    instances: { [name: string]: any };
}

export type ResolveToken<T> = T extends ClassType<infer R> ? R : T extends InjectorToken<infer R> ? R : T;

export function resolveToken(provider: ProviderWithScope): Token {
    if (isClass(provider)) return provider;
    if (provider instanceof TagProvider) return resolveToken(provider.provider);

    return provider.provide;
}

export interface InjectorInterface {
    get<T>(token: T, scope?: Scope): ResolveToken<T>;
}

/**
 * Returns the injector token type if the given type was decorated with `Inject<T>`.
 */
function getInjectOptions(type: Type): Type | undefined {
    const annotations = metaAnnotation.getAnnotations(type);
    for (const annotation of annotations) {
        if (annotation.name === 'inject') {
            const t = annotation.options[0] as Type;
            return t.kind !== ReflectionKind.never ? t : type;
        }
    }
    return;
}

/**
 * This is the actual dependency injection container.
 * Every module has its own injector.
 */
export class Injector implements InjectorInterface {
    private resolver?: (token: any, scope?: Scope) => any;
    private setter?: (token: any, value: any, scope?: Scope) => any;
    private instantiations?: (token: any, scope?: string) => number;

    /**
     * All unscoped provider instances. Scoped instances are attached to `Scope`.
     */
    private instances: { [name: string]: any } = {};
    private instantiated: { [name: string]: number } = {};

    constructor(
        public readonly module: InjectorModule,
        private buildContext: BuildContext,
    ) {
        module.injector = this;
        this.build(buildContext);
    }

    static from(providers: ProviderWithScope[], parent?: Injector): Injector {
        return new Injector(new InjectorModule(providers, parent?.module), new BuildContext);
    }

    static fromModule(module: InjectorModule, parent?: Injector): Injector {
        return new Injector(module, new BuildContext);
    }

    get<T>(token: T, scope?: Scope): ResolveToken<T> {
        if (!this.resolver) throw new Error('Injector was not built');
        return this.resolver(token, scope);
    }

    set<T>(token: T, value: any, scope?: Scope): void {
        if (!this.setter) throw new Error('Injector was not built');
        this.setter(token, value, scope);
    }

    instantiationCount<T>(token: any, scope?: string): number {
        if (!this.instantiations) throw new Error('Injector was not built');
        return this.instantiations(token, scope);
    }

    clear() {
        this.instances = {};
    }

    protected build(buildContext: BuildContext): void {
    }

    protected buildProvider(
        buildContext: BuildContext,
        compiler: CompilerContext,
        name: string,
        accessor: string,
        scope: string,
        provider: NormalizedProvider,
        resolveDependenciesFrom: InjectorModule[],
    ) {
        return ``;
    }

    protected createFactory(
        provider: NormalizedProvider,
        resolvedName: string,
        compiler: CompilerContext,
        classType: ClassType,
        resolveDependenciesFrom: InjectorModule[]
    ): { code: string, dependencies: number } {
        return {
            code: ``,
            dependencies: 0
        };
    }

    protected createFactoryProperty(
        options: { name: string, type: Type, optional: boolean },
        fromProvider: NormalizedProvider,
        compiler: CompilerContext,
        resolveDependenciesFrom: InjectorModule[],
        ofName: string,
        argPosition: number,
        notFoundFunction: string
    ): string {
        return '';
    }
}

class BuildProviderIndex {
    protected offset: number = 0;

    reserve(): number {
        return this.offset++;
    }
}

export class BuildContext {
    static ids: number = 0;
    public id: number = BuildContext.ids++;
    tagRegistry: TagRegistry = new TagRegistry;
    providerIndex: BuildProviderIndex = new BuildProviderIndex;

    /**
     * In the process of preparing providers, each module redirects their
     * global setup calls in this registry.
     */
    globalSetupProviderRegistry: SetupProviderRegistry = new SetupProviderRegistry;
}

/**
 * A InjectorContext is responsible for taking a root InjectorModule and build all Injectors.
 *
 * It also can create scopes aka a sub InjectorContext with providers from a particular scope.
 */
export class InjectorContext {
    constructor(
        public rootModule: InjectorModule,
        public readonly scope?: Scope,
        protected buildContext: BuildContext = new BuildContext,
    ) {
    }

    get<T>(token: T | Token, module?: InjectorModule): ResolveToken<T> {
        return this.getInjector(module || this.rootModule).get(token, this.scope) as ResolveToken<T>;
    }

    instantiationCount(token: Token, module?: InjectorModule, scope?: string): number {
        return this.getInjector(module || this.rootModule).instantiationCount(token, this.scope ? this.scope.name : scope);
    }

    set<T>(token: T, value: any, module?: InjectorModule): void {
        return this.getInjector(module || this.rootModule).set(token, value, this.scope);
    }

    static forProviders(providers: ProviderWithScope[]) {
        return new InjectorContext(new InjectorModule(providers));
    }

    /**
     * Returns the unscoped injector. Use `.get(T, Scope)` for resolving scoped token.
     */
    getInjector(module: InjectorModule): Injector {
        return module.getOrCreateInjector(this.buildContext);
    }

    getRootInjector(): Injector {
        return this.getInjector(this.rootModule);
    }

    public createChildScope(scope: string): InjectorContext {
        return new InjectorContext(this.rootModule, { name: scope, instances: {} }, this.buildContext);
    }
}

@entity.name('@deepkit/UploadedFile')
export class UploadedFile {
    /**
     * The size of the uploaded file in bytes.
     */
    size!: number;

    /**
     * The path this file is being written to.
     */
    path!: string;

    /**
     * The name this file had according to the uploading client.
     */
    name!: string | null;

    /**
     * The mime type of this file, according to the uploading client.
     */
    type!: string | null;

    /**
     * A Date object (or `null`) containing the time this file was last written to.
     * Mostly here for compatibility with the [W3C File API Draft](http://dev.w3.org/2006/webapi/FileAPI/).
     */
    lastModifiedDate!: Date | null;

    // /**
    //  * If `options.hash` calculation was set, you can read the hex digest out of this var.
    //  */
    // hash!: string | 'sha1' | 'md5' | 'sha256' | null;
}

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

export type HttpRequestQuery = { [name: string]: string };
export type HttpRequestResolvedParameters = { [name: string]: any };

export type HttpBody<T> = T & { __meta?: ['httpBody'] };
export type HttpQuery<T, Options extends {name?: string} = {}> = T & { __meta?: ['httpQuery', Options] };
export type HttpQueries<T, Options extends {name?: string} = {}> = T & { __meta?: ['httpQueries', Options] };

export class RequestBuilder {
    protected contentBuffer: Buffer = Buffer.alloc(0);
    protected _headers: { [name: string]: string } = {};
    protected queryPath?: string;

    constructor(
        protected path: string,
        protected method: string = 'GET',
    ) {
    }

    getUrl() {
        if (this.queryPath) {
            return this.path + '?' + this.queryPath;
        }
        return this.path;
    }

    build(): HttpRequest {
        const headers = this._headers;
        const method = this.method;
        const url = this.getUrl();
        const bodyContent = this.contentBuffer;

        const writable = new Writable({
            write(chunk, encoding, callback) {
                -
                    callback();
            },
            writev(chunks, callback) {
                callback();
            }
        });
        const request = new (class extends HttpRequest {
            url = url;
            method = method;
            position = 0;

            headers = headers;

            done = false;

            _read(size: number) {
                if (!this.done) {
                    this.push(bodyContent);
                    process.nextTick(() => {
                        this.emit('end');
                    });
                    this.done = true;
                }
            }
        })(writable as any);
        return request;
    }

    headers(headers: { [name: string]: string }): this {
        this._headers = headers;
        return this;
    }

    header(name: string, value: string | number): this {
        this._headers[name] = String(value);
        return this;
    }

    json(body: object): this {
        this.contentBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        this._headers['content-type'] = 'application/json; charset=utf-8';
        this._headers['content-length'] = String(this.contentBuffer.byteLength);
        return this;
    }

    body(body: string | Buffer): this {
        if ('string' === typeof body) {
            this.contentBuffer = Buffer.from(body, 'utf8');
        } else {
            this.contentBuffer = body;
        }
        this._headers['content-length'] = String(this.contentBuffer.byteLength);
        return this;
    }

    query(query: any): this {
        this.queryPath = querystring.stringify(query);
        return this;
    }
}

export class HttpRequest extends IncomingMessage {
    /**
     * A store that can be used to transport data from guards/listeners to ParameterResolvers/controllers.
     */
    public store: { [name: string]: any } = {};

    public uploadedFiles: { [name: string]: UploadedFile } = {};

    static GET(path: string): RequestBuilder {
        return new RequestBuilder(path);
    }

    static POST(path: string): RequestBuilder {
        return new RequestBuilder(path, 'POST');
    }

    static OPTIONS(path: string): RequestBuilder {
        return new RequestBuilder(path, 'OPTIONS');
    }

    static TRACE(path: string): RequestBuilder {
        return new RequestBuilder(path, 'TRACE');
    }

    static HEAD(path: string): RequestBuilder {
        return new RequestBuilder(path, 'HEAD');
    }

    static PATCH(path: string): RequestBuilder {
        return new RequestBuilder(path, 'PATCH');
    }

    static PUT(path: string): RequestBuilder {
        return new RequestBuilder(path, 'PUT');
    }

    static DELETE(path: string): RequestBuilder {
        return new RequestBuilder(path, 'DELETE');
    }

    getUrl(): string {
        return this.url || '/';
    }

    getMethod(): string {
        return this.method || 'GET';
    }

    getRemoteAddress(): string {
        return this.socket.remoteAddress || '';
    }
}

export type RouteParameterResolverForInjector = ((injector: InjectorContext) => any[] | Promise<any[]>);

export interface RouteControllerAction {
    //if not set, the root module is used
    module?: InjectorModule<any>;
    controller: ClassType;
    methodName: string;
}

export type HttpMiddlewareFn = (req: HttpRequest, res: HttpResponse, next: (err?: any) => void) => void | Promise<void>;

export interface HttpMiddleware {
    execute: HttpMiddlewareFn;
}

export interface HttpMiddlewareRoute {
    path?: string;
    pathRegExp?: RegExp;
    httpMethod?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE';
    category?: string;
    excludeCategory?: string;
    group?: string;
    excludeGroup?: string;
}

export class HttpMiddlewareConfig {
    name?: string;
    middlewares: (HttpMiddlewareFn | ClassType<HttpMiddleware>)[] = [];

    routes: HttpMiddlewareRoute[] = [];
    excludeRoutes: HttpMiddlewareRoute[] = [];

    order: number = 0;

    controllers: ClassType[] = [];
    excludeControllers: ClassType[] = [];

    routeNames: string[] = [];
    excludeRouteNames: string[] = [];

    timeout: number = 4_000;

    modules: InjectorModule<any>[] = [];

    selfModule: boolean = false;

    getClassTypes(): ClassType[] {
        const classTypes: ClassType[] = [];
        for (const middleware of this.middlewares) {
            if (isClass(middleware)) classTypes.push(middleware);
        }

        return classTypes;
    }
}

export interface RouteParameterConfig {
    type?: 'body' | 'query' | 'queries';
    /**
     * undefined = propertyName, '' === root, else given path
     */
    typePath?: string;

    optional: boolean;
    name: string;
}

export class RouteConfig {
    public baseUrl: string = '';
    public parameterRegularExpressions: { [name: string]: any } = {};

    public responses: { statusCode: number, description: string, type?: Type }[] = [];

    public description: string = '';
    public groups: string[] = [];
    public category: string = '';

    /**
     * This is set when the route action has a manual return type defined using @t.
     */
    public returnType?: Type;

    public serializationOptions?: SerializationOptions;
    public serializer?: Serializer;

    /**
     * When assigned defines where this route came from.
     */
    public module?: InjectorModule<any>;

    resolverForToken: Map<any, ClassType> = new Map();

    middlewares: { config: HttpMiddlewareConfig, module: InjectorModule<any> }[] = [];

    resolverForParameterName: Map<string, ClassType> = new Map();

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    public parameters: {
        [name: string]: RouteParameterConfig
    } = {};

    constructor(
        public readonly name: string,
        public readonly httpMethods: string[],
        public readonly path: string,
        public readonly action: RouteControllerAction,
        public internal: boolean = false,
    ) {
    }

    getSchemaForResponse(statusCode: number): Type | undefined {
        if (!this.responses.length) return;
        for (const response of this.responses) {
            if (response.statusCode === statusCode) return response.type;
        }
        return;
    }

    getFullPath(): string {
        let path = this.baseUrl ? urlJoin(this.baseUrl, this.path) : this.path;
        if (!path.startsWith('/')) path = '/' + path;
        return path;
    }
}

interface ResolvedController {
    parameters: RouteParameterResolverForInjector;
    routeConfig: RouteConfig;
    uploadedFiles: { [name: string]: UploadedFile };
    middlewares?: (injector: InjectorContext) => { fn: HttpMiddlewareFn, timeout: number }[];
}

export class HttpControllers {
    constructor(public readonly controllers: {controller: ClassType, module: InjectorModule<any>}[] = []) {
    }

    public add(controller: ClassType, module: InjectorModule<any>) {
        this.controllers.push({controller, module});
    }
}

export interface MiddlewareConfig {
    getClassTypes(): ClassType[];
}

export type MiddlewareRegistryEntry = { config: MiddlewareConfig, module: InjectorModule<any> };

export class MiddlewareRegistry {
    public readonly configs: MiddlewareRegistryEntry[] = [];
}

export class Router {
    protected fn?: (request: HttpRequest) => ResolvedController | undefined;
    protected resolveFn?: (name: string, parameters: { [name: string]: any }) => string;

    protected routes: RouteConfig[] = [];

    constructor(
        controllers: HttpControllers,
        // private logger: Logger,
        tagRegistry: TagRegistry,
        private middlewareRegistry: MiddlewareRegistry = new MiddlewareRegistry,
    ) {
    }

    getRoutes(): RouteConfig[] {
        return this.routes;
    }

    protected getRouteCode(compiler: CompilerContext, routeConfig: RouteConfig): string {
        return '';
    }

    protected getRouteUrlResolveCode(compiler: CompilerContext, routeConfig: RouteConfig): string {
        return '';
    }

    public addRoute(routeConfig: RouteConfig) {
    }

    public addRouteForController(controller: ClassType, module: InjectorModule<any>) {
    }

    protected buildUrlResolver(): any {
    }

    public resolveUrl(routeName: string, parameters: { [name: string]: any } = {}): string {
        return '';
    }

    public resolveRequest(request: HttpRequest): ResolvedController | undefined {
        return;
    }

    public resolve(method: string, url: string): ResolvedController | undefined {
        method = method.toUpperCase();
        return this.resolveRequest({ url, method } as any);
    }
}
//
// test('TagRegistry', () => {
//     const start = Date.now();
//     const type = reflect(TagRegistry);
//     console.log('TagRegistry took', Date.now() - start);
// });
//
// test('InjectorModule', () => {
//     const start = Date.now();
//     const type = reflect(InjectorModule);
//     console.log('InjectorModule took', Date.now() - start);
// });

test('Router', () => {
    const start = Date.now();
    const type = reflect(Router);
    console.log('Router took', Date.now() - start);
});

// test('Injector', () => {
//     const start = Date.now();
//     const type = reflect(Injector);
//     console.log('Injector took', Date.now() - start);
// });
