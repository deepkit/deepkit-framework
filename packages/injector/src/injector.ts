import { isClassProvider, isExistingProvider, isFactoryProvider, isValueProvider, NormalizedProvider, ProviderWithScope, Tag, TagProvider, TagRegistry, Token } from './provider';
import { ClassType, CompilerContext, CustomError, getClassName, isClass, isFunction, isPrototypeOfBase } from '@deepkit/core';
import { findModuleForConfig, getScope, InjectorModule, PreparedProvider } from './module';
import {
    isType,
    isWithAnnotations,
    metaAnnotation,
    OuterType,
    ReflectionClass,
    ReflectionFunction,
    ReflectionKind,
    stringifyShortResolvedType,
    stringifyType
} from '@deepkit/type';


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
function getInjectOptions(type: OuterType): OuterType | undefined {
    const annotations = metaAnnotation.getAnnotations(type);
    for (const annotation of annotations) {
        if (annotation.name === 'inject') {
            const t = annotation.options[0] as OuterType;
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
        const resolverCompiler = new CompilerContext();
        resolverCompiler.context.set('CircularDetector', CircularDetector);
        resolverCompiler.context.set('CircularDetectorResets', CircularDetectorResets);
        resolverCompiler.context.set('throwCircularDependency', throwCircularDependency);
        resolverCompiler.context.set('tokenNotfoundError', tokenNotfoundError);
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
                const scopeObjectCheck = scope ? ` && scope && scope.name === ${JSON.stringify(scope)}` : '';
                const scopeCheck = scope ? ` && scope === ${JSON.stringify(scope)}` : '';

                setterLines.push(`case token === ${setterCompiler.reserveVariable('token', token)}${scopeObjectCheck}: {
                    if (${accessor} === undefined) {
                        injector.instantiated.${name} = injector.instantiated.${name} ? injector.instantiated.${name} + 1 : 1;
                    }
                    ${accessor} = value;
                    break;
                }`);

                if (prepared.resolveFrom) {
                    //its a redirect
                    lines.push(`
                    case token === ${resolverCompiler.reserveConst(token, 'token')}${scopeObjectCheck}: {
                        return ${resolverCompiler.reserveConst(prepared.resolveFrom, 'resolveFrom')}.injector.resolver(${resolverCompiler.reserveConst(token, 'token')}, scope);
                    }
                    `);

                    instantiationLines.push(`
                    case token === ${instantiationCompiler.reserveConst(token, 'token')}${scopeCheck}: {
                        return ${instantiationCompiler.reserveConst(prepared.resolveFrom, 'resolveFrom')}.injector.instantiations(${instantiationCompiler.reserveConst(token, 'token')}, scope);
                    }
                    `);
                } else {
                    //we own and instantiate the service
                    lines.push(this.buildProvider(buildContext, resolverCompiler, name, accessor, scope, provider, prepared.modules));

                    instantiationLines.push(`
                    case token === ${instantiationCompiler.reserveConst(token, 'token')}${scopeCheck}: {
                        return injector.instantiated.${name} || 0;
                    }
                    `);
                }
            }
        }

        this.instantiations = instantiationCompiler.build(`
            //for ${getClassName(this.module)}
            switch (true) {
                ${instantiationLines.join('\n')}
            }
            return 0;
        `, 'token', 'scope');

        this.setter = setterCompiler.build(`
            //for ${getClassName(this.module)}
            switch (true) {
                ${setterLines.join('\n')}
            }
        `, 'token', 'value', 'scope');

        this.resolver = resolverCompiler.raw(`
            //for ${getClassName(this.module)}
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
            const reflection = ReflectionFunction.from(provider.useFactory);

            for (const dep of reflection.getParameters()) {
                factory.dependencies++;
                args.push(this.createFactoryProperty({
                    name: dep.name,
                    type: dep.type,
                    optional: dep.optional === true,
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
                            const injector = arg.module ? compiler.reserveConst(arg.module) + '.injector' : 'injector';
                            args.push(`${injector}.resolver(${compiler.reserveConst(arg.to)}, scope)`);
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
        resolveDependenciesFrom: InjectorModule[]
    ): { code: string, dependencies: number } {
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
                const tokenType = getInjectOptions(parameter.getType() as OuterType);
                args.push(this.createFactoryProperty({
                    name: parameter.name,
                    type: tokenType || parameter.getType() as OuterType,
                    optional: parameter.isOptional()
                }, provider, compiler, resolveDependenciesFrom, getClassName(classType), args.length, 'constructorParameterNotFound'));
            }
        }

        for (const property of reflectionClass.getProperties()) {
            const tokenType = getInjectOptions(property.type);
            if (!tokenType) continue;

            dependencies++;
            try {
                const resolveProperty = this.createFactoryProperty({
                    name: property.name,
                    type: tokenType,
                    optional: property.isOptional()
                }, provider, compiler, resolveDependenciesFrom, getClassName(classType), -1, 'propertyParameterNotFound');
                propertyAssignment.push(`${resolvedName}.${String(property.getName())} = ${resolveProperty};`);
            } catch (error: any) {
                throw new Error(`Could not resolve property injection token ${getClassName(classType)}.${String(property.getName())}: ${error.message}`);
            }
        }

        return {
            code: `${resolvedName} = new ${classTypeVar}(${args.join(',')});\n${propertyAssignment.join('\n')}`,
            dependencies
        };
    }

    protected createFactoryProperty(
        options: { name: string, type: OuterType, optional: boolean },
        fromProvider: NormalizedProvider,
        compiler: CompilerContext,
        resolveDependenciesFrom: InjectorModule[],
        ofName: string,
        argPosition: number,
        notFoundFunction: string
    ): string {
        let of = `${ofName}.${options.name}`;
        // const token = options.type.kind === ReflectionKind.class ? options.type.classType : undefined;
        //
        // //regarding configuration values: the attached module is not necessarily in resolveDependenciesFrom[0]
        // //if the parent module overwrites its, then the parent module is at 0th position.
        // if (isClass(token) && resolveDependenciesFrom[0] instanceof token) {
        //     return compiler.reserveConst(resolveDependenciesFrom[0], 'module');
        //     // } else if (token instanceof ConfigDefinition) {
        //     //     try {
        //     //         const module = findModuleForConfig(token, resolveDependenciesFrom);
        //     //         return compiler.reserveVariable('fullConfig', module.getConfig());
        //     //     } catch (error) {
        //     //         throw new DependenciesUnmetError(`Undefined configuration dependency '${options.name}' of ${of}. ${error.message}`);
        //     //     }
        //     // } else if (token instanceof ConfigToken) {
        //     //     try {
        //     //         const module = findModuleForConfig(token.config, resolveDependenciesFrom);
        //     //         const config = module.getConfig();
        //     //         return compiler.reserveVariable(token.name, (config as any)[token.name]);
        //     //     } catch (error) {
        //     //         throw new DependenciesUnmetError(`Undefined configuration dependency '${options.name}' of ${of}. ${error.message}`);
        //     //     }
        //     // } else if (isClass(token) && (Object.getPrototypeOf(Object.getPrototypeOf(token)) === ConfigSlice || Object.getPrototypeOf(token) === ConfigSlice)) {
        //     //     try {
        //     //         const value: ConfigSlice<any> = new token;
        //     //         const module = findModuleForConfig(value.config, resolveDependenciesFrom);
        //     //         value.bag = module.getConfig();
        //     //         return compiler.reserveVariable('configSlice', value);
        //     //     } catch (error) {
        //     //         throw new DependenciesUnmetError(`Undefined configuration dependency '${options.name}' of ${of}. ${error.message}`);
        //     //     }
        // } else if (token === TagRegistry) {
        //     return compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);
        // } else if (isPrototypeOfBase(token, Tag)) {
        //     const tokenVar = compiler.reserveVariable('token', token);
        //     const resolvedVar = compiler.reserveVariable('tagResolved');
        //     const entries = this.buildContext.tagRegistry.resolve(token as ClassType<Tag<any>>);
        //     const args: string[] = [];
        //     for (const entry of entries) {
        //         args.push(`${compiler.reserveConst(entry.module)}.injector.resolver(${compiler.reserveConst(entry.tagProvider.provider.provide)}, scope)`);
        //     }
        //     return `new ${tokenVar}(${resolvedVar} || (${resolvedVar} = [${args.join(', ')}]))`;
        // }

        // const tokenVar = compiler.reserveVariable('token', token);

        if (options.type.kind === ReflectionKind.class) {
            const module = findModuleForConfig(options.type.classType, resolveDependenciesFrom);
            if (module) {
                return compiler.reserveVariable('fullConfig', module.getConfig());
            }
        }

        if (options.type.kind === ReflectionKind.class && options.type.classType === TagRegistry) {
            return compiler.reserveVariable('tagRegistry', this.buildContext.tagRegistry);
        }

        if (options.type.kind === ReflectionKind.class && resolveDependenciesFrom[0] instanceof options.type.classType) {
            return compiler.reserveConst(resolveDependenciesFrom[0], 'module');
        }

        if (options.type.kind === ReflectionKind.class && isPrototypeOfBase(options.type.classType, Tag)) {
            const tokenVar = compiler.reserveVariable('token', options.type.classType);
            const resolvedVar = compiler.reserveVariable('tagResolved');
            const entries = this.buildContext.tagRegistry.resolve(options.type.classType);
            const args: string[] = [];
            for (const entry of entries) {
                args.push(`${compiler.reserveConst(entry.module)}.injector.resolver(${compiler.reserveConst(entry.tagProvider.provider.provide)}, scope)`);
            }
            return `new ${tokenVar}(${resolvedVar} || (${resolvedVar} = [${args.join(', ')}]))`;
        }

        if (isWithAnnotations(options.type)) {
            if (options.type.kind === ReflectionKind.objectLiteral) {
                if (options.type.typeName === 'Pick' && options.type.typeArguments && options.type.typeArguments.length === 2) {
                    if (options.type.typeArguments[0].kind === ReflectionKind.class) {
                        const module = findModuleForConfig(options.type.typeArguments[0].classType, resolveDependenciesFrom);
                        if (module) {
                            const fullConfig = compiler.reserveVariable('fullConfig', module.getConfig());
                            let index = options.type.typeArguments[1];
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

            if (isWithAnnotations(options.type) && options.type.indexAccessOrigin) {
                let current = options.type;
                let module = undefined as InjectorModule | undefined;
                const accesses: string[] = [];

                while (current && current.indexAccessOrigin) {
                    if (current.indexAccessOrigin.container.kind === ReflectionKind.class) {
                        module = findModuleForConfig(current.indexAccessOrigin.container.classType, resolveDependenciesFrom);
                    }
                    if (current.indexAccessOrigin.index.kind === ReflectionKind.literal) {
                        accesses.unshift(`[${JSON.stringify(current.indexAccessOrigin.index.literal)}]`);
                    }
                    current = current.indexAccessOrigin.container;
                }
                if (module) {
                    const fullConfig = compiler.reserveVariable('fullConfig', module.getConfig());
                    return `${fullConfig}${accesses.join('')}`;
                }
            }
        }

        let findToken: Token = options.type;
        if (isType(findToken)) {
            if (findToken.kind === ReflectionKind.class) {
                findToken = findToken.classType;
            } else if (findToken.kind === ReflectionKind.literal) {
                findToken = findToken.literal;
            }
        }

        let foundPreparedProvider: { token: Token, provider: PreparedProvider } | undefined = undefined;
        for (const module of resolveDependenciesFrom) {
            foundPreparedProvider = module.getPreparedProvider(findToken);
            if (foundPreparedProvider) {
                if (foundPreparedProvider) {
                    //check if the found provider was actually exported to this current module.
                    //if not it means that provider is encapsulated living only in its module and can not be accessed from other modules.
                    const moduleHasAccessToThisProvider = foundPreparedProvider.provider.modules.some(m => m === module);
                    if (!moduleHasAccessToThisProvider) {
                        foundPreparedProvider = undefined;
                    }
                }
            }
        }

        if (!foundPreparedProvider) {
            //try if parents have anything
            const foundInModule = this.module.resolveToken(findToken);
            if (foundInModule) {
                foundPreparedProvider = foundInModule.getPreparedProvider(findToken);
            }
        }

        if (!foundPreparedProvider && options.optional) return 'undefined';

        if (!foundPreparedProvider) {
            if (argPosition >= 0) {
                const argsCheck: string[] = [];
                for (let i = 0; i < argPosition; i++) argsCheck.push('✓');
                argsCheck.push('?');
                of = `${ofName}(${argsCheck.join(', ')})`;
            }

            const type = stringifyShortResolvedType(options.type).replace(/\n/g, '').replace(/\s\s+/g, ' ').replace(' & InjectMeta', '');
            if (options.optional) return 'undefined';
            throw new DependenciesUnmetError(
                `Undefined dependency "${options.name}: ${type}" of ${of}. Type ${type} has no provider.`
            );

            // throw new DependenciesUnmetError(
            //     `Unknown dependency '${options.name}: ${stringifyType(options.type, { showFullDefinition: false })}' of ${of}.`
            // );
        }

        const tokenVar = compiler.reserveVariable('token', foundPreparedProvider.token);
        const allPossibleScopes = foundPreparedProvider.provider.providers.map(getScope);
        const fromScope = getScope(fromProvider);
        const unscoped = allPossibleScopes.includes('') && allPossibleScopes.length === 1;

        if (!unscoped && !allPossibleScopes.includes(fromScope)) {
            const t = stringifyType(options.type, { showFullDefinition: false });
            throw new DependenciesUnmetError(
                `Dependency '${options.name}: ${t}' of ${of} can not be injected into ${fromScope ? 'scope ' + fromScope : 'no scope'}, ` +
                `since ${t} only exists in scope${allPossibleScopes.length === 1 ? '' : 's'} ${allPossibleScopes.join(', ')}.`
            );
        }

        //when the dependency is FactoryProvider it might return undefined.
        //in this case, if the dependency is not optional, we throw an error.
        const orThrow = options.optional ? '' : `?? ${notFoundFunction}(${JSON.stringify(ofName)}, ${JSON.stringify(options.name)}, ${argPosition}, ${tokenVar})`;

        const resolveFromModule = foundPreparedProvider.provider.resolveFrom || foundPreparedProvider.provider.modules[0];
        if (resolveFromModule === this.module) {
            return `injector.resolver(${tokenVar}, scope)`;
        }
        return `${compiler.reserveConst(resolveFromModule)}.injector.resolver(${tokenVar}, scope) ${orThrow}`;
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
