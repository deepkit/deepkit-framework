import { ClassType, isClass } from '@deepkit/core';
import { AppModule } from '@deepkit/app';
import { createFreeDecoratorContext } from '@deepkit/type';
import { HttpRequest, HttpResponse } from './model';

export type HttpMiddleware = (req: HttpRequest, res: HttpResponse, next: (err?: any) => void) => void;

export interface HttpMiddlewareRoute {
    path?: string;
    pathRegExp?: RegExp;
    httpMethod?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE';
    category?: string;
    excludeCategory?: string;
    group?: string;
    excludeGroup?: string;
};

export class HttpMiddlewareConfig {
    name?: string;
    middlewares: (HttpMiddleware | ClassType)[] = [];

    routes: HttpMiddlewareRoute[] = [];
    excludeRoutes: HttpMiddlewareRoute[] = [];

    order: number = 0;

    controllers: ClassType[] = [];
    excludeControllers: ClassType[] = [];

    routeNames: string[] = [];
    excludeRouteNames: string[] = [];

    timeout: number = 4_000;

    modules: AppModule<any>[] = [];

    selfModule: boolean = false;

    getClassTypes(): ClassType[] {
        const classTypes: ClassType[] = [];
        for (const middleware of this.middlewares) {
            if (isClass(middleware)) classTypes.push(middleware);
        }

        return classTypes;
    }
}

export class HttpMiddlewareApi {
    t = new HttpMiddlewareConfig;

    name(name: string) {
        this.t.name = name;
    }

    for(...middlewares: (HttpMiddleware | ClassType<{ execute: HttpMiddleware }>)[]) {
        this.t.middlewares = middlewares;
    }

    forRoutes(...routes: HttpMiddlewareRoute[]) {
        this.t.routes = routes;
    }

    excludeRoutes(...routes: HttpMiddlewareRoute[]) {
        this.t.excludeRoutes = routes;
    }

    forRouteNames(...names: string[]) {
        this.t.routeNames = names;
    }

    excludeRouteNames(...names: string[]) {
        this.t.excludeRouteNames = names;
    }

    /**
     * When the middleware does not respond (either calling next() or sending headers) withing <timeout> milliseconds,
     * automatically the next is executed and warning printed.
     */
    timeout(timeout: number) {
        this.t.timeout = timeout;
    }

    forControllers(...controllers: ClassType[]) {
        this.t.controllers = controllers;
    }

    excludeControllers(...controllers: ClassType[]) {
        this.t.excludeControllers = controllers;
    }

    /**
     * Per default middlewares are executed in the order they were registered. The default order is 0. A lower order means the middleware is executed earlier.
     */
    order(order: number) {
        this.t.order = order;
    }

    forModules(...modules: AppModule<any, any>[]) {
        this.t.modules = modules;
    }

    /**
     * Limit the middleware to the module where this middleware is defined.
     */
    forSelfModules() {
        this.t.selfModule = true;
    }
}

export const httpMiddleware = createFreeDecoratorContext(HttpMiddlewareApi);

httpMiddleware._fluidFunctionSymbol
