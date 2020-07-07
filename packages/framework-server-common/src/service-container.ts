import {ClassType, getClassName, isClass} from "@super-hornet/core";
import {DynamicModule, getModuleOptions, isDynamicModuleObject, isModuleToken, SuperHornetModule,} from "./module";
import {
    Injector,
    isClassProvider,
    isExistingProvider,
    isFactoryProvider,
    isValueProvider,
    tokenLabel
} from './injector/injector';
import {Provider, ProviderProvide, TypeProvider} from "./injector/provider";

export interface ProviderScope {
    scope?: 'module' | 'session' | 'request';
}

export interface ProviderSingleScope extends ProviderScope {
    provide: any;
}

export type ProviderWithScope = TypeProvider | (ProviderProvide & ProviderScope) | ProviderSingleScope;


export function isInjectionProvider(obj: any): obj is Provider {
    return isValueProvider(obj) || isClassProvider(obj) || isExistingProvider(obj) || isFactoryProvider(obj);
}

export function isProviderSingleScope(obj: any): obj is ProviderSingleScope {
    return obj.provide !== undefined && !isInjectionProvider(obj);
}


function getProviders(
    providers: ProviderWithScope[],
    requestScope: 'module' | 'session' | 'request' | string,
) {
    const result: Provider[] = [];

    function normalize(provider: ProviderWithScope): Provider {
        if (isClass(provider)) {
            return provider;
        }

        if (isProviderSingleScope(provider)) {
            return {provide: provider.provide, useClass: provider.provide};
        }

        return provider;
    }

    for (const provider of providers) {
        if (isClass(provider)) {
            if (requestScope === 'module') result.push(provider);
            continue;
        }

        const scope = provider.scope || 'module';
        if (scope === requestScope) {
            result.push(normalize(provider));
        }
    }

    return result;
}

class Context {
    providers: ProviderWithScope[] = [];
    children: Context[] = [];
    parent?: Context;
    injector?: Injector;

    constructor(public readonly id: number) {
    }

    getInjector(): Injector {
        if (!this.injector) {
            const providers = getProviders(this.providers, 'module');
            if (this.parent) {
                this.injector = new Injector(providers, [this.parent.getInjector()]);
            } else {
                this.injector = new Injector(providers);
            }
        }

        return this.injector;
    }

    createInjector(scope: string, additionalProviders: Provider[] = []): Injector {
        const providers = getProviders(this.providers, scope);
        providers.push(...additionalProviders);
        if (this.parent) {
            return new Injector(providers, [this.getInjector(), this.parent.createInjector(scope)]);
        } else {
            return new Injector(providers, [this.getInjector()]);
        }
    }
}

interface ContextAwareInjectorGetter {
    (context: number, token: any): any;
}

export class ControllersRef {
    public readonly controllersContext = new Map<ClassType<any>, number>();

    constructor(protected getter: ContextAwareInjectorGetter) {
    }

    public getController<T>(classType: ClassType<T>): T {
        return this.getter(this.controllersContext.get(classType)!, classType);
    }
}

export class ServiceContainer {
    protected controllersRef = new ControllersRef((context, token) => {
        return this.getContext(context).getInjector().get(token);
    });

    protected currentIndexId = 0;

    protected contexts = new Map<number, Context>();

    protected rootContext?: Context;
    protected moduleContexts = new Map<ClassType<any>, Context[]>();

    public processRootModule(
        appModule: ClassType<any> | DynamicModule,
        providers: ProviderWithScope[] = [],
        imports: (ClassType<any> | DynamicModule)[] = []
    ) {
        providers.push({provide: ServiceContainer, useValue: this});
        providers.push({provide: ControllersRef, useValue: this.controllersRef});

        this.rootContext = this.processModule(appModule, undefined, providers, imports);
    }

    public getRootContext(): Context {
        if (!this.rootContext) throw new Error(`No root context created yet.`);
        return this.rootContext;
    }

    getRegisteredModules(): SuperHornetModule[] {
        const result: SuperHornetModule[] = [];
        for (const [module, contexts] of this.moduleContexts.entries()) {
            for (const context of contexts) {
                result.push(context.getInjector().get(module));
            }
        }
        return result;
    }

    public getContextsForModule(module: ClassType<any>): Context[] {
        return this.moduleContexts.get(module) || [];
    }

    protected getContext(id: number): Context {
        const context = this.contexts.get(id);
        if (!context) throw new Error(`No context for ${id} found`);

        return context;
    }

    protected getNewContext(module: ClassType<any>, parent?: Context): Context {
        const newId = this.currentIndexId++;
        const context = new Context(newId);
        this.contexts.set(newId, context);

        if (parent) {
            parent.children.push(context);
            context.parent = parent;
        }

        let contexts = this.moduleContexts.get(module);
        if (!contexts) {
            contexts = [];
            this.moduleContexts.set(module, contexts);
        }

        contexts.push(context);
        return context;
    }

    /**
     * Fill `moduleHierarchy` correctly and recursively.
     */
    protected processModule(
        appModule: ClassType<any> | DynamicModule,
        parentContext?: Context,
        additionalProviders: ProviderWithScope[] = [],
        additionalImports: (ClassType<any> | DynamicModule)[] = []
    ): Context {
        let module = isDynamicModuleObject(appModule) ? appModule.module : appModule;
        let options = getModuleOptions(module);
        if (!options) throw new Error(`Module ${getClassName(module)} has no @Module decorator`);

        const exports = options.exports ? options.exports.slice(0) : [];
        const providers = options.providers ? options.providers.slice(0) : [];
        const controllers = options.controllers ? options.controllers.slice(0) : [];
        const imports = options.imports ? options.imports.slice(0) : [];

        //if the module is a DynamicModule, its providers/exports/controllers are added to the base
        if (isDynamicModuleObject(appModule)) {
            if (appModule.providers) providers.push(...appModule.providers);
            if (appModule.exports) exports.push(...appModule.exports);
            if (appModule.controllers) controllers.push(...appModule.controllers);
            if (appModule.imports) imports.push(...appModule.imports);
        }

        providers.push(...additionalProviders);
        imports.push(...additionalImports);

        //we add the module to its own providers so it can depend on its module providers.
        //when we would add it to root it would have no access to its internal providers.
        providers.push(module);

        const forRootContext = isDynamicModuleObject(appModule) && appModule.root === true;

        //we have to call getNewContext() either way to store this module in this.contexts.
        let context = this.getNewContext(module, parentContext);
        if (forRootContext) {
            context = this.getContext(0);
        }

        for (const imp of imports) {
            this.processModule(imp, context);
        }

        if (options.controllers) {
            for (const controller of options.controllers) {
                this.controllersRef.controllersContext.set(controller, context.id);
            }
        }

        //if there are exported tokens, their providers will be added to the parent or root context
        //and removed from module providers.
        const exportedProviders = forRootContext ? this.getContext(0).providers : (parentContext ? parentContext.providers : []);
        for (const token of exports) {
            if (isModuleToken(token)) {
                //exported a module. We handle it as if the parent would have imported it.
                this.processModule(token, parentContext);
                //a module should never be in providers, so we skip the removal.
                continue;
            }

            const provider = providers.findIndex(v => token === (isClass(v) ? v : v.provide));
            if (provider === -1) {
                throw new Error(`Export ${tokenLabel(token)} not provided in providers.`);
            }
            exportedProviders.push(providers[provider]);
            providers.splice(provider, 1);
        }

        context.providers.push(...providers);

        return context;
    }

}
