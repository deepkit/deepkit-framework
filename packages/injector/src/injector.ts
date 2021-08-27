import { isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, ProviderWithScope, Tag, TagProvider, TagRegistry } from './provider';
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
     * The modules from which dependencies can be resolved.
     * This is per default the module in which the provider was declared,
     * but if the provider was moved (by exporting), then if
     * a) the parent had this provider already, then this array has additionally the one from which the provider was exported.
     * b) the parent had no provider of that token, then this array is just the module from which the provider was exported.
     *
     * This is important otherwise exported provider won't have access to their original (encapsulated) injector.
     */
    modules: InjectorModule[];
    provider: ProviderWithScope;

    /**
     * When this provider is actually instantiated in another module, then this is set.
     * This is when a provider has been exported to a parent module.
     * The old module owner puts in its resolver a redirect to `resolveFrom`.
     */
    resolveFrom?: InjectorModule;
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

    imports: InjectorModule[] = [];

    /**
     * The first stage of building the injector is to resolve all providers and exports.
     * Then the actual injector functions can be built.
     */
    protected processed: boolean = false;

    protected exportsDisabled: boolean = false;

    constructor(
        public providers: ProviderWithScope[] = [],
        public parent?: InjectorModule,
        public config: C = {} as C,
        public exports: (ClassType | InjectorToken<any> | string | InjectorModule)[] = []
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

    setParent(parent: InjectorModule): this {
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

    getConfig(): C {
        return this.config;
    }

    configure(config: Partial<C>): this {
        Object.assign(this.config, config);
        return this;
    }

    /**
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.setupProviderRegistry, order);
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

    hasToken(token: any): boolean {
        if (!this.preparedProviders) return false;
        return this.preparedProviders.has(token);
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

        for (const child of this.imports) child.getPreparedProviders(buildContext);

        this.preparedProviders = new Map<any, PreparedProvider>();

        //make sure that providers that declare the same provider token will be filtered out so that the last will be used.
        for (const provider of this.providers) {
            if (provider instanceof TagProvider) {
                buildContext.tagRegistry.register(provider, this);

                if (!this.preparedProviders.has(provider.provider.provide)) {
                    //we dont want to overwrite that provider with a tag
                    this.preparedProviders.set(provider.provider.provide, { modules: [this], provider: provider.provider });
                }
            } else if (isValueProvider(provider)) {
                this.preparedProviders.set(provider.provide, { modules: [this], provider });
            } else if (isClassProvider(provider)) {
                this.preparedProviders.set(provider.provide, { modules: [this], provider });
            } else if (isExistingProvider(provider)) {
                this.preparedProviders.set(provider.provide, { modules: [this], provider });
            } else if (isFactoryProvider(provider)) {
                this.preparedProviders.set(provider.provide, { modules: [this], provider });
            } else if (isClass(provider)) {
                this.preparedProviders.set(provider, { modules: [this], provider });
            }
        }

        return this.preparedProviders;
    }

    protected exported: boolean = false;

    protected handleExports(buildContext: BuildContext) {
        if (this.exported) return;
        this.exported = true;

        for (const child of this.imports) {
            child.setParent(this);
            child.handleExports(buildContext);
        }

        if (!this.preparedProviders) return;
        if (!this.parent) return;
        if (this.exportsDisabled) return;

        const exportToken = (token: any, to: InjectorModule) => {
            if (!this.preparedProviders) return;
            const provider = this.preparedProviders.get(token);
            //if it was not in provider, we continue
            if (!provider) return;

            // const exportTo = findModuleToExportTo(this, token, this.parent);

            //mark this provider as redirect to `exportTo`
            provider.resolveFrom = to;

            const parentProviders = to.getPreparedProviders(buildContext);
            const parentProvider = parentProviders.get(token);
            //if the parent has this token already defined, we just switch its module to ours,
            //so its able to inject our encapsulated services.
            if (parentProvider) {
                //we add our module as additional source for potential dependencies
                parentProvider.modules.push(this);
            } else {
                parentProviders.set(token, { modules: [this], provider: provider.provider });
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
            //only handle exports when a parent is assigned.
            for (const entry of this.exports) {
                if ((isClass(entry) && isPrototypeOfBase(entry, InjectorModule)) || entry instanceof InjectorModule) {
                    const moduleInstance = isClass(entry) ? this.imports.find(v => v instanceof entry) : entry;
                    if (!moduleInstance) {
                        throw new Error(`Unknown module ${getClassName(entry)} exported from ${getClassName(this)}. The module was never imported.`);
                    }

                    //export everything to the parent that we received from that `entry` module
                    for (const [token, provider] of this.preparedProviders.entries()) {
                        if (provider.modules.includes(moduleInstance)) {
                            //this provider was received from `entry`

                            //mark this provider as redirect to `exportTo`
                            provider.resolveFrom = this.parent;

                            const parentProviders = this.parent.getPreparedProviders(buildContext);
                            const parentProvider = parentProviders.get(token);
                            //if the parent has this token already defined, we just switch its module to ours,
                            //so its able to inject our encapsulated services.
                            if (parentProvider) {
                                //we add our module as additional source for potential dependencies
                                parentProvider.modules.push(this);
                            } else {
                                parentProviders.set(token, { modules: [this, ...provider.modules], provider: provider.provider });
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
        return new Injector(new InjectorModule(providers), new BuildContext);
    }

    static fromModule(module: InjectorModule, parent?: Injector): Injector {
        return new Injector(module, new BuildContext);
    }

    get<T>(token: T, scope?: Scope): ResolveToken<T> {
        return this.resolver!(token, scope);
    }

    set<T>(token: T, value: any, scope?: Scope): void {
        this.setter!(token, value, scope);
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
        const setterLines: string[] = [];

        for (const [token, prepared] of this.module.getPreparedProviders(buildContext).entries()) {
            const scope = getScope(prepared.provider);
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
                    case ${resolverCompiler.reserveConst(token)}: {
                        return ${resolverCompiler.reserveConst(prepared.resolveFrom)}.injector.resolver(${resolverCompiler.reserveConst(token)}, scope);
                    }
                `);

            } else {
                //we own and instantiate the service
                lines.push(this.buildProvider(resolverCompiler, name, accessor, token, scope, prepared));
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
                switch (token) {
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
        compiler: CompilerContext,
        name: string,
        accessor: string,
        token: any,
        scope: string,
        preparedProvider: PreparedProvider,
    ) {
        let transient = false;
        let factory: { code: string, dependencies: number } = { code: '', dependencies: 0 };
        let provider = preparedProvider.provider;

        const tagToken = provider instanceof TagProvider ? provider : undefined;
        if (tagToken) token = tagToken;
        const tokenVar = compiler.reserveConst(token);

        if (provider instanceof TagProvider) {
            provider = provider.provider;
        }

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
            factory = this.createFactory(accessor, compiler, useClass, preparedProvider.modules);
        } else if (isExistingProvider(provider)) {
            transient = provider.transient === true;
            // factory = ``;
            // factory = this.createFactory(accessor, compiler, provider.useExisting, preparedProvider.modules);
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
                }, compiler, preparedProvider.modules, 'useFactory', args.length, 'factoryDependencyNotFound'));
            }

            factory.code = `${accessor} = ${compiler.reserveVariable('factory', provider.useFactory)}(${args.join(', ')});`;
        } else if (isClass(provider)) {
            token = provider;
            factory = this.createFactory(accessor, compiler, provider, preparedProvider.modules);
        } else {
            throw new Error('Invalid provider');
        }

        const configureProvider: string[] = [];
        const configuredProviderCalls = this.module.setupProviderRegistry?.get(token);

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

        const scopeCheck = scope ? `if (!scope || scope.name !== ${JSON.stringify(scope)}) break;` : '';

        //circular dependencies can happen, when for example a service with InjectorContext injected manually instantiates a service.
        //if that service references back to the first one, it will be a circular loop. So we track that with `creating` state.
        const creatingVar = `creating_${name}`;
        const circularDependencyCheckStart = factory.dependencies ? `if (${creatingVar}) throwCircularDependency();${creatingVar} = true;` : '';
        const circularDependencyCheckEnd = factory.dependencies ? `${creatingVar} = false;` : '';

        return `
            //${tokenLabel(token)}
            case ${tokenVar}: {
                ${scopeCheck}
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
            args.push(this.createFactoryProperty(this.optionsFromProperty(property), compiler, resolveDependenciesFrom, getClassName(classType), args.length, 'constructorParameterNotFound'));
        }

        for (const property of schema.getProperties()) {
            if (!('deepkit/inject' in property.data)) continue;
            if (property.methodName === 'constructor') continue;
            dependencies++;
            try {
                const resolveProperty = this.createFactoryProperty(this.optionsFromProperty(property), compiler, resolveDependenciesFrom, getClassName(classType), -1, 'propertyParameterNotFound');
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
        compiler: CompilerContext,
        resolveDependenciesFrom: InjectorModule[],
        ofName: string,
        argPosition: number,
        notFoundFunction: string
    ): string {
        const token = options.token;

        if (token instanceof ConfigDefinition) {
            return compiler.reserveVariable('fullConfig', resolveDependenciesFrom[0].getConfig());
        } else if (token instanceof ConfigToken) {
            const config = resolveDependenciesFrom[0].getConfig();
            return compiler.reserveVariable(token.name, (config as any)[token.name]);
        } else if (isClass(token) && (Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice || Object.getPrototypeOf(token) === ConfigSlice)) {
            const value: ConfigSlice<any> = new token;
            value.bag = resolveDependenciesFrom[0].getConfig();
            return compiler.reserveVariable('configSlice', value);
        } else if (token === TagRegistry) {
            return compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);
        } else if (isPrototypeOfBase(token, Tag)) {
            const tokenVar = compiler.reserveVariable('token', token);
            const tagRegistryVar = compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);

            //it might be too late to resolve now (imports have not been processed), so we delay that to runtime.
            //we could move that to build-time though. We need need to make sure, that all children have called getNormalizedProviders()
            return `new ${tokenVar}(${tagRegistryVar}.resolve(${tokenVar}).map(v => v.module.injector.get(v.tagProvider.provider.provide, scope)))`;
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

            let foundInModule: InjectorModule | undefined = undefined;
            for (const module of resolveDependenciesFrom) {
                if (module.hasToken(token)) {
                    foundInModule = module;
                    break;
                }
            }

            if (!foundInModule) {
                //try if parents have anything
                foundInModule = this.module.resolveToken(token);
            }

            if (!foundInModule && options.optional) return 'undefined';

            if (!foundInModule) {
                throw new DependenciesUnmetError(
                    `Unknown dependency '${options.name}: ${tokenLabel(token)}' of ${of}. `
                );
            }

            //when the dependency is FactoryProvider it might return undefined.
            //in this case, if the dependency is not optional, we throw an error.
            const orThrow = options.optional ? '' : `?? ${notFoundFunction}(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;

            if (foundInModule === this.module) {
                return `injector.resolver(${tokenVar}, scope)`;
            }
            return `${compiler.reserveConst(foundInModule)}.injector.resolver(${tokenVar}, scope) ${orThrow}`;
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
}

/**
 * A InjectorContext is responsible for taking a root InjectorModule and build all Injectors.
 *
 * It also can create scopes aka a sub InjectorContext with providers from a particular scope
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
     * Returns the unscoped injector. Use .get(token, module) for resolving scoped token.
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
