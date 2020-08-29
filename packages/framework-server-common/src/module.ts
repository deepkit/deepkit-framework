import {ClassType, isClass} from '@super-hornet/core';
import {InjectToken} from './injector/injector';
import {ProviderWithScope} from './service-container';
import {ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, mergeDecorator, PropertyDecoratorResult} from '@super-hornet/marshal';
import {join} from 'path';

export interface ModuleOptions {
    /**
     * Providers.
     */
    providers?: ProviderWithScope[];
    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: (ClassType | InjectToken | string | DynamicModule)[];

    /**
     * RPC controllers.
     */
    controllers?: ClassType[];

    /**
     * Import another module.
     */
    imports?: (ClassType | DynamicModule)[];
}

export interface DynamicModule extends ModuleOptions {
    /**
     * Imports this module as if the root AppModule has imported it
     */
    root?: boolean;

    module: ClassType;
}

export function isDynamicModuleObject(obj: any): obj is DynamicModule {
    return obj.module;
}

export function isModuleToken(obj: any): obj is (ClassType | DynamicModule) {
    return (isClass(obj) && undefined !== hornet._fetch(obj)) || isDynamicModuleObject(obj);
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
     */
    onBootstrap?: () => Promise<void> | void;

    /**
     * Called when the application bootstraps only for the main process.
     * The applications waits for the promise to resolve before bootstrapping completely.
     *
     * Note this is called once per machine. Use `onBootstrap` to
     *
     * If you want to bootstrap something only once for your entire distributed
     * stack, consider using @super-hornet/exchange, which has an AppLock.
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

class Hornet {
    config?: ModuleOptions;
}

export const hornet = createClassDecoratorContext(
    class {
        t = new Hornet;

        module(config: ModuleOptions) {
            this.t.config = config;
        }
    }
);

class HttpController {
    baseUrl: string = '';
    actions: HttpAction[] = [];

    getUrl(action: HttpAction): string {
        return join('/', this.baseUrl, action.path);
    }
}

class HttpAction {
    name: string = '';
    path: string = '';
    httpMethod: string = 'GET';
    methodName: string = '';

    parameterRegularExpressions: {[name: string]: any} = {};

    throws: {errorType: ClassType, message?: string}[] = [];
}

class HttpDecorator {
    t = new HttpController;

    controller(baseUrl: string = '') {
        this.t.baseUrl = baseUrl;
    }

    addAction(action: HttpAction) {
        this.t.actions.push(action);
    }
}

export const httpClass: ClassDecoratorResult<typeof HttpDecorator> = createClassDecoratorContext(HttpDecorator);

class HttpActionDecorator {
    t = new HttpAction;

    onDecorator(target: object, property?: string) {
        this.t.methodName = property || '';
        httpClass.addAction(this.t)(target);
    }

    name(name: string) {
        this.t.name = name;
    }

    GET(path: string = '') {
        this.t.httpMethod = 'GET';
        this.t.path = path;
    }

    POST(path: string = '') {
        this.t.httpMethod = 'POST';
        this.t.path = path;
    }

    PUT(path: string = '') {
        this.t.httpMethod = 'PUT';
        this.t.path = path;
    }

    DELETE(path: string = '') {
        this.t.httpMethod = 'DELETE';
        this.t.path = path;
    }

    ANY(path: string = '') {
        this.t.httpMethod = 'ANY';
        this.t.path = path;
    }

    throws(errorType: ClassType, message?: string) {
        this.t.throws.push({errorType, message});
    }

    regexp(parameterName: string, regex: any) {
        this.t.parameterRegularExpressions[parameterName] = regex;
    }
}

export const httpAction: PropertyDecoratorResult<typeof HttpActionDecorator> = createPropertyDecoratorContext(HttpActionDecorator);

export const http = mergeDecorator(httpClass, httpAction);
