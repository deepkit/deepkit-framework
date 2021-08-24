import { InjectorModule } from './module';
import { getProviders, ProviderWithScope, TagRegistry } from './provider';
import { ClassType, getClassName } from '@deepkit/core';
import {
    BasicInjector,
    ConfigDefinition,
    ConfiguredProviderRegistry,
    ConfigureProvider,
    Context,
    ContextRegistry,
    Injector,
    ScopedContextCache,
    ScopedContextScopeCaches
} from './injector';

/**
 * Returns a configuration object that reflects the API of the given ClassType or token. Each call
 * is scheduled and executed once the provider has been created by the dependency injection container.
 */
export function setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, registry: ConfiguredProviderRegistry, order: number): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
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

export class InjectorContext implements BasicInjector {
    protected injectors: (Injector | undefined)[] = new Array(this.contextManager.contexts.length);
    public readonly scopeCaches: ScopedContextScopeCaches;
    protected cache: ScopedContextCache;

    constructor(
        public readonly contextManager: ContextRegistry = new ContextRegistry,
        public readonly scope: string = 'module',
        public readonly configuredProviderRegistry: ConfiguredProviderRegistry = new ConfiguredProviderRegistry,
        public readonly parent: InjectorContext | undefined = undefined,
        public readonly additionalInjectorParent: Injector | undefined = undefined,
        scopeCaches?: ScopedContextScopeCaches,
        public tagRegistry: TagRegistry = new TagRegistry(),
    ) {
        this.scopeCaches = scopeCaches || new ScopedContextScopeCaches(this.contextManager.size);
        this.cache = this.scopeCaches.getCache(this.scope);
    }

    registerModule(module: InjectorModule, config?: ConfigDefinition<any>) {
        if (config) config.setModuleClass(module);

        const context = this.contextManager.create(module);
        module.setContextId(context.id);

        for (const [provider, calls] of module.getConfiguredProviderRegistry().calls) {
            this.configuredProviderRegistry.add(provider, ...calls);
        }

        return context;
    }

    /**
     * Returns a configuration object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider has been created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.configuredProviderRegistry, order);
    }

    static forProviders(providers: ProviderWithScope[], module: InjectorModule = new InjectorModule('', {})) {
        const registry = new ContextRegistry();
        const context = new Context(module, 0);
        module.setContextId(0);
        registry.add(context);
        context.providers.push(...providers);
        return new InjectorContext(registry);
    }

    public getModuleForModuleClass(moduleClass: ClassType<InjectorModule>): InjectorModule {
        for (const context of this.contextManager.contexts) {
            if (context.module instanceof moduleClass) return context.module;
        }
        throw new Error(`No imported module found for module ${getClassName(moduleClass)}. It seems that module was never imported.`);
    }


    public getInjectorForModuleClass(moduleClass: ClassType<InjectorModule>): Injector {
        for (const context of this.contextManager.contexts) {
            if (context.module instanceof moduleClass) return this.getInjector(context.id);
        }
        throw new Error(`No injector found for module ${getClassName(moduleClass)}. It seems that module was never imported.`);
    }

    public getInjectorForModule(module: InjectorModule): Injector {
        const contextId = module.hasContextId() ? module.getContextId() : this.contextManager.contextLookup[module.id];
        if (contextId === undefined || contextId === -1) {
            throw new Error(`No context found for module ${getClassName(module)}#${module.id}. It seems that particular instance was not imported.`);
        }
        return this.getInjector(contextId);
    }

    public getModuleForModule(module: InjectorModule): InjectorModule<any, any> {
        const contextId = module.hasContextId() ? module.getContextId() : this.contextManager.contextLookup[module.id];
        const context = this.contextManager.contexts[contextId];
        if (!context) {
            throw new Error(`No context found for module ${getClassName(module)}#${module.id}. It seems that particular instance was not imported.`);
        }
        return this.contextManager.contexts[contextId].module;
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

        injector = new Injector(providers, parents, this, this.configuredProviderRegistry, this.tagRegistry, undefined, context);
        this.injectors[contextId] = injector;
        this.cache.set(contextId, injector);

        return injector;
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, frontInjector?: Injector): R {
        const injector = this.getInjector(0);
        return injector.get(token, frontInjector);
    }

    public createChildScope(scope: string, additionalInjectorParent?: Injector): InjectorContext {
        return new InjectorContext(this.contextManager, scope, this.configuredProviderRegistry, this, additionalInjectorParent, this.scopeCaches, this.tagRegistry);
    }
}
