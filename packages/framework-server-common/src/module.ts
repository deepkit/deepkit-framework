import {ClassType, isClass, retrieveMetaData, storeMetaData} from "@super-hornet/core";
import {InjectToken} from "./injector/injector";
import {ProviderWithScope} from './service-container';

export interface ModuleOptions {
    /**
     * Providers.
     */
    providers?: ProviderWithScope[];
    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: (ClassType<any> | InjectToken | string | DynamicModule)[];

    /**
     * RPC controllers.
     */
    controllers?: ClassType<any>[];

    /**
     * Import another module.
     */
    imports?: (ClassType<any> | DynamicModule)[];
}

export interface DynamicModule extends ModuleOptions {
    /**
     * Imports this module as if the root AppModule has imported it
     */
    root?: boolean;

    module: ClassType<any>;
}

export function isDynamicModuleObject(obj: any): obj is DynamicModule {
    return obj.module;
}

export function isModuleToken(obj: any): obj is (ClassType<any> | DynamicModule) {
    return (isClass(obj) && undefined !== getModuleOptions(obj)) || isDynamicModuleObject(obj);
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
    onBootstrap?: () => Promise<void> | void;

    /**
     * Called when the application bootstraps only for the main process.
     * The applications waits for the promise to resolve before bootstrapping completely.
     */
    onBootstrapMain?: () => Promise<void> | void;

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
