import { AppModule } from '@deepkit/app';
import { ClassType } from '@deepkit/core';

import { HttpRouter, RouteConfig } from './router.js';

export interface HttpRouteFilterRoute {
    path?: string;
    pathRegExp?: RegExp;
    httpMethod?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE';
    category?: string;
    group?: string;
}

export class HttpRouteFilterModel {
    controllers: ClassType[] = [];
    excludeControllers: ClassType[] = [];

    routes: HttpRouteFilterRoute[] = [];
    excludeRoutes: HttpRouteFilterRoute[] = [];

    routeNames: string[] = [];
    excludeRouteNames: string[] = [];

    modules: AppModule<any>[] = [];
    excludeModules: AppModule<any>[] = [];

    moduleClasses: ClassType<AppModule<any>>[] = [];
    excludeModuleClasses: ClassType<AppModule<any>>[] = [];

    reset() {
        this.controllers = [];
        this.excludeControllers = [];

        this.routes = [];
        this.excludeRoutes = [];

        this.routeNames = [];
        this.excludeRouteNames = [];

        this.modules = [];
        this.moduleClasses = [];
    }
}

function match(routeConfig: RouteConfig, route: HttpRouteFilterRoute): boolean {
    if (route.httpMethod && routeConfig.httpMethods.includes(route.httpMethod)) return true;

    if (route.category && route.category !== routeConfig.category) return true;

    if (route.group && routeConfig.groups.includes(route.group)) return true;

    if (route.path || route.pathRegExp) {
        if (!route.pathRegExp && route.path) route.pathRegExp = new RegExp('^' + route.path.replace(/\*/g, '.*') + '$');
        if (route.pathRegExp && route.pathRegExp.test(routeConfig.getFullPath())) return true;
    }

    return false;
}

export class HttpRouterFilterResolver {
    constructor(protected router: HttpRouter) {}

    /**
     * Resolves
     */
    public resolve(filter: HttpRouteFilterModel): RouteConfig[] {
        const result: RouteConfig[] = [];

        outer: for (const routeConfig of this.router.getRoutes()) {
            if (
                filter.controllers.length &&
                routeConfig.action.type === 'controller' &&
                !filter.controllers.includes(routeConfig.action.controller)
            )
                continue;

            if (
                filter.excludeControllers.length &&
                routeConfig.action.type === 'controller' &&
                filter.excludeControllers.includes(routeConfig.action.controller)
            )
                continue;

            if (filter.modules.length) {
                if (!routeConfig.module) continue;
                let found: boolean = false;
                for (const module of filter.modules) {
                    //modules get cloned everywhere, but id is sticky. So we compare that.
                    if (routeConfig.module.id === module.id) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;
            }

            if (filter.excludeModules.length) {
                if (!routeConfig.module) continue;
                for (const module of filter.excludeModules) {
                    //modules get cloned everywhere, but id is sticky. So we compare that.
                    if (routeConfig.module.id === module.id) continue outer;
                }
            }

            if (filter.moduleClasses.length) {
                if (!routeConfig.module) continue;
                let found: boolean = false;
                for (const module of filter.moduleClasses) {
                    if (routeConfig.module instanceof module) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;
            }

            if (filter.excludeModuleClasses.length) {
                if (!routeConfig.module) continue;
                for (const module of filter.excludeModuleClasses) {
                    if (routeConfig.module instanceof module) continue outer;
                }
            }

            if (filter.routeNames.length) {
                let found: boolean = false;
                for (const name of filter.routeNames) {
                    if (name.includes('*')) {
                        const regex = new RegExp('^' + name.replace(/\*/g, '.*') + '$');
                        if (regex.test(routeConfig.name)) {
                            found = true;
                            break;
                        }
                    } else if (name === routeConfig.name) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;
            }

            if (filter.excludeRouteNames.length) {
                for (const name of filter.excludeRouteNames) {
                    if (name.includes('*')) {
                        const regex = new RegExp('^' + name.replace(/\*/g, '.*') + '$');
                        if (regex.test(routeConfig.name)) continue outer;
                    } else if (name == routeConfig.name) {
                        continue outer;
                    }
                }
            }

            if (filter.routes.length) {
                let found: boolean = false;
                for (const route of filter.routes) {
                    if (match(routeConfig, route)) {
                        found = true;
                    }
                }
                if (!found) continue;
            }

            for (const route of filter.excludeRoutes) {
                if (match(routeConfig, route)) continue outer;
            }

            result.push(routeConfig);
        }

        return result;
    }
}

/**
 * A class to describe a filter for routes.
 */
export class HttpRouteFilter {
    public model = new HttpRouteFilterModel();

    reset(): this {
        this.model.reset();
        return this;
    }

    forControllers(...controllers: ClassType[]): this {
        this.model.controllers.push(...controllers);
        return this;
    }

    excludeControllers(...controllers: ClassType[]): this {
        this.model.excludeControllers.push(...controllers);
        return this;
    }

    forRoutes(...routes: HttpRouteFilterRoute[]): this {
        this.model.routes.push(...routes);
        return this;
    }

    excludeRoutes(...routes: HttpRouteFilterRoute[]): this {
        this.model.excludeRoutes.push(...routes);
        return this;
    }

    forRouteNames(...names: string[]): this {
        this.model.routeNames.push(...names);
        return this;
    }

    excludeRouteNames(...names: string[]): this {
        this.model.excludeRouteNames.push(...names);
        return this;
    }

    forModules(...modules: AppModule<any>[]): this {
        this.model.modules.push(...modules);
        return this;
    }

    excludeModules(...modules: AppModule<any>[]): this {
        this.model.excludeModules.push(...modules);
        return this;
    }

    forModuleClasses(...moduleClasses: ClassType<AppModule<any>>[]): this {
        this.model.moduleClasses.push(...moduleClasses);
        return this;
    }

    excludeModuleClasses(...moduleClasses: ClassType<AppModule<any>>[]): this {
        this.model.excludeModuleClasses.push(...moduleClasses);
        return this;
    }
}
