import {Provider} from "injection-js";
import {ClassType, storeMetaData, retrieveMetaData} from "@super-hornet/core";
import {ClassProvider, ExistingProvider, FactoryProvider, ValueProvider} from "injection-js/provider";

export interface ProviderScope {
    scope?: 'root' | 'session' | 'request';
}

export interface ProviderSingleScope {
    scope?: 'root' | 'session' | 'request';
    provide: any;
}

export type ProviderWithScope = (Provider & ProviderScope) | ProviderSingleScope;

export function isValueProvider(obj: any): obj is ValueProvider {
    return obj.provide && obj.useValue;
}

export function isClassProvider(obj: any): obj is ClassProvider {
    return obj.provide && obj.useClass;
}

export function isExistingProvider(obj: any): obj is ExistingProvider {
    return obj.provide && obj.useExisting;
}

export function isFactoryProvider(obj: any): obj is FactoryProvider {
    return obj.provide && obj.useFactory;
}

export function isInjectionProvider(obj: any): obj is Provider {
    return isValueProvider(obj) || isClassProvider(obj) ||  isExistingProvider(obj) ||  isFactoryProvider(obj);
}

export function isProviderSingleScope(obj: any): obj is ProviderSingleScope {
    return obj.provide !== undefined && !isInjectionProvider(obj);
}

export interface ModuleWithProviders {
    module: ClassType<any>;
    providers: ProviderWithScope[];
}

export interface ModuleOptions {
    providers?: ProviderWithScope[];
    controllers?: ClassType<any>[];
    imports?: (ClassType<any> | ModuleWithProviders)[];
}

export function isModuleWithProviders(obj: any): obj is ModuleWithProviders {
    return obj.module;
}

export interface SuperHornetModule {
    /**
     * Called when the application bootstraps for each worker. Usually you have for each CPU core
     * one worker. If you scaled Hornet up across multiple networks, this is called
     * on each machine for each worker.
     * The applications waits for the promise to resolve before bootstrapping completely.
     *
     * If you use Hornet only on one machine, you can use bootstrapMain()
     * to have a hook which is only called once per machine.
     *
     * If you want to bootstrap something only once for your entire distributed
     * stack, consider using @super-hornet/exchange, which has an AppLock.
     */
    bootstrap?: () => Promise<void> | void;

    /**
     * Called when the application bootstraps only for the main process.
     * The applications waits for the promise to resolve before bootstrapping completely.
     */
    bootstrapMain?: () => Promise<void> | void;

    /**
     * When the applications is destroyed. Clean up open resources to not leak memory
     * in unit tests.
     * The applications waits for the promise to resolve before shutting down completely.
     */
    onDestroy?: () => Promise<void> | void;
}

export interface ControllerOptions {
    name: string;
}

export function Module<T>(config: ModuleOptions) {
    return (target: ClassType<T>) => {
        storeMetaData('super-hornet:module', {module: target, ...config}, target);
    };
}

export function getModuleOptions(target: Object): ModuleOptions | undefined {
    return retrieveMetaData('super-hornet:module', target);
}

export function getControllerOptions<T>(target: ClassType<T>): ControllerOptions | undefined {
    return retrieveMetaData('super-hornet:controller', target);
}
