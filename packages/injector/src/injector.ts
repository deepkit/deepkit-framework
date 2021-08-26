import { isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, ProviderWithScope, Tag, TagProvider, TagRegistry } from './provider';
import { ClassType, CompilerContext, CustomError, getClassName, isClass, isFunction, isPrototypeOfBase } from '@deepkit/core';
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

export class InjectorModule<C extends { [name: string]: any } = any> {
    public id: number = moduleIds++;

    // public exports: (ClassType | InjectorModule)[] = [];
    // public imports: InjectorModule[] = [];

    public injector?: Injector;

    public setupProviderRegistry: SetupProviderRegistry = new SetupProviderRegistry;

    constructor(
        public providers: ProviderWithScope[] = [],
        public parent?: InjectorModule,
        public config: C = {} as C
    ) {
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

/**
 * This is the actual dependency injection container.
 *
 * Injectors live in a tree of injectors, that mirror the tree of modules.
 * Every module has its own injector.
 */
export class Injector {
    /**
     * The factory creates new resolvers.
     * This is necessary to be able to reset resolved instances.
     */
    protected resolver?: (token: any, injector: Injector, scope?: Scope) => any = undefined;

    //all unscoped instances
    protected instances: { [name: string]: any } = {};

    public offset: number = 0;

    protected normalizedProviders?: Map<any, ProviderWithScope>;

    constructor(
        public readonly module: InjectorModule,
        public readonly parent?: Injector,
        resolver?: (token: any, injector: Injector, scope?: Scope) => any
    ) {
        this.offset = parent ? parent.offset : 0;
        this.resolver = resolver || this.build();
    }

    static from(providers: ProviderWithScope[], parent?: Injector): Injector {
        return new Injector(new InjectorModule(providers), parent);
    }

    get<T>(token: T, scope?: Scope): ResolveToken<T> {
        return this.resolver!(token, this, scope);
    }

    clear() {
        this.instances = {};
    }

    getNormalizedProviders(): Map<any, ProviderWithScope> {
        if (this.normalizedProviders) return this.normalizedProviders;

        this.normalizedProviders = new Map<any, ProviderWithScope>();

        //make sure that providers that declare the same provider token will be filtered out so that the last will be used.
        for (const provider of this.module.providers) {
            if (provider instanceof TagProvider) {
                this.normalizedProviders.set(provider.provider, provider);
            } else if (isValueProvider(provider)) {
                this.normalizedProviders.set(provider.provide, provider);
            } else if (isClassProvider(provider)) {
                this.normalizedProviders.set(provider.provide, provider);
            } else if (isExistingProvider(provider)) {
                this.normalizedProviders.set(provider.provide, provider);
            } else if (isFactoryProvider(provider)) {
                this.normalizedProviders.set(provider.provide, provider);
            } else if (isClass(provider)) {
                this.normalizedProviders.set(provider, provider);
            }
        }

        return this.normalizedProviders;
    }

    protected build(): (token: any, injector: Injector, scope?: Scope) => any {
        const compiler = new CompilerContext();
        compiler.context.set('CircularDetector', CircularDetector);
        compiler.context.set('CircularDetectorResets', CircularDetectorResets);
        compiler.context.set('throwCircularDependency', throwCircularDependency);
        compiler.context.set('tokenNotfoundError', tokenNotfoundError);
        compiler.context.set('Error', Error);
        const lines: string[] = [];
        const resets: string[] = [];
        const creating: string[] = [];

        for (const [token, provider] of this.getNormalizedProviders().entries()) {
            const scope = getScope(provider);
            const name = 'i' + (this.offset++);
            creating.push(`let creating_${name} = false;`);
            resets.push(`creating_${name} = false;`);
            const accessor = scope ? 'scope.instances.' + name : 'injector.instances.' + name;
            lines.push(this.buildProvider(compiler, name, accessor, token, scope, provider));
        }

        return compiler.raw(`
            ${creating.join('\n')};

            CircularDetectorResets.push(() => {
                ${resets.join('\n')};
            });

            return function(token, injector, scope) {
                switch (token) {
                    ${lines.join('\n')}
                }

                tokenNotfoundError(token, '${getClassName(this.module)}');
            }
        `) as any;
    }

    protected buildProvider(
        compiler: CompilerContext,
        name: string,
        accessor: string,
        token: any,
        scope: string,
        provider: ProviderWithScope,
    ) {
        let transient = false;
        let factory: { code: string, dependencies: number } = { code: '', dependencies: 0 };
        const tagToken = provider instanceof TagProvider ? provider : undefined;
        if (provider instanceof TagProvider) {
            provider = provider.provider;
        }

        if (isValueProvider(provider)) {
            transient = provider.transient === true;
            const valueVar = compiler.reserveVariable('useValue', provider.useValue);
            factory.code = `${accessor} = ${valueVar};`;
        } else if (isClassProvider(provider)) {
            transient = provider.transient === true;
            token = provider.provide;

            let useClass = provider.useClass;
            if (!useClass) {
                if (!isClass(provider.provide)) {
                    throw new Error(`UseClassProvider needs to set either 'useClass' or 'provide' as a ClassType.`);
                }
                useClass = provider.provide;
            }
            factory = this.createFactory(accessor, compiler, useClass);
        } else if (isExistingProvider(provider)) {
            transient = provider.transient === true;
            token = provider.provide;
            factory = this.createFactory(accessor, compiler, provider.useExisting);
        } else if (isFactoryProvider(provider)) {
            transient = provider.transient === true;
            token = provider.provide;

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
                }, compiler, 'useFactory', args.length, 'factoryDependencyNotFound'));
            }

            factory.code = `${accessor} = ${compiler.reserveVariable('factory', provider.useFactory)}(${args.join(', ')});`;
        } else if (isClass(provider)) {
            token = provider;
            factory = this.createFactory(accessor, compiler, provider);
        } else {
            throw new Error('Invalid provider');
        }

        if (tagToken) token = tagToken;

        const tokenVar = compiler.reserveVariable('token', token);

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
                            args.push(`injector.get(${compiler.reserveVariable('forward', arg.to)})`);
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

    protected createFactory(resolvedName: string, compiler: CompilerContext, classType: ClassType): { code: string, dependencies: number } {
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
            args.push(this.createFactoryProperty(this.optionsFromProperty(property), compiler, getClassName(classType), args.length, 'constructorParameterNotFound'));
        }

        for (const property of schema.getProperties()) {
            if (!('deepkit/inject' in property.data)) continue;
            if (property.methodName === 'constructor') continue;
            dependencies++;
            try {
                propertyAssignment.push(`${resolvedName}.${property.name} = ${this.createFactoryProperty(this.optionsFromProperty(property), compiler, getClassName(classType), -1, 'propertyParameterNotFound')};`);
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
        ofName: string,
        argPosition: number,
        notFoundFunction: string
    ): string {
        const token = options.token;

        if (token instanceof ConfigDefinition) {
            return compiler.reserveVariable('fullConfig', this.module.getConfig());
        } else if (token instanceof ConfigToken) {
            const config = this.module.getConfig();
            return compiler.reserveVariable(token.name, (config as any)[token.name]);
        } else if (isClass(token) && (Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice || Object.getPrototypeOf(token) === ConfigSlice)) {
            const value: ConfigSlice<any> = new token;
            value.bag = this.module.getConfig();
            return compiler.reserveVariable('configSlice', value);
        } else if (token === TagRegistry) {
            //todo
            // return compiler.reserveVariable('tagRegistry', this.tagRegistry);
        } else if (isPrototypeOfBase(token, Tag)) {
            //todo
            // const tokenVar = compiler.reserveVariable('token', token);
            // const providers = compiler.reserveVariable('tagRegistry', this.tagRegistry.resolve(token));
            // return `new ${tokenVar}(${providers}.map(v => (frontInjector.retriever ? frontInjector.retriever(frontInjector, v, frontInjector) : frontInjector.get(v, frontInjector))))`;
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

            if (!this.normalizedProviders) throw new Error('No providers loaded');

            let current: Injector = this;
            let provider = current.getNormalizedProviders().get(token);
            let injector = 'injector';

            while (!provider) {
                const providers = current.getNormalizedProviders();
                provider = providers.get(token);
                if (provider) {
                    injector += '.parent';
                }

                if (!current.parent && !provider) {
                    if (options.optional) return 'undefined';
                    throw new DependenciesUnmetError(
                        `Unknown dependency '${options.name}: ${tokenLabel(token)}' of ${of} in module tree. Mark as optional via '@t.optional ${options.name}?: ${tokenLabel(token)}' if the dependency is not required.`
                    );
                }

                if (current.parent) {
                    current = current.parent;
                }
            }

            const orThrow = options.optional ? '' : `?? ${notFoundFunction}(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;
            const scope = getScope(provider);
            let cached = '(';
            if (!scope) {
                //todo: and not transient
                const depVar = compiler.reserveVariable('dep');
                cached = `${depVar} ?? (${depVar} = `;
            }

            return `${cached}${injector}.resolver(${tokenVar}, ${injector}, scope)) ${orThrow}`;
        }

        return 'undefined';
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

/**
 * A InjectorContext is responsible for taking a root InjectorModule and build all Injectors.
 *
 * It also can create scopes aka a sub InjectorContext with providers from a particular scope
 */
export class InjectorContext {
    constructor(
        public rootModule: InjectorModule,
        public readonly scope?: Scope,
    ) {
    }

    get<T>(token: T, module?: InjectorModule): ResolveToken<T> {
        return this.getInjector(module || this.rootModule).get(token, this.scope);
    }

    static forProviders(providers: ProviderWithScope[]) {
        return new InjectorContext(new InjectorModule(providers));
    }

    getInjector(module: InjectorModule): Injector {
        if (!module.injector) {
            module.injector = new Injector(module, module.parent ? this.getInjector(module.parent) : undefined);
        }

        return module.injector;
    }

    public createChildScope(scope: string): InjectorContext {
        return new InjectorContext(this.rootModule, { name: scope, instances: {} });
    }
}
