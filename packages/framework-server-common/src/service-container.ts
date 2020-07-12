import {arrayRemoveItem, ClassType, getClassName, isClass} from "@super-hornet/core";
import {
    DynamicModule,
    getControllerOptions,
    getModuleOptions,
    isDynamicModuleObject,
    isModuleToken,
    SuperHornetModule,
} from "./module";
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

    isRoot(): boolean {
        return this.id === 0;
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

    createSubInjector(scope: string, additionalProviders: Provider[] = [], rootInjector?: Injector): Injector {
        const providers = getProviders(this.providers, scope);
        providers.push(...additionalProviders);
        if (this.parent) {
            if (this.parent.isRoot() && rootInjector) {
                return new Injector(providers, [this.getInjector(), rootInjector]);
            } else {
                return new Injector(providers, [this.getInjector(), this.parent.createSubInjector(scope, [], rootInjector)]);
            }
        } else {
            return new Injector(providers, [this.getInjector()]);
        }
    }
}

export interface OnInit {
    onInit: () => Promise<void>;
}

export interface onDestroy {
    onDestroy: () => Promise<void>;
}

export type SuperHornetController = {
    onDestroy?: () => Promise<void>;
    onInit?: () => Promise<void>;
}

export class ControllerContainer {
    protected sessionInjectors = new Map<number, Injector>();

    constructor(protected serviceContainer: ServiceContainer, protected rootInjector?: Injector) {
    }

    public resolve<T extends (SuperHornetController | object)>(name: string): T {
        const {context, classType} = this.resolveController(name);
        return this.getController(context, classType);
    }

    public resolveController(name: string): { context: number, classType: ClassType<any> } {
        const classType = this.serviceContainer.controllerByName.get(name);
        if (!classType) throw new Error(`Controller not found for ${name}`);
        const context = this.serviceContainer.controllersContext.get(classType) || 0;
        return {context, classType};
    }

    public getController<T extends SuperHornetController>(context: number, classType: ClassType<any>): T {
        let subInjector = this.sessionInjectors.get(context);
        if (!subInjector) {
            subInjector = this.serviceContainer.getContext(context).createSubInjector('session', [], this.rootInjector);
            this.sessionInjectors.set(context, subInjector);
        }

        return subInjector.get(classType);
    }
}

export class ServiceContainer {
    public readonly controllersContext = new Map<ClassType<any>, number>();
    public readonly controllerByName = new Map<string, ClassType<any>>();

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

    public getContext(id: number): Context {
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

        for (const token of exports.slice(0)) {
            if (isModuleToken(token)) {
                //exported modules will be removed from `imports`, so that
                //the target context (root or parent) imports it
                arrayRemoveItem(exports, token);

                //exported a module. We handle it as if the parent would have imported it.
                this.processModule(token, parentContext);
            }
        }

        for (const imp of imports) {
            this.processModule(imp, context);
        }

        if (options.controllers) {
            for (const controller of options.controllers) {
                const options = getControllerOptions(controller);
                if (!options) throw new Error(`Controller ${getClassName(controller)} has no @Controller() decorator`);
                providers.unshift(controller);
                this.controllersContext.set(controller, context.id);
                this.controllerByName.set(options.name, controller);
            }
        }

        //if there are exported tokens, their providers will be added to the parent or root context
        //and removed from module providers.
        const exportedProviders = forRootContext ? this.getContext(0).providers : (parentContext ? parentContext.providers : []);
        for (const token of exports) {
            if (isModuleToken(token)) throw new Error('Should already be handled');

            const provider = providers.findIndex(v => token === (isClass(v) ? v : v.provide));
            if (provider === -1) {
                throw new Error(`Export ${tokenLabel(token)}, but not provided in providers.`);
            }
            exportedProviders.push(providers[provider]);
            providers.splice(provider, 1);
        }

        context.providers.push(...providers);

        return context;
    }

}
