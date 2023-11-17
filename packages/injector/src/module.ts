import { NormalizedProvider, ProviderWithScope, TagProvider, Token } from './provider.js';
import { arrayRemoveItem, ClassType, getClassName, isClass, isPlainObject, isPrototypeOfBase } from '@deepkit/core';
import { BuildContext, Injector, SetupProviderRegistry } from './injector.js';
import {
    hasTypeInformation,
    isExtendable,
    isType,
    ReceiveType,
    reflect,
    ReflectionKind,
    reflectOrUndefined,
    resolveReceiveType,
    TypeClass,
    TypeObjectLiteral,
    visit
} from '@deepkit/type';
import { nominalCompatibility } from './types.js';

export type ConfigureProvider<T> = { [name in keyof T]: T[name] extends (...args: infer A) => any ? (...args: A) => ConfigureProvider<T> : T[name] };

/**
 * Returns a configuration object that reflects the API of the given ClassType or token. Each call
 * is scheduled and executed once the provider has been created by the dependency injection container.
 */
export function setupProvider<T>(token: Token, registry: SetupProviderRegistry, order: number): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
    const proxy = new Proxy({}, {
        get(target, prop) {
            return (...args: any[]) => {
                registry.add(token, { type: 'call', methodName: prop, args: args, order });
                return proxy;
            };
        },
        set(target, prop, value) {
            registry.add(token, { type: 'property', property: prop, value: value, order });
            return true;
        }
    });

    return proxy as any;
}

let moduleIds: number = 0;

export interface PreparedProvider {
    token: Token;

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

function lookupPreparedProviders(preparedProviders: PreparedProvider[], token: Token): PreparedProvider | undefined {
    let last: PreparedProvider | undefined;
    for (const preparedProvider of preparedProviders) {
        if (token === preparedProvider.token || preparedProvider.providers.includes(token)) {
            last = preparedProvider;
        } else if (isType(token)) {
            if (token.kind === ReflectionKind.any || token.kind === ReflectionKind.unknown) continue;
            if (token.kind === ReflectionKind.function && token.function && token.function === preparedProvider.token) last = preparedProvider;
            const preparedProviderType = isClass(preparedProvider.token) && hasTypeInformation(preparedProvider.token)
                ? reflect(preparedProvider.token) : isType(preparedProvider.token) ? preparedProvider.token : undefined;
            if (!preparedProviderType) continue;

            if (token.kind === ReflectionKind.class && preparedProviderType.kind === ReflectionKind.class && token.classType === preparedProviderType.classType) {
                last = preparedProvider;
            } else if ((preparedProviderType.kind === ReflectionKind.class || preparedProviderType.kind === ReflectionKind.objectLiteral) && nominalCompatibility(token, preparedProviderType)) {
                last = preparedProvider;
            }
        } else if (('string' === typeof token || 'number' === typeof token || 'bigint' === typeof token || 'symbol' === typeof token) && isType(preparedProvider.token)) {
            // note: important that we check for preparedProvider.token being isType, otherwise isExtendable uses typeInfer (which does not use cache).
            // we have to call reflect(preparedProvider.token) otherwise, so that the cache is used.
            if (isExtendable(preparedProvider.token, { kind: ReflectionKind.literal, literal: token })) last = preparedProvider;
        }
    }
    return last;
}

function registerPreparedProvider(preparedProviders: PreparedProvider[], modules: InjectorModule[], providers: NormalizedProvider[], replaceExistingScope: boolean = true) {
    const token = providers[0].provide;
    if (token === undefined) {
        throw new Error('token is undefined: ' + JSON.stringify(providers));
    }
    const preparedProvider = lookupPreparedProviders(preparedProviders, token);
    if (preparedProvider) {
        preparedProvider.token = token;
        for (const m of modules) {
            if (preparedProvider.modules.includes(m)) continue;
            preparedProvider.modules.push(m);
        }
        for (const provider of providers) {
            const scope = getScope(provider);
            //check if given provider has an unknown scope, if so set it.
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
        preparedProviders.push({ token, modules, providers: providers.slice() });
    }
}

function isInChildOfConfig(findType: TypeClass | TypeObjectLiteral, inType?: ClassType): string | undefined {
    if (!inType) return;
    const inTypeType = reflect(inType);
    if (inTypeType.kind !== ReflectionKind.class && inTypeType.kind !== ReflectionKind.objectLiteral) return;

    let found: string | undefined = undefined;
    visit(inTypeType, (type, path): false | void => {
        if (type === findType) {
            found = path;
            return false;
        } else if (type.kind === ReflectionKind.class && findType.kind === ReflectionKind.class && type.classType === findType.classType) {
            found = path;
            return false;
        }
    });

    return found;
}

export function findModuleForConfig(config: ClassType, modules: InjectorModule[]): { module: InjectorModule, path: string } | undefined {
    //go first through first level tree, then second, the third, etc., until no left
    const next: InjectorModule[] = modules.slice();

    const configType = reflectOrUndefined(config);
    if (!configType) return;

    if (configType.kind !== ReflectionKind.class && configType.kind !== ReflectionKind.objectLiteral) return;

    while (next.length) {
        const iterateOver: InjectorModule[] = next.slice();
        next.length = 0;

        for (const m of iterateOver) {
            if (m.configDefinition === config) return { module: m, path: '' };
            const foundInChild = isInChildOfConfig(configType, m.configDefinition);
            if (foundInChild) return { module: m, path: foundInChild };

            let parent = m.parent;
            while (parent) {
                if (parent.configDefinition === config) return { module: parent, path: '' };
                const foundInChild = isInChildOfConfig(configType, parent.configDefinition);
                if (foundInChild) return { module: parent, path: foundInChild };
                parent = parent.parent;
            }
            next.push(...m.imports);
        }
    }

    return undefined;
}

export type ExportType = Token | InjectorModule;


export function isProvided<T>(providers: ProviderWithScope[], token: Token<T>): boolean {
    return providers.some(v => !(v instanceof TagProvider) ? token === (isClass(v) ? v : v.provide) : false);
}

export function getScope(provider: ProviderWithScope): string {
    return (isClass(provider) ? '' : provider instanceof TagProvider ? provider.provider.scope : provider.scope) || '';
}

/**
 * @reflection never
 */
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
     * When the module exports providers the importer doesn't want, then `disableExports` disable all exports.
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

    addExport(...types: (ExportType | ExportType[])[]): this {
        this.assertInjectorNotBuilt();
        this.exports.push(...types.flat());
        return this;
    }

    isExported(token: Token): boolean {
        return this.exports.includes(token);
    }

    isProvided<T>(token?: Token<T>, type?: ReceiveType<T>): boolean {
        if (!token) {
            token = resolveReceiveType(type);
        }
        return isProvided<T>(this.getProviders(), token);
    }

    addProvider(...provider: (ProviderWithScope | ProviderWithScope[])[]): this {
        this.assertInjectorNotBuilt();
        this.providers.push(...provider.flat());
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
    setupProvider<T>(order: number = 0, classTypeOrToken?: ReceiveType<T>): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(resolveReceiveType(classTypeOrToken), this.setupProviderRegistry, order);
    }

    /**
     * Allows to register additional setup calls for a provider in the whole module tree.
     * The injector token needs to be available in the local module providers.
     *
     * Returns a object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider is created by the dependency injection container.
     */
    setupGlobalProvider<T>(order: number = 0, classTypeOrToken?: ReceiveType<T>): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(resolveReceiveType(classTypeOrToken), this.globalSetupProviderRegistry, order);
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

    protected preparedProviders?: PreparedProvider[];

    getPreparedProvider(token: Token): PreparedProvider | undefined {
        if (!this.preparedProviders) return;
        return lookupPreparedProviders(this.preparedProviders, token);
    }

    resolveToken(token: Token): InjectorModule | undefined {
        const found = this.getPreparedProvider(token);
        if (found) return this;
        if (this.parent) return this.parent.resolveToken(token);
        return;
    }

    getBuiltPreparedProviders(): PreparedProvider[] | undefined {
        return this.preparedProviders;
    }

    /**
     * Prepared the module for an injector tree build.
     *
     *  - Index providers by token so that last known provider is picked (so they can be overwritten).
     *  - Register TagProvider in TagRegistry
     *  - Put TagProvider in providers if not already made.
     *  - Put exports to parent's module with the reference to this, so the dependencies are fetched from the correct module.
     */
    getPreparedProviders(buildContext: BuildContext): PreparedProvider[] {
        if (this.preparedProviders) return this.preparedProviders;

        for (const m of this.imports) {
            m.getPreparedProviders(buildContext);
        }

        this.preparedProviders = [];

        this.globalSetupProviderRegistry.mergeInto(buildContext.globalSetupProviderRegistry);

        //make sure that providers that declare the same provider token will be filtered out so that the last will be used.
        for (const provider of this.providers) {
            if (!provider) continue;
            if (provider instanceof TagProvider) {
                buildContext.tagRegistry.register(provider, this);

                if (!lookupPreparedProviders(this.preparedProviders, provider.provider.provide)) {
                    //we don't want to overwrite that provider with a tag
                    registerPreparedProvider(this.preparedProviders, [this], [provider.provider]);
                }
            } else if (isClass(provider)) {
                registerPreparedProvider(this.preparedProviders, [this], [{ provide: provider }]);
            } else if (isPlainObject(provider)) {
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

        const exportToken = (token: ExportType, to: InjectorModule) => {
            if (!this.preparedProviders) return;

            const preparedProvider = lookupPreparedProviders(this.preparedProviders, token);
            //if it was not in provider, we continue
            if (!preparedProvider) return;

            //mark this provider as redirect to `exportTo`
            preparedProvider.resolveFrom = to;

            const parentProviders = to.getPreparedProviders(buildContext);
            const parentProvider = lookupPreparedProviders(parentProviders, token);
            //if the parent has this token already defined, we just switch its module to ours,
            //so it's able to inject our encapsulated services.
            if (parentProvider) {
                //we add our module as additional source for potential dependencies
                registerPreparedProvider(parentProviders, preparedProvider.modules, preparedProvider.providers, false);
            } else {
                parentProviders.push({ token: preparedProvider.token, modules: [this], providers: preparedProvider.providers.slice() });
            }
        };

        if (this.root) {
            const root = this.findRoot();
            if (root !== this) {
                for (const prepared of this.preparedProviders) {
                    exportToken(prepared.token, root);
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
                    for (const preparedProvider of this.preparedProviders) {
                        if (preparedProvider.modules.includes(moduleInstance)) {
                            //this provider was received from `entry`

                            //mark this provider as redirect to `exportTo`
                            preparedProvider.resolveFrom = this.parent;

                            const parentProviders = this.parent.getPreparedProviders(buildContext);
                            const parentProvider = lookupPreparedProviders(parentProviders, preparedProvider.token);
                            //if the parent has this token already defined, we just switch its module to ours,
                            //so it's able to inject our encapsulated services.
                            if (parentProvider) {
                                //we add our module as additional source for potential dependencies
                                registerPreparedProvider(parentProviders, preparedProvider.modules, preparedProvider.providers, false);
                            } else {
                                parentProviders.push({
                                    token: preparedProvider.token,
                                    modules: [this, ...preparedProvider.modules],
                                    providers: preparedProvider.providers.slice()
                                });
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
