import {ClassType, isClass} from '@deepkit/core';
import {InjectToken} from './injector/injector';
import {ProviderWithScope} from './service-container';
import {ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, mergeDecorator, PropertyDecoratorResult} from '@deepkit/marshal';
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

    /**
     * Commands. Classes decorated with @hornet.controller()
     */
    commands?: ClassType[];
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
     * Called when the application bootstraps (for cli commands, rpc/http server, tests, ...)
     *
     * Use onBootstrapServer when you want to execute code only when the rpc/http server starts.
     */
    onBootstrap?: () => void;

    /**
     * Called when the application http server bootstraps.
     * The applications waits for the promise to resolve before bootstrapping completely.
     *
     * Note this is called once per machine.
     *
     * If you want to bootstrap something only once for your entire distributed
     * stack, consider using AppLock.
     */
    onBootstrapServer?: () => Promise<void> | void;

    /**
     * When the applications is shut down. Clean up open resources to not leak memory in unit tests.
     * The applications waits for the promise to resolve before shutting down completely.
     */
    onShutDown?: () => Promise<void> | void;
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

    parameterRegularExpressions: { [name: string]: any } = {};

    throws: { errorType: ClassType, message?: string }[] = [];
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
