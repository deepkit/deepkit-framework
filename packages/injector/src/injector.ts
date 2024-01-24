import {
    AbstractClassType,
    ClassType,
    CompilerContext,
    CustomError,
    getClassName,
    getPathValue,
    isArray,
    isClass,
    isFunction,
    isPrototypeOfBase,
} from '@deepkit/core';
import {
    ReceiveType,
    ReflectionClass,
    ReflectionFunction,
    ReflectionKind,
    Type,
    hasTypeInformation,
    isExtendable,
    isOptional,
    isType,
    isWithAnnotations,
    metaAnnotation,
    reflect,
    resolveReceiveType,
    stringifyType,
} from '@deepkit/type';

import { InjectorModule, PreparedProvider, findModuleForConfig, getScope } from './module.js';
import {
    NormalizedProvider,
    ProviderWithScope,
    Tag,
    TagProvider,
    TagRegistry,
    Token,
    isClassProvider,
    isExistingProvider,
    isFactoryProvider,
    isValueProvider,
} from './provider.js';

export class InjectorError extends CustomError {}

export class CircularDependencyError extends InjectorError {}

export class ServiceNotFoundError extends InjectorError {}

export class DependenciesUnmetError extends InjectorError {}

export class InjectorReference {
    constructor(
        public readonly to: any,
        public module?: InjectorModule,
    ) {}
}

export function injectorReference<T>(classTypeOrToken: T, module?: InjectorModule): any {
    return new InjectorReference(classTypeOrToken, module);
}

export function tokenLabel(token: Token): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (token instanceof TagProvider) return 'Tag(' + getClassName(token.provider.provide) + ')';
    if (isClass(token)) return getClassName(token);
    if (isType(token)) return stringifyType(token).replace(/\n/gm, '');
    if (isFunction(token.toString)) return token.name;

    return token + '';
}

function constructorParameterNotFound(ofName: string, name: string, position: number, token: any) {
    const argsCheck: string[] = [];
    for (let i = 0; i < position; i++) argsCheck.push('✓');
    argsCheck.push('?');

    throw new DependenciesUnmetError(
        `Unknown constructor argument '${name}: ${tokenLabel(token)}' of ${ofName}(${argsCheck.join(', ')}). Make sure '${tokenLabel(token)}' is provided.`,
    );
}

function serviceNotfoundError(token: any, moduleName: string) {
    throw new ServiceNotFoundError(
        `Service '${tokenLabel(token)}' in ${moduleName} not found. Make sure it is provided.`,
    );
}

function factoryDependencyNotFound(ofName: string, name: string, position: number, token: any) {
    const argsCheck: string[] = [];
    for (let i = 0; i < position; i++) argsCheck.push('✓');
    argsCheck.push('?');

    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown factory dependency argument '${tokenLabel(token)}' of ${ofName}(${argsCheck.join(', ')}). Make sure '${tokenLabel(token)}' is provided.`,
    );
}

function propertyParameterNotFound(ofName: string, name: string, position: number, token: any) {
    for (const reset of CircularDetectorResets) reset();
    throw new DependenciesUnmetError(
        `Unknown property parameter ${name} of ${ofName}. Make sure '${tokenLabel(token)}' is provided.`,
    );
}

function transientInjectionTargetUnavailable(ofName: string, name: string, position: number, token: any) {
    throw new DependenciesUnmetError(
        `${TransientInjectionTarget.name} is not available for ${name} of ${ofName}. ${TransientInjectionTarget.name} is only available when injecting into other providers`,
    );
}

type Destination = { token: Token };

function createTransientInjectionTarget(destination: Destination | undefined) {
    if (!destination) {
        return undefined;
    }

    return new TransientInjectionTarget(destination.token);
}

const CircularDetector: any[] = [];
const CircularDetectorResets: (() => void)[] = [];

function throwCircularDependency() {
    const path = CircularDetector.map(tokenLabel).join(' -> ');
    CircularDetector.length = 0;
    for (const reset of CircularDetectorResets) reset();
    throw new CircularDependencyError(`Circular dependency found ${path}`);
}

export type SetupProviderCalls =
    | {
          type: 'call';
          methodName: string | symbol | number;
          args: any[];
          order: number;
      }
    | { type: 'property'; property: string | symbol | number; value: any; order: number }
    | { type: 'stop'; order: number };

function matchType(left: Type, right: Type): boolean {
    if (left.kind === ReflectionKind.class) {
        if (right.kind === ReflectionKind.class) return left.classType === right.classType;
    }

    return isExtendable(left, right);
}

export class SetupProviderRegistry {
    public calls: { type: Type; call: SetupProviderCalls }[] = [];

    public add(type: Type, call: SetupProviderCalls) {
        this.calls.push({ type, call });
    }

    mergeInto(registry: SetupProviderRegistry): void {
        for (const { type, call } of this.calls) {
            registry.add(type, call);
        }
    }

    public get(token: Token): SetupProviderCalls[] {
        const calls: SetupProviderCalls[] = [];
        for (const call of this.calls) {
            if (call.type === token) {
                calls.push(call.call);
            } else {
                if (isClass(token)) {
                    const type = hasTypeInformation(token) ? reflect(token) : undefined;
                    if (type && matchType(type, call.type)) {
                        calls.push(call.call);
                    }
                } else if (matchType(token, call.type)) {
                    calls.push(call.call);
                }
            }
        }
        return calls;
    }
}

interface Scope {
    name: string;
    instances: { [name: string]: any };
}

export type ResolveToken<T> = T extends ClassType<infer R> ? R : T extends AbstractClassType<infer R> ? R : T;

export function resolveToken(provider: ProviderWithScope): Token {
    if (isClass(provider)) return provider;
    if (provider instanceof TagProvider) return resolveToken(provider.provider);

    return provider.provide;
}

export type ContainerToken = Exclude<Token, Type | TagProvider<any>>;

/**
 * Returns a value that can be compared with `===` to check if two tokens are actually equal even though
 * they are the result of different type expressions.
 *
 * This is used in the big switch-case statement in the generated code to match DI tokens.
 */
export function getContainerToken(type: Token): ContainerToken {
    if (isClass(type)) return type;
    if (type instanceof TagProvider) return getContainerToken(type.provider);

    if (isType(type)) {
        if (type.id) return type.id;
        if (type.kind === ReflectionKind.literal) return type.literal;
        if (type.kind === ReflectionKind.class) return type.classType;
        if (type.kind === ReflectionKind.function && type.function) return type.function;
    }

    return type;
}

export interface InjectorInterface {
    get<T>(token: T, scope?: Scope): ResolveToken<T>;
}

/**
 * Returns the injector token type if the given type was decorated with `Inject<T>`.
 */
export function getInjectOptions(type: Type): Type | undefined {
    const annotations = metaAnnotation.getForName(type, 'inject');
    if (!annotations) return;
    const t = annotations[0];
    return t && t.kind !== ReflectionKind.never ? t : type;
}

function getPickArguments(type: Type): Type[] | undefined {
    if (type.typeName === 'Pick' && type.typeArguments && type.typeArguments.length === 2) {
        return type.typeArguments;
    }
    if (!type.originTypes) return;

    for (const origin of type.originTypes) {
        if (origin.typeName === 'Pick' && origin.typeArguments && origin.typeArguments.length === 2) {
            return origin.typeArguments;
        }
    }

    return;
}

/**
 * Class describing where a transient provider will be injected.
 *
 * @reflection never
 */
export class TransientInjectionTarget {
    constructor(public readonly token: Token) {}
}

/**
 * A factory function for some class.
 * All properties that are not provided will be resolved using the injector that was used to create the factory.
 */
export type PartialFactory<C> = (args: Partial<{ [K in keyof C]: C[K] }>) => C;

/**
 * This is the actual dependency injection container.
 * Every module has its own injector.
 *
 * @reflection never
 */
export class Injector implements InjectorInterface {
    private resolver?: (token: any, scope?: Scope, destination?: Destination) => any;
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
        return new Injector(new InjectorModule(providers, parent?.module), new BuildContext());
    }

    static fromModule(module: InjectorModule, parent?: Injector): Injector {
        return new Injector(module, new BuildContext());
    }

    get<T>(token?: ReceiveType<T> | Token<T>, scope?: Scope): ResolveToken<T> {
        if (!this.resolver) throw new Error('Injector was not built');
        if (
            'string' === typeof token ||
            'number' === typeof token ||
            'bigint' === typeof token ||
            'boolean' === typeof token ||
            'symbol' === typeof token ||
            isFunction(token) ||
            isClass(token) ||
            token instanceof RegExp
        ) {
            return this.resolver(getContainerToken(token), scope) as ResolveToken<T>;
        } else if (isType(token)) {
            return this.createResolver(isType(token) ? (token as Type) : resolveReceiveType(token), scope)(scope);
        } else if (isArray(token)) {
            return this.createResolver(resolveReceiveType(token), scope)(scope);
        }
        throw new Error(`Invalid get<T> argument given ${token}`);
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
        const resolverCompiler = new CompilerContext();
        resolverCompiler.context.set('CircularDetector', CircularDetector);
        resolverCompiler.context.set('CircularDetectorResets', CircularDetectorResets);
        resolverCompiler.context.set('throwCircularDependency', throwCircularDependency);
        resolverCompiler.context.set('tokenNotfoundError', serviceNotfoundError);
        resolverCompiler.context.set('constructorParameterNotFound', constructorParameterNotFound);
        resolverCompiler.context.set('propertyParameterNotFound', propertyParameterNotFound);
        resolverCompiler.context.set('factoryDependencyNotFound', factoryDependencyNotFound);
        resolverCompiler.context.set('transientInjectionTargetUnavailable', transientInjectionTargetUnavailable);
        resolverCompiler.context.set('createTransientInjectionTarget', createTransientInjectionTarget);
        resolverCompiler.context.set('injector', this);

        const lines: string[] = [];
        const resets: string[] = [];
        const creating: string[] = [];

        const instantiationCompiler = new CompilerContext();
        instantiationCompiler.context.set('injector', this);
        const instantiationLines: string[] = [];

        const setterCompiler = new CompilerContext();
        setterCompiler.context.set('injector', this);
        const setterLines: string[] = [];

        for (const prepared of this.module.getPreparedProviders(buildContext)) {
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
                const scopeObjectCheck = scope ? ` && scope && scope.name === ${JSON.stringify(scope)}` : '';
                const scopeCheck = scope ? ` && scope === ${JSON.stringify(scope)}` : '';

                const diToken = getContainerToken(prepared.token);

                setterLines.push(`case token === ${setterCompiler.reserveVariable('token', diToken)}${scopeObjectCheck}: {
                    if (${accessor} === undefined) {
                        injector.instantiated.${name} = injector.instantiated.${name} ? injector.instantiated.${name} + 1 : 1;
                    }
                    ${accessor} = value;
                    break;
                }`);

                if (prepared.resolveFrom) {
                    //it's a redirect
                    lines.push(`
                    case token === ${resolverCompiler.reserveConst(diToken, 'token')}${scopeObjectCheck}: {
                        return ${resolverCompiler.reserveConst(prepared.resolveFrom, 'resolveFrom')}.injector.resolver(${resolverCompiler.reserveConst(diToken, 'token')}, scope, destination);
                    }
                    `);

                    instantiationLines.push(`
                    case token === ${instantiationCompiler.reserveConst(diToken, 'token')}${scopeCheck}: {
                        return ${instantiationCompiler.reserveConst(prepared.resolveFrom, 'resolveFrom')}.injector.instantiations(${instantiationCompiler.reserveConst(diToken, 'token')}, scope);
                    }
                    `);
                } else {
                    //we own and instantiate the service
                    lines.push(
                        this.buildProvider(
                            buildContext,
                            resolverCompiler,
                            name,
                            accessor,
                            scope,
                            prepared.token,
                            provider,
                            prepared.modules,
                        ),
                    );

                    instantiationLines.push(`
                    case token === ${instantiationCompiler.reserveConst(diToken, 'token')}${scopeCheck}: {
                        return injector.instantiated.${name} || 0;
                    }
                    `);
                }
            }
        }

        this.instantiations = instantiationCompiler.build(
            `
            //for ${getClassName(this.module)}
            switch (true) {
                ${instantiationLines.join('\n')}
            }
            return 0;
        `,
            'token',
            'scope',
        );

        this.setter = setterCompiler.build(
            `
            //for ${getClassName(this.module)}
            switch (true) {
                ${setterLines.join('\n')}
            }
        `,
            'token',
            'value',
            'scope',
        );

        this.resolver = resolverCompiler.raw(`
            //for ${getClassName(this.module)}
            ${creating.join('\n')};

            CircularDetectorResets.push(() => {
                ${resets.join('\n')};
            });

            return function(token, scope, destination) {
                switch (true) {
                    ${lines.join('\n')}
                }

                tokenNotfoundError(token, '${getClassName(this.module)}');
            }
        `) as any;
    }

    protected buildProvider(
        buildContext: BuildContext,
        compiler: CompilerContext,
        name: string,
        accessor: string,
        scope: string,
        token: Token,
        provider: NormalizedProvider,
        resolveDependenciesFrom: InjectorModule[],
    ) {
        let transient = false;
        let factory: { code: string; dependencies: number } = { code: '', dependencies: 0 };
        const tokenVar = compiler.reserveConst(getContainerToken(token));

        if (isValueProvider(provider)) {
            transient = provider.transient === true;
            const valueVar = compiler.reserveVariable('useValue', provider.useValue);
            factory.code = `${accessor} = ${valueVar};`;
        } else if (isClassProvider(provider)) {
            transient = provider.transient === true;

            let useClass = provider.useClass;
            if (!useClass) {
                if (!isClass(provider.provide)) {
                    throw new Error(
                        `UseClassProvider needs to set either 'useClass' or 'provide' as a ClassType. Got ${provider.provide as any}`,
                    );
                }
                useClass = provider.provide as ClassType;
            }
            factory = this.createFactory(provider, accessor, compiler, useClass, resolveDependenciesFrom);
        } else if (isExistingProvider(provider)) {
            transient = provider.transient === true;
            factory.code = `${accessor} = injector.resolver(${compiler.reserveConst(getContainerToken(provider.useExisting))}, scope, destination)`;
        } else if (isFactoryProvider(provider)) {
            transient = provider.transient === true;
            const args: string[] = [];
            const reflection = ReflectionFunction.from(provider.useFactory);

            for (const parameter of reflection.getParameters()) {
                factory.dependencies++;
                const tokenType = getInjectOptions(parameter.getType() as Type);
                const ofName = reflection.name === 'anonymous' ? 'useFactory' : reflection.name;
                args.push(
                    this.createFactoryProperty(
                        {
                            name: parameter.name,
                            type: tokenType || (parameter.getType() as Type),
                            optional: !parameter.isValueRequired(),
                        },
                        provider,
                        compiler,
                        resolveDependenciesFrom,
                        ofName,
                        args.length,
                        'factoryDependencyNotFound',
                    ),
                );
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
                    const methodName =
                        'symbol' === typeof call.methodName
                            ? '[' + compiler.reserveVariable('arg', call.methodName) + ']'
                            : call.methodName;
                    for (const arg of call.args) {
                        if (arg instanceof InjectorReference) {
                            const injector = arg.module ? compiler.reserveConst(arg.module) + '.injector' : 'injector';
                            args.push(
                                `${injector}.resolver(${compiler.reserveConst(getContainerToken(arg.to))}, scope, destination)`,
                            );
                        } else {
                            args.push(`${compiler.reserveVariable('arg', arg)}`);
                        }
                    }

                    configureProvider.push(`${accessor}.${methodName}(${args.join(', ')});`);
                }
                if (call.type === 'property') {
                    const property =
                        'symbol' === typeof call.property
                            ? '[' + compiler.reserveVariable('property', call.property) + ']'
                            : call.property;
                    let value: string = '';
                    if (call.value instanceof InjectorReference) {
                        const injector = call.value.module
                            ? compiler.reserveConst(call.value.module) + '.injector'
                            : 'injector';
                        value = `${injector}.resolver(${compiler.reserveConst(getContainerToken(call.value.to))}, scope, destination)`;
                    } else {
                        value = compiler.reserveVariable('value', call.value);
                    }
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
        const circularDependencyCheckStart = factory.dependencies
            ? `if (${creatingVar}) throwCircularDependency();${creatingVar} = true;`
            : '';
        const circularDependencyCheckEnd = factory.dependencies ? `${creatingVar} = false;` : '';

        return `
            //${tokenLabel(token)}, from ${resolveDependenciesFrom.map(getClassName).join(', ')}
            case token === ${tokenVar}${scopeCheck}: {
                ${!transient ? `if (${accessor} !== undefined) return ${accessor};` : ''}
                CircularDetector.push(${tokenVar});
                ${circularDependencyCheckStart}
                injector.instantiated.${name} = injector.instantiated.${name} ? injector.instantiated.${name} + 1 : 1;
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
        resolveDependenciesFrom: InjectorModule[],
    ): { code: string; dependencies: number } {
        if (!classType) throw new Error('Can not create factory for undefined ClassType');
        const reflectionClass = ReflectionClass.from(classType);
        const args: string[] = [];
        const propertyAssignment: string[] = [];
        const classTypeVar = compiler.reserveVariable('classType', classType);

        let dependencies: number = 0;

        const constructor = reflectionClass.getMethodOrUndefined('constructor');
        if (constructor) {
            for (const parameter of constructor.getParameters()) {
                dependencies++;
                const tokenType = getInjectOptions(parameter.getType() as Type);
                args.push(
                    this.createFactoryProperty(
                        {
                            name: parameter.name,
                            type: tokenType || (parameter.getType() as Type),
                            optional: !parameter.isValueRequired(),
                        },
                        provider,
                        compiler,
                        resolveDependenciesFrom,
                        getClassName(classType),
                        args.length,
                        'constructorParameterNotFound',
                    ),
                );
            }
        }

        for (const property of reflectionClass.getProperties()) {
            const tokenType = getInjectOptions(property.type);
            if (!tokenType) continue;

            dependencies++;
            try {
                const resolveProperty = this.createFactoryProperty(
                    {
                        name: property.name,
                        type: tokenType,
                        optional: !property.isValueRequired(),
                    },
                    provider,
                    compiler,
                    resolveDependenciesFrom,
                    getClassName(classType),
                    -1,
                    'propertyParameterNotFound',
                );
                propertyAssignment.push(`${resolvedName}.${String(property.getName())} = ${resolveProperty};`);
            } catch (error: any) {
                throw new Error(
                    `Could not resolve property injection token ${getClassName(classType)}.${String(property.getName())}: ${error.message}`,
                );
            }
        }

        return {
            code: `${resolvedName} = new ${classTypeVar}(${args.join(',')});\n${propertyAssignment.join('\n')}`,
            dependencies,
        };
    }

    protected createFactoryProperty(
        options: { name: string; type: Type; optional: boolean },
        fromProvider: NormalizedProvider,
        compiler: CompilerContext,
        resolveDependenciesFrom: InjectorModule[],
        ofName: string,
        argPosition: number,
        notFoundFunction: string,
    ): string {
        let of = `${ofName}.${options.name}`;
        const destinationVar = compiler.reserveConst({ token: fromProvider.provide });

        if (options.type.kind === ReflectionKind.class) {
            const found = findModuleForConfig(options.type.classType, resolveDependenciesFrom);
            if (found) {
                return compiler.reserveVariable('fullConfig', getPathValue(found.module.getConfig(), found.path));
            }
        }

        if (options.type.kind === ReflectionKind.class && options.type.classType === TransientInjectionTarget) {
            if (fromProvider.transient === true) {
                const tokenVar = compiler.reserveVariable('token', options.type.classType);
                const orThrow = options.optional
                    ? ''
                    : `?? transientInjectionTargetUnavailable(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;
                return `createTransientInjectionTarget(destination) ${orThrow}`;
            } else {
                throw new Error(
                    `Cannot inject ${TransientInjectionTarget.name} into ${JSON.stringify(ofName)}.${JSON.stringify(options.name)}, as ${JSON.stringify(ofName)} is not transient`,
                );
            }
        }

        if (options.type.kind === ReflectionKind.class && options.type.classType === TagRegistry) {
            return compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);
        }

        if (
            options.type.kind === ReflectionKind.class &&
            resolveDependenciesFrom[0] instanceof options.type.classType
        ) {
            return compiler.reserveConst(resolveDependenciesFrom[0], 'module');
        }

        if (options.type.kind === ReflectionKind.class && isPrototypeOfBase(options.type.classType, Tag)) {
            const tokenVar = compiler.reserveVariable('token', options.type.classType);
            const resolvedVar = compiler.reserveVariable('tagResolved');
            const entries = this.buildContext.tagRegistry.resolve(options.type.classType);
            const args: string[] = [];
            for (const entry of entries) {
                args.push(
                    `${compiler.reserveConst(entry.module)}.injector.resolver(${compiler.reserveConst(getContainerToken(entry.tagProvider.provider.provide))}, scope, ${destinationVar})`,
                );
            }
            return `new ${tokenVar}(${resolvedVar} || (${resolvedVar} = [${args.join(', ')}]))`;
        }

        if (options.type.kind === ReflectionKind.function && options.type.typeName === 'PartialFactory') {
            const type = options.type.typeArguments?.[0];
            const factory = partialFactory(type, this);
            const factoryVar = compiler.reserveConst(factory, 'factory');
            return `${factoryVar}(scope)`;
        }

        if (options.type.kind === ReflectionKind.objectLiteral) {
            const pickArguments = getPickArguments(options.type);
            if (pickArguments) {
                if (pickArguments[0].kind === ReflectionKind.class) {
                    const found = findModuleForConfig(pickArguments[0].classType, resolveDependenciesFrom);
                    if (found) {
                        const fullConfig = compiler.reserveVariable(
                            'fullConfig',
                            getPathValue(found.module.getConfig(), found.path),
                        );
                        let index = pickArguments[1];
                        if (index.kind === ReflectionKind.literal) {
                            index = { kind: ReflectionKind.union, types: [index] };
                        }
                        if (index.kind === ReflectionKind.union) {
                            const members: string[] = [];
                            for (const t of index.types) {
                                if (t.kind === ReflectionKind.literal) {
                                    const index = JSON.stringify(t.literal);
                                    members.push(`${index}: ${fullConfig}[${index}]`);
                                }
                            }

                            return `{${members.join(', ')}}`;
                        }
                    }
                }
            }
        }

        if (options.type.indexAccessOrigin) {
            let current = options.type;
            let module = undefined as InjectorModule | undefined;
            const accesses: string[] = [];

            while (current && current.indexAccessOrigin) {
                let found: { module: InjectorModule; path: string } | undefined = undefined;
                if (current.indexAccessOrigin.container.kind === ReflectionKind.class) {
                    found = findModuleForConfig(current.indexAccessOrigin.container.classType, resolveDependenciesFrom);
                }
                if (current.indexAccessOrigin.index.kind === ReflectionKind.literal) {
                    accesses.unshift(`[${JSON.stringify(current.indexAccessOrigin.index.literal)}]`);
                }
                current = current.indexAccessOrigin.container;
                if (found) {
                    module = found.module;
                    if (found.path) accesses.unshift(`[${JSON.stringify(found.path)}]`);
                    break;
                }
            }
            if (module) {
                const fullConfig = compiler.reserveVariable('fullConfig', module.getConfig());
                return `${fullConfig}${accesses.join('')}`;
            }
        }

        let foundPreparedProvider: PreparedProvider | undefined = undefined;
        for (const module of resolveDependenciesFrom) {
            foundPreparedProvider = module.getPreparedProvider(options.type, foundPreparedProvider);
        }

        if (resolveDependenciesFrom[0] !== this.module) {
            //the provider was exported from another module, so we need to check if there is a more specific candidate
            foundPreparedProvider = this.module.getPreparedProvider(options.type, foundPreparedProvider);
        }

        if (!foundPreparedProvider) {
            //go up parent hierarchy
            let current: InjectorModule | undefined = this.module;
            while (current && !foundPreparedProvider) {
                foundPreparedProvider = current.getPreparedProvider(options.type, foundPreparedProvider);
                current = current.parent;
            }
        }

        if (!foundPreparedProvider && options.optional) return 'undefined';
        const fromScope = getScope(fromProvider);

        if (!foundPreparedProvider) {
            if (argPosition >= 0) {
                const argsCheck: string[] = [];
                for (let i = 0; i < argPosition; i++) argsCheck.push('✓');
                argsCheck.push('?');
                of = `${ofName}(${argsCheck.join(', ')})`;
            }

            const type = stringifyType(options.type, { showFullDefinition: false })
                .replace(/\n/g, '')
                .replace(/\s\s+/g, ' ')
                .replace(' & InjectMeta', '');
            if (options.optional) return 'undefined';
            throw new DependenciesUnmetError(
                `Undefined dependency "${options.name}: ${type}" of ${of}. Type has no provider${fromScope ? ' in scope ' + fromScope : ''}.`,
            );
        }

        const tokenVar = compiler.reserveVariable('token', getContainerToken(foundPreparedProvider.token));
        const allPossibleScopes = foundPreparedProvider.providers.map(getScope);
        const unscoped = allPossibleScopes.includes('') && allPossibleScopes.length === 1;
        const foundProviderLabel = foundPreparedProvider.providers
            .map(v => v.provide)
            .map(tokenLabel)
            .join(', ');

        if (!unscoped && !allPossibleScopes.includes(fromScope)) {
            const t = stringifyType(options.type, { showFullDefinition: false });
            throw new DependenciesUnmetError(
                `Dependency '${options.name}: ${t}' of ${of} can not be injected into ${fromScope ? 'scope ' + fromScope : 'no scope'}, ` +
                    `since ${foundProviderLabel} only exists in scope${allPossibleScopes.length === 1 ? '' : 's'} ${allPossibleScopes.join(', ')}.`,
            );
        }

        //when the dependency is FactoryProvider it might return undefined.
        //in this case, if the dependency is not optional, we throw an error.
        const orThrow = options.optional
            ? ''
            : `?? ${notFoundFunction}(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;

        const resolveFromModule = foundPreparedProvider.resolveFrom || foundPreparedProvider.modules[0];
        if (resolveFromModule === this.module) {
            return `injector.resolver(${tokenVar}, scope, ${destinationVar}) ${orThrow}`;
        }
        return `${compiler.reserveConst(resolveFromModule)}.injector.resolver(${tokenVar}, scope, ${destinationVar}) ${orThrow}`;
    }

    createResolver(type: Type, scope?: Scope, label?: string): Resolver<any> {
        const resolveDependenciesFrom = [this.module];
        const optional = isOptional(type);
        if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property) type = type.type;
        if (type.kind === ReflectionKind.parameter) type = type.type;

        type = getInjectOptions(type) || type;

        // if (type.kind === ReflectionKind.union) {
        //     type = type.types.some(v => v.kind !== ReflectionKind.undefined);
        // }

        if (type.kind === ReflectionKind.class) {
            const found = findModuleForConfig(type.classType, resolveDependenciesFrom);
            if (found) return () => getPathValue(found.module.getConfig(), found.path);
        }

        if (type.kind === ReflectionKind.class && type.classType === TagRegistry)
            return () => this.buildContext.tagRegistry;

        if (type.kind === ReflectionKind.class && resolveDependenciesFrom[0] instanceof type.classType) {
            return () => resolveDependenciesFrom[0];
        }

        if (type.kind === ReflectionKind.class && isPrototypeOfBase(type.classType, Tag)) {
            const entries = this.buildContext.tagRegistry.resolve(type.classType);
            const args: any[] = [];
            for (const entry of entries) {
                args.push(entry.module.injector!.resolver!(entry.tagProvider.provider.provide, scope));
            }

            return new type.classType(args);
        }

        if (type.kind === ReflectionKind.function && type.typeName === 'PartialFactory') {
            const factoryType = type.typeArguments?.[0];
            const factory = partialFactory(factoryType, this);
            return (scopeIn?: Scope) => factory(scopeIn);
        }

        if (isWithAnnotations(type)) {
            if (type.kind === ReflectionKind.objectLiteral) {
                const pickArguments = getPickArguments(type);
                if (pickArguments) {
                    if (pickArguments[0].kind === ReflectionKind.class) {
                        const found = findModuleForConfig(pickArguments[0].classType, resolveDependenciesFrom);
                        if (found) {
                            const fullConfig = getPathValue(found.module.getConfig(), found.path);
                            let index = pickArguments[1];
                            if (index.kind === ReflectionKind.literal) {
                                index = { kind: ReflectionKind.union, types: [index] };
                            }
                            if (index.kind === ReflectionKind.union) {
                                const pickedConfig: { [name: string]: any } = {};
                                for (const t of index.types) {
                                    if (t.kind === ReflectionKind.literal) {
                                        const index = JSON.stringify(t.literal);
                                        pickedConfig[index] = fullConfig[index];
                                    }
                                }

                                return () => pickedConfig;
                            }
                        }
                    }
                }
            }

            if (type.indexAccessOrigin) {
                let current = type;
                let config: { [name: string]: any } | undefined = undefined;

                while (current && current.indexAccessOrigin) {
                    if (current.indexAccessOrigin.container.kind === ReflectionKind.class) {
                        const found = findModuleForConfig(
                            current.indexAccessOrigin.container.classType,
                            resolveDependenciesFrom,
                        );
                        if (!found) return () => undefined;
                        config = getPathValue(found.module.getConfig(), found.path);
                    }
                    if (config !== undefined && current.indexAccessOrigin.index.kind === ReflectionKind.literal) {
                        const index = current.indexAccessOrigin.index.literal;
                        config = config[String(index)];
                    }
                    current = current.indexAccessOrigin.container;
                }

                if (config !== undefined) return () => config;
            }
        }

        let foundPreparedProvider: PreparedProvider | undefined = undefined;
        for (const module of resolveDependenciesFrom) {
            foundPreparedProvider = module.getPreparedProvider(type, foundPreparedProvider);
        }

        if (resolveDependenciesFrom[0] !== this.module) {
            //the provider was exported from another module, so we need to check if there is a more specific candidate
            foundPreparedProvider = this.module.getPreparedProvider(type, foundPreparedProvider);
        }

        if (!foundPreparedProvider) {
            //go up parent hierarchy
            let current: InjectorModule | undefined = this.module;
            while (current && !foundPreparedProvider) {
                foundPreparedProvider = current.getPreparedProvider(type, foundPreparedProvider);
                current = current.parent;
            }
        }

        const fromScope = scope ? scope.name : '';

        if (!foundPreparedProvider) {
            if (optional) return () => undefined;
            const t = stringifyType(type, { showFullDefinition: false });
            throw new ServiceNotFoundError(
                `Undefined service "${label ? label + ': ' : ''}${t}". Type has no matching provider in ${fromScope ? 'scope ' + fromScope : 'no scope'}.`,
            );
        }

        // const allPossibleScopes = foundPreparedProvider.providers.map(getScope);
        // const unscoped = allPossibleScopes.includes('') && allPossibleScopes.length === 1;
        //
        // if (!unscoped && !allPossibleScopes.includes(fromScope)) {
        //     const t = stringifyType(type, { showFullDefinition: false });
        //     throw new ServiceNotFoundError(
        //         `Service "${t}" can not be received from ${fromScope ? 'scope ' + fromScope : 'no scope'}, ` +
        //         `since it only exists in scope${allPossibleScopes.length === 1 ? '' : 's'} ${allPossibleScopes.join(', ')}.`
        //     );
        // }

        const resolveFromModule = foundPreparedProvider.resolveFrom || foundPreparedProvider.modules[0];

        return (scopeIn?: Scope) =>
            resolveFromModule.injector!.resolver!(getContainerToken(foundPreparedProvider!.token), scopeIn || scope);
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
    tagRegistry: TagRegistry = new TagRegistry();
    providerIndex: BuildProviderIndex = new BuildProviderIndex();

    /**
     * In the process of preparing providers, each module redirects their
     * global setup calls in this registry.
     */
    globalSetupProviderRegistry: SetupProviderRegistry = new SetupProviderRegistry();
}

export type Resolver<T> = (scope?: Scope) => T;

/**
 * A InjectorContext is responsible for taking a root InjectorModule and build all Injectors.
 *
 * It also can create scopes aka a sub InjectorContext with providers from a particular scope.
 */
export class InjectorContext {
    constructor(
        public rootModule: InjectorModule,
        public readonly scope?: Scope,
        protected buildContext: BuildContext = new BuildContext(),
    ) {}

    resolve<T>(module?: InjectorModule, type?: ReceiveType<T>): Resolver<T> {
        return this.getInjector(module || this.rootModule).createResolver(resolveReceiveType(type), this.scope);
    }

    getOrUndefined<T>(token?: ReceiveType<T> | Token<T>, module?: InjectorModule): ResolveToken<T> | undefined {
        try {
            return this.get(token, module);
        } catch (error) {
            return;
        }
    }

    get<T>(token?: ReceiveType<T> | Token<T>, module?: InjectorModule): ResolveToken<T> {
        const injector = this.getInjector(module || this.rootModule);
        return injector.get(token, this.scope);
    }

    instantiationCount(token: Token, module?: InjectorModule, scope?: string): number {
        return this.getInjector(module || this.rootModule).instantiationCount(
            token,
            this.scope ? this.scope.name : scope,
        );
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

export function injectedFunction<T extends (...args: any) => any>(
    fn: T,
    injector: Injector,
    skipParameters: number = 0,
    type?: Type,
    skipTypeParameters?: number,
): (scope?: Scope, ...args: any[]) => ReturnType<T> {
    type = type || reflect(fn);
    skipTypeParameters = skipTypeParameters === undefined ? skipParameters : skipTypeParameters;
    if (type.kind === ReflectionKind.function || type.kind === ReflectionKind.method) {
        const args: Resolver<any>[] = [];
        for (let i = skipTypeParameters; i < type.parameters.length; i++) {
            args.push(injector.createResolver(type.parameters[i], undefined, type.parameters[i].name));
        }

        if (skipParameters === 0) {
            return ((scope: Scope | undefined) => {
                return fn(...args.map(v => v(scope)));
            }) as any;
        } else if (skipParameters === 1) {
            return ((scope: Scope | undefined, p1: any) => {
                return fn(p1, ...args.map(v => v(scope)));
            }) as any;
        } else if (skipParameters === 2) {
            return ((scope: Scope | undefined, p1: any, p2: any) => {
                return fn(p1, p2, ...args.map(v => v(scope)));
            }) as any;
        } else if (skipParameters === 3) {
            return ((scope: Scope | undefined, p1: any, p2: any, p3: any) => {
                return fn(p1, p2, p3, ...args.map(v => v(scope)));
            }) as any;
        } else {
            return ((scope: Scope | undefined, ...input: any[]) => {
                while (input.length !== skipParameters) {
                    input.push(undefined);
                }
                return fn(...input.slice(0, skipParameters), ...args.map(v => v(scope)));
            }) as any;
        }
    }
    return fn;
}

export function partialFactory(type: Type | undefined, injector: Injector) {
    if (!type) throw new Error('Can not create partial factory for undefined type');

    // must be lazy because creating resolvers for types that are never resolved & unresolvable will throw
    function createLazyResolver(type: Type, label?: string): Resolver<any> {
        let resolver: Resolver<any> | undefined = undefined;
        return (scope?: Scope) => {
            if (!resolver) {
                resolver = injector.createResolver(type, scope, label);
            }
            return resolver(scope);
        };
    }

    if (type.kind === ReflectionKind.class) {
        const classType = type.classType;
        const reflectionClass = ReflectionClass.from(classType);

        const args: { name: string; resolve: (scope?: Scope) => ReturnType<Resolver<any>> }[] = [];
        const constructor = reflectionClass.getMethodOrUndefined('constructor');
        if (constructor) {
            for (const parameter of constructor.getParameters()) {
                args.push({
                    name: parameter.name,
                    resolve: createLazyResolver(parameter.getType() as Type, parameter.name),
                });
            }
        }

        const properties = new Map<keyof any, (scope?: Scope) => ReturnType<Resolver<any>>>();
        for (const property of reflectionClass.getProperties()) {
            const tokenType = getInjectOptions(property.type);
            if (!tokenType) continue;

            properties.set(property.getName(), createLazyResolver(tokenType, property.name));
        }

        return (scope?: Scope) =>
            <T>(partial: Partial<{ [K in keyof T]: T[K] }>) => {
                const instance = new classType(...args.map(v => partial[v.name as keyof T] ?? v.resolve(scope)));
                for (const [property, resolve] of properties.entries()) {
                    instance[property] ??= partial[property as keyof T] ?? resolve(scope);
                }
                return instance as T;
            };
    }

    if (type.kind === ReflectionKind.objectLiteral) {
        const properties = new Map<keyof any, (scope?: Scope) => ReturnType<Resolver<any>>>();
        for (const property of type.types) {
            if (property.kind !== ReflectionKind.propertySignature) continue;
            properties.set(property.name, createLazyResolver(property, String(property.name)));
        }

        return (scope?: Scope) =>
            <T>(partial: Partial<{ [K in keyof T]: T[K] }>) => {
                const obj: any = {};
                for (const [property, resolve] of properties.entries()) {
                    obj[property] = partial[property as keyof T] ?? resolve(scope);
                }
                return obj as T;
            };
    }

    throw new Error(`Can not create partial factory for ${stringifyType(type, { showFullDefinition: false })}`);
}
