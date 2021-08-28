import { isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, NormalizedProvider, ProviderWithScope, Tag, TagProvider, TagRegistry } from './provider';
import { arrayRemoveItem, ClassType, CompilerContext, CustomError, getClassName, isClass, isFunction, isPrototypeOfBase } from '@deepkit/core';
import { getClassSchema, isFieldDecorator, PropertySchema } from '@deepkit/type';
import { InjectOptions, InjectorReference, InjectorToken, isInjectDecorator } from './decorator';
import { ConfigDefinition, ConfigSlice, ConfigToken } from './config';


export type ConfigureProvider<T> = { [name in keyof T]: T[name] extends (...args: infer A) => any ? (...args: A) => ConfigureProvider<T> : T[name] };

/**
 * Returns a configuration object that reflects the API of the given ClassType or token. Each call
 * is scheduled and executed once the provider has been created by the dependency injection container.
 */
export function setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, registry: SetupProviderRegistry, order: number): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
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

interface PreparedProvider {
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

function registerPreparedProvider(map: Map<any, PreparedProvider>, modules: InjectorModule[], providers: NormalizedProvider[]) {
    const token = providers[0].provide;
    const preparedProvider = map.get(token);
    if (preparedProvider) {
        for (const provider of providers) {
            const scope = getScope(provider);
            //check if given provider has a unknown scope, if so set it.
            //if the scope is known, overwrite it (we want always the last known provider to be valid)
            const knownProvider = preparedProvider.providers.findIndex(v => getScope(v) === scope);
            if (knownProvider === -1) {
                //scope not known, add it
                preparedProvider.providers.push(provider);
            } else {
                //scope already known, replace it
                preparedProvider.providers.splice(knownProvider, 1, provider);
            }
        }
    } else {
        //just add it
        map.set(token, { modules, providers: providers.slice(0) });
    }
}

function findModuleForConfig(config: ConfigDefinition<any>, modules: InjectorModule[]): InjectorModule {
    for (const m of modules) {
        if (m.configDefinition === config) return m;
    }

    throw new Error(`No module found for configuration ${config.schema.toString()}. Did you attach it to a module?`);
}

export type ExportType = ClassType | InjectorToken<any> | string | InjectorModule;

export function isProvided(providers: ProviderWithScope[], token: any): boolean {
    return providers.find(v => !(v instanceof TagProvider) ? token === (isClass(v) ? v : v.provide) : false) !== undefined;
}

export class InjectorModule<C extends { [name: string]: any } = any> {
    public id: number = moduleIds++;

    /**
     * Whether this module is for the root module. All its providers are automatically exported and moved to the root level.
     */
    public root: boolean = false;

    /**
     * The built injector. This is set once a Injector for this module has been created.
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

    public configDefinition?: ConfigDefinition<any>;

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

    setConfigDefinition(config: ConfigDefinition<any>): this {
        this.configDefinition = config;
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

    /**
     * Allows to register additional setup calls for a provider in this module.
     * The injector token needs to be available in the local module providers.
     * Use setupGlobalProvider to register globally setup calls (not limited to this module only).
     *
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.setupProviderRegistry, order);
    }

    /**
     * Allows to register additional setup calls for a provider in the whole module tree.
     * The injector token needs to be available in the local module providers.
     *
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupGlobalProvider<T extends ClassType<T> | any>(classTypeOrToken: T, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
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

    protected preparedProviders?: Map<any, PreparedProvider>;

    getPreparedProvider(token: any): PreparedProvider | undefined {
        if (!this.preparedProviders) return;
        return this.preparedProviders.get(token);
    }

    resolveToken(token: any): InjectorModule | undefined {
        if (!this.preparedProviders) return;
        if (this.preparedProviders.has(token)) return this;
        if (this.parent) return this.parent.resolveToken(token);
        return;
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
        if (this.exported) return;
        this.exported = true;

        //the import order is important. the last entry is the most important and should be able to overwrite
        //previous modules. In order to make that work, we call handleExports in reversed order.
        //this lets providers from the last import register their provider first, and make them available first
        //in the injector (which equals to be resolved first).
        for (let i = this.imports.length - 1; i >= 0; i--) {
            this.imports[i].setParent(this);
            this.imports[i].handleExports(buildContext);
        }
        // for (const m of this.imports) {
        //     m.setParent(this);
        //     m.handleExports(buildContext);
        // }

        if (!this.preparedProviders) return;
        if (!this.parent) return;
        if (this.exportsDisabled) return;

        const exportToken = (token: any, to: InjectorModule) => {
            if (!this.preparedProviders) return;
            const preparedProvider = this.preparedProviders.get(token);
            //if it was not in provider, we continue
            if (!preparedProvider) return;

            //mark this provider as redirect to `exportTo`
            preparedProvider.resolveFrom = to;

            const parentProviders = to.getPreparedProviders(buildContext);
            const parentProvider = parentProviders.get(token);
            //if the parent has this token already defined, we just switch its module to ours,
            //so its able to inject our encapsulated services.
            if (parentProvider) {
                //we add our module as additional source for potential dependencies
                parentProvider.modules.push(this);
            } else {
                parentProviders.set(token, { modules: [this], providers: preparedProvider.providers.slice() });
            }
        };

        if (this.root) {
            const root = this.findRoot();
            if (root !== this) {
                for (const token of this.preparedProviders.keys()) {
                    exportToken(token, root);
                }
            }
        } else {
            for (const entry of this.exports) {
                if ((isClass(entry) && isPrototypeOfBase(entry, InjectorModule)) || entry instanceof InjectorModule) {
                    const moduleInstance = isClass(entry) ? this.imports.find(v => v instanceof entry) : entry;
                    if (!moduleInstance) {
                        throw new Error(`Unknown module ${getClassName(entry)} exported from ${getClassName(this)}. The module was never imported.`);
                    }

                    //export everything to the parent that we received from that `entry` module
                    for (const [token, preparedProvider] of this.preparedProviders.entries()) {
                        if (preparedProvider.modules.includes(moduleInstance)) {
                            //this provider was received from `entry`

                            //mark this provider as redirect to `exportTo`
                            preparedProvider.resolveFrom = this.parent;

                            const parentProviders = this.parent.getPreparedProviders(buildContext);
                            const parentProvider = parentProviders.get(token);
                            //if the parent has this token already defined, we just switch its module to ours,
                            //so its able to inject our encapsulated services.
                            if (parentProvider) {
                                //we add our module as additional source for potential dependencies
                                parentProvider.modules.push(this);
                            } else {
                                parentProviders.set(token, { modules: [this, ...preparedProvider.modules], providers: preparedProvider.providers.slice() });
                            }
                        }
                    }
                } else {
                    //export single token
                    exportToken(entry, this.parent);
                }
            }
        }
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

export function tokenLabel(token: any): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (token instanceof TagProvider) return 'Tag(' + getClassName(token.provider.provide) + ')';
    if (isClass(token)) return getClassName(token);
    if (isFunction(token.toString)) return token.toString();

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
    public calls = new Map<any, SetupProviderCalls[]>();

    public add(token: any, ...newCalls: SetupProviderCalls[]) {
        this.get(token).push(...newCalls);
    }

    mergeInto(registry: SetupProviderRegistry): void {
        for (const [token, calls] of this.calls) {
            registry.add(token, ...calls);
        }
    }

    public get(token: any): SetupProviderCalls[] {
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

function getScope(provider: ProviderWithScope): string {
    return (isClass(provider) ? '' : provider instanceof TagProvider ? provider.provider.scope : provider.scope) || '';
}

export type ResolveToken<T> = T extends ClassType<infer R> ? R : T extends InjectorToken<infer R> ? R : T;

export interface InjectorInterface {
    get<T>(token: T, scope?: Scope): ResolveToken<T>;
}

/**
 * This is the actual dependency injection container.
 * Every module has its own injector.
 */
export class Injector implements InjectorInterface {
    private resolver?: (token: any, scope?: Scope) => any;
    private setter?: (token: any, value: any, scope?: Scope) => any;

    /**
     * All unscoped provider instances. Scoped instances are attached to `Scope`.
     */
    private instances: { [name: string]: any } = {};

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

    clear() {
        this.instances = {};
    }

    protected build(buildContext: BuildContext): void {
        const resolverCompiler = new CompilerContext();
        resolverCompiler.context.set('CircularDetector', CircularDetector);
        resolverCompiler.context.set('CircularDetectorResets', CircularDetectorResets);
        resolverCompiler.context.set('throwCircularDependency', throwCircularDependency);
        resolverCompiler.context.set('tokenNotfoundError', tokenNotfoundError);
        resolverCompiler.context.set('injector', this);

        const lines: string[] = [];
        const resets: string[] = [];
        const creating: string[] = [];

        const setterCompiler = new CompilerContext();
        setterCompiler.context.set('injector', this);
        const setterLines: string[] = [];

        for (const [token, prepared] of this.module.getPreparedProviders(buildContext).entries()) {
            //scopes will be created first, so they are returned instead of the unscoped instance
            prepared.providers.sort((a, b) => {
                if (a.scope && !b.scope) return -1;
                if (!a.scope && b.scope) return +1;
                return 0;
            });

            for (const provider of prepared.providers) {
                const scope = getScope(provider);
                const name = 'i' + this.buildContext.providerIndex.reserve();
                creating.push(`let creating_${name} = false;`);
                resets.push(`creating_${name} = false;`);
                const accessor = scope ? 'scope.instances.' + name : 'injector.instances.' + name;

                setterLines.push(`case ${setterCompiler.reserveVariable('token', token)}: {
                    ${accessor} = value;
                    break;
                }`);

                if (prepared.resolveFrom) {
                    //its a redirect
                    lines.push(`
                    case token === ${resolverCompiler.reserveConst(token)}: {
                        return ${resolverCompiler.reserveConst(prepared.resolveFrom)}.injector.resolver(${resolverCompiler.reserveConst(token)}, scope);
                    }
                `);

                } else {
                    //we own and instantiate the service
                    lines.push(this.buildProvider(buildContext, resolverCompiler, name, accessor, scope, provider, prepared.modules));
                }
            }
        }

        const setter = setterCompiler.build(`
            switch (token) {
                ${setterLines.join('\n')}
            }
        `, 'token', 'value', 'scope');

        const resolver = resolverCompiler.raw(`
            ${creating.join('\n')};

            CircularDetectorResets.push(() => {
                ${resets.join('\n')};
            });

            return function(token, scope) {
                switch (true) {
                    ${lines.join('\n')}
                }

                tokenNotfoundError(token, '${getClassName(this.module)}');
            }
        `) as any;

        this.setter = setter;
        this.resolver = resolver;
    }

    protected resolveSetupProviderCalls(token: any): SetupProviderCalls[] {
        //todo: if token is exported, use also the provider calls from the origin module

        return this.module.setupProviderRegistry.get(token) || [];
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
        let transient = false;
        const token = provider.provide;
        let factory: { code: string, dependencies: number } = { code: '', dependencies: 0 };
        const tokenVar = compiler.reserveConst(token);

        if (isValueProvider(provider)) {
            transient = provider.transient === true;
            const valueVar = compiler.reserveVariable('useValue', provider.useValue);
            factory.code = `${accessor} = ${valueVar};`;
        } else if (isClassProvider(provider)) {
            transient = provider.transient === true;

            let useClass = provider.useClass;
            if (!useClass) {
                if (!isClass(provider.provide)) {
                    throw new Error(`UseClassProvider needs to set either 'useClass' or 'provide' as a ClassType. Got ${provider.provide as any}`);
                }
                useClass = provider.provide;
            }
            factory = this.createFactory(provider, accessor, compiler, useClass, resolveDependenciesFrom);
        } else if (isExistingProvider(provider)) {
            transient = provider.transient === true;
            factory.code = `${accessor} = injector.resolver(${compiler.reserveConst(provider.useExisting)}, scope)`;
        } else if (isFactoryProvider(provider)) {
            transient = provider.transient === true;

            const args: string[] = [];
            let i = 0;
            for (const dep of provider.deps || []) {
                let optional = false;
                let token = dep;

                if (isInjectDecorator(dep)) {
                    optional = dep.options.optional;
                    token = dep.options.token;
                }

                if (isFieldDecorator(dep)) {
                    const propertySchema = dep.buildPropertySchema();
                    optional = propertySchema.isOptional;
                    if (propertySchema.type === 'literal' || propertySchema.type === 'class') {
                        token = propertySchema.literalValue !== undefined ? propertySchema.literalValue : propertySchema.getResolvedClassType();
                    }
                }

                if (!token) {
                    throw new Error(`No token defined for dependency ${i} in 'deps' of useFactory for ${tokenLabel(provider.provide)}`);
                }

                factory.dependencies++;
                args.push(this.createFactoryProperty({
                    name: i++,
                    token,
                    optional,
                }, provider, compiler, resolveDependenciesFrom, 'useFactory', args.length, 'factoryDependencyNotFound'));
            }

            factory.code = `${accessor} = ${compiler.reserveVariable('factory', provider.useFactory)}(${args.join(', ')});`;
        } else {
            throw new Error('Invalid provider');
        }

        const configureProvider: string[] = [];
        const configuredProviderCalls = resolveDependenciesFrom[0].setupProviderRegistry?.get(token);
        configuredProviderCalls.push(...buildContext.globalSetupProviderRegistry.get(token));

        if (configuredProviderCalls) {
            configuredProviderCalls.sort((a, b) => {
                return a.order - b.order;
            });

            for (const call of configuredProviderCalls) {
                if (call.type === 'stop') break;
                if (call.type === 'call') {
                    const args: string[] = [];
                    const methodName = 'symbol' === typeof call.methodName ? '[' + compiler.reserveVariable('arg', call.methodName) + ']' : call.methodName;
                    for (const arg of call.args) {
                        if (arg instanceof InjectorReference) {
                            //todo: find the reference in the tree
                            const injector = arg.module ? compiler.reserveConst(arg.module) + '.injector' : 'injector';
                            args.push(`${injector}.resolver(${compiler.reserveVariable('forward', arg.to)}, scope)`);
                        } else {
                            args.push(`${compiler.reserveVariable('arg', arg)}`);
                        }
                    }

                    configureProvider.push(`${accessor}.${methodName}(${args.join(', ')});`);
                }
                if (call.type === 'property') {
                    const property = 'symbol' === typeof call.property ? '[' + compiler.reserveVariable('property', call.property) + ']' : call.property;
                    const value = call.value instanceof InjectorReference ? `frontInjector.get(${compiler.reserveVariable('forward', call.value.to)})` : compiler.reserveVariable('value', call.value);
                    configureProvider.push(`${accessor}.${property} = ${value};`);
                }
            }
        } else {
            configureProvider.push('//no custom provider setup');
        }

        const scopeCheck = scope ? ` && scope && scope.name === ${JSON.stringify(scope)}` : '';

        //circular dependencies can happen, when for example a service with InjectorContext injected manually instantiates a service.
        //if that service references back to the first one, it will be a circular loop. So we track that with `creating` state.
        const creatingVar = `creating_${name}`;
        const circularDependencyCheckStart = factory.dependencies ? `if (${creatingVar}) throwCircularDependency();${creatingVar} = true;` : '';
        const circularDependencyCheckEnd = factory.dependencies ? `${creatingVar} = false;` : '';

        return `
            //${tokenLabel(token)}
            case token === ${tokenVar}${scopeCheck}: {
                ${!transient ? `if (${accessor} !== undefined) return ${accessor};` : ''}
                CircularDetector.push(${tokenVar});
                ${circularDependencyCheckStart}
                ${factory.code}
                ${circularDependencyCheckEnd}
                CircularDetector.pop();
                ${configureProvider.join('\n')}
                return ${accessor};
            }
        `;
    }

    protected createFactory(
        provider: NormalizedProvider,
        resolvedName: string,
        compiler: CompilerContext,
        classType: ClassType,
        resolveDependenciesFrom: InjectorModule[]
    ): { code: string, dependencies: number } {
        if (!classType) throw new Error('Can not create factory for undefined ClassType');
        const schema = getClassSchema(classType);
        const args: string[] = [];
        const propertyAssignment: string[] = [];
        const classTypeVar = compiler.reserveVariable('classType', classType);

        let dependencies: number = 0;

        for (const property of schema.getMethodProperties('constructor')) {
            if (!property) {
                throw new Error(`Constructor arguments hole in ${getClassName(classType)}`);
            }
            dependencies++;
            args.push(this.createFactoryProperty(this.optionsFromProperty(property), provider, compiler, resolveDependenciesFrom, getClassName(classType), args.length, 'constructorParameterNotFound'));
        }

        for (const property of schema.getProperties()) {
            if (!('deepkit/inject' in property.data)) continue;
            if (property.methodName === 'constructor') continue;
            dependencies++;
            try {
                const resolveProperty = this.createFactoryProperty(this.optionsFromProperty(property), provider, compiler, resolveDependenciesFrom, getClassName(classType), -1, 'propertyParameterNotFound');
                propertyAssignment.push(`${resolvedName}.${property.name} = ${resolveProperty};`);
            } catch (error) {
                throw new Error(`Could not resolve property injection token ${getClassName(classType)}.${property.name}: ${error.message}`);
            }
        }

        return {
            code: `${resolvedName} = new ${classTypeVar}(${args.join(',')});\n${propertyAssignment.join('\n')}`,
            dependencies
        };
    }

    protected createFactoryProperty(
        options: { name: string | number, token: any, optional: boolean },
        fromProvider: NormalizedProvider,
        compiler: CompilerContext,
        resolveDependenciesFrom: InjectorModule[],
        ofName: string,
        argPosition: number,
        notFoundFunction: string
    ): string {
        const token = options.token;

        //regarding configuration values: the attached module is not necessarily in resolveDependenciesFrom[0]
        //if the parent module overwrites its, then the parent module is at 0th position.
        if (token instanceof ConfigDefinition) {
            const module = findModuleForConfig(token, resolveDependenciesFrom);
            return compiler.reserveVariable('fullConfig', module.getConfig());
        } else if (token instanceof ConfigToken) {
            const module = findModuleForConfig(token.config, resolveDependenciesFrom);
            const config = module.getConfig();
            return compiler.reserveVariable(token.name, (config as any)[token.name]);
        } else if (isClass(token) && (Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice || Object.getPrototypeOf(token) === ConfigSlice)) {
            const value: ConfigSlice<any> = new token;
            const module = findModuleForConfig(value.config, resolveDependenciesFrom);
            value.bag = module.getConfig();
            return compiler.reserveVariable('configSlice', value);
        } else if (token === TagRegistry) {
            return compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);
        } else if (isPrototypeOfBase(token, Tag)) {
            const tokenVar = compiler.reserveVariable('token', token);
            const resolvedVar = compiler.reserveVariable('tagResolved');
            const entries = this.buildContext.tagRegistry.resolve(token);
            const args: string[] = [];
            for (const entry of entries) {
                args.push(`${compiler.reserveConst(entry.module)}.injector.resolver(${compiler.reserveConst(entry.tagProvider.provider.provide)}, scope)`);
            }
            return `new ${tokenVar}(${resolvedVar} || (${resolvedVar} = [${args.join(', ')}]))`;
        } else {
            let of = `${ofName}.${options.name}`;
            if (token === undefined) {
                if (argPosition >= 0) {
                    const argsCheck: string[] = [];
                    for (let i = 0; i < argPosition; i++) argsCheck.push('✓');
                    argsCheck.push('?');
                    of = `${ofName}(${argsCheck.join(', ')})`;
                }

                throw new DependenciesUnmetError(
                    `Undefined dependency '${options.name}: undefined' of ${of}. Dependency '${options.name}' has no type. Imported reflect-metadata correctly? ` +
                    `Use '@inject(PROVIDER) ${options.name}: T' if T is an interface. For circular references use @inject(() => T) ${options.name}: T.`
                );
            }
            const tokenVar = compiler.reserveVariable('token', token);

            let foundPreparedProvider: PreparedProvider | undefined = undefined;
            for (const module of resolveDependenciesFrom) {
                foundPreparedProvider = module.getPreparedProvider(token);
                if (foundPreparedProvider) {
                    if (foundPreparedProvider) {
                        //check if the found provider was actually exported to this current module.
                        //if not it means that provider is encapsulated living only in its module and can not be accessed from other modules.
                        const moduleHasAccessToThisProvider = foundPreparedProvider.modules.some(m => m === module);
                        if (!moduleHasAccessToThisProvider) {
                            foundPreparedProvider = undefined;
                        }
                    }
                }
            }

            if (!foundPreparedProvider) {
                //try if parents have anything
                const foundInModule = this.module.resolveToken(token);
                if (foundInModule) {
                    foundPreparedProvider = foundInModule.getPreparedProvider(token);
                }
            }

            if (!foundPreparedProvider && options.optional) return 'undefined';

            if (!foundPreparedProvider) {
                throw new DependenciesUnmetError(
                    `Unknown dependency '${options.name}: ${tokenLabel(token)}' of ${of}.`
                );
            }

            const allPossibleScopes = foundPreparedProvider.providers.map(getScope);
            const fromScope = getScope(fromProvider);
            const unscoped = allPossibleScopes.includes('') && allPossibleScopes.length === 1;

            if (!unscoped && !allPossibleScopes.includes(fromScope)) {
                throw new DependenciesUnmetError(
                    `Dependency '${options.name}: ${tokenLabel(token)}' of ${of} can not be injected into ${fromScope ? 'scope ' + fromScope : 'no scope'}, ` +
                    `since ${tokenLabel(token)} only exists in scope${allPossibleScopes.length === 1 ? '' : 's'} ${allPossibleScopes.join(', ')}.`
                );
            }

            //when the dependency is FactoryProvider it might return undefined.
            //in this case, if the dependency is not optional, we throw an error.
            const orThrow = options.optional ? '' : `?? ${notFoundFunction}(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;

            const resolveFromModule = foundPreparedProvider.resolveFrom || foundPreparedProvider.modules[0];
            if (resolveFromModule === this.module) {
                return `injector.resolver(${tokenVar}, scope)`;
            }
            return `${compiler.reserveConst(resolveFromModule)}.injector.resolver(${tokenVar}, scope) ${orThrow}`;
        }
    }

    protected optionsFromProperty(property: PropertySchema): { token: any, name: string | number, optional: boolean } {
        const options = property.data['deepkit/inject'] as InjectOptions | undefined;
        let token: any = property.resolveClassType;

        if (options && options.token) {
            token = isFunction(options.token) ? options.token() : options.token;
        } else if (property.type === 'class') {
            token = property.getResolvedClassType();
        } else if (property.type === 'literal') {
            token = property.literalValue;
        }

        return { token, name: property.name, optional: property.isOptional ? true : (!!options && options.optional) };
    }
}

class BuildProviderIndex {
    protected offset: number = 0;

    reserve(): number {
        return this.offset++;
    }
}

class BuildContext {
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

    get<T>(token: T, module?: InjectorModule): ResolveToken<T> {
        return this.getInjector(module || this.rootModule).get(token, this.scope);
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
