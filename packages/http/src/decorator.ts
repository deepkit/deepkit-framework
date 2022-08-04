/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, isClass, urlJoin } from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    DecoratorAndFetchSignature,
    DualDecorator,
    ExtractApiDataType,
    ExtractClass,
    isDecoratorContext,
    mergeDecorator,
    PropertyDecoratorFn,
    ReceiveType,
    resolveReceiveType,
    SerializationOptions,
    Serializer,
    Type,
    UnionToIntersection
} from '@deepkit/type';
import { RouteParameterResolver } from './router';
import { httpMiddleware, HttpMiddleware, HttpMiddlewareConfig, HttpMiddlewareFn } from './middleware';

type HttpActionMiddleware = (() => HttpMiddlewareConfig) | ClassType<HttpMiddleware> | HttpMiddlewareFn;

function isMiddlewareClassTypeOrFn(v: HttpActionMiddleware): v is ClassType<HttpMiddleware> | HttpMiddlewareFn {
    return isClass(v) || !isDecoratorContext(httpMiddleware, v);
}

export class HttpController {
    baseUrl: string = '';
    actions = new Set<HttpAction>();
    groups: string[] = [];

    middlewares: (() => HttpMiddlewareConfig)[] = [];

    resolverForToken: Map<any, ClassType> = new Map();
    resolverForParameterName: Map<string, ClassType> = new Map();

    private actionsProcessed = new Set<HttpAction>();

    getUrl(action: HttpAction): string {
        return urlJoin('/', this.baseUrl, action.path);
    }

    addAction(action: HttpAction) {
        this.actions.add(action);
    }

    getActions(): Set<HttpAction> {
        for (const action of this.actions) {
            if (!this.actionsProcessed.has(action)) {
                action.groups = [
                    ...this.groups,
                    ...action.groups.filter((g) => !this.groups.includes(g)),
                ];
                this.actionsProcessed.add(action);
            }
        }

        return this.actions;
    }

    removeAction(methodName: string): void {
        const action = this.getAction(methodName);
        this.actions.delete(action);
        this.actionsProcessed.delete(action);
    }

    getAction(methodName: string): HttpAction {
        for (const a of this.getActions()) {
            if (a.methodName === methodName) return a;
        }
        throw new Error(`No action with methodName ${methodName} found`);
    }
}

export class HttpActionParameter {
    name: string = '';
    type?: 'body' | 'query' | 'queries';

    /**
     * undefined = propertyName, '' === root, else given path
     */
    typePath?: string;
    optional: boolean = false;
}

export class HttpAction {
    name: string = '';
    description: string = '';
    category: string = '';
    path: string = '';
    httpMethods: string[] = [];
    methodName: string = '';
    groups: string[] = [];
    serializer?: Serializer;
    middlewares: (() => HttpMiddlewareConfig)[] = [];
    serializationOptions?: SerializationOptions;

    resolverForToken: Map<any, ClassType> = new Map();
    resolverForParameterName: Map<string, ClassType> = new Map();

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    responses: { statusCode: number, description: string, type?: Type }[] = [];
}

export class HttpControllerDecorator {
    t = new HttpController;

    controller(baseUrl: string = '') {
        this.t.baseUrl = baseUrl;
    }

    group(...group: string[]) {
        this.t.groups.push(...group);
    }

    middleware(...middlewares: HttpActionMiddleware[]) {
        this.t.middlewares.push(...middlewares.map(v => isMiddlewareClassTypeOrFn(v) ? httpMiddleware.for(v) : v));
    }

    /**
     * Adds a parameter resolver for parameters based on the class type. Use .resolveParameterByName() for name-based resolving.
     *
     * ```typescript
     *
     * class UserResolver {
     *     resolve(context: RouteParameterResolverContext): any | Promise<any> {
     *         return new User();
     *     }
     * }
     *
     * @http.resolveParameter(User, UserResolver)
     * class MyController {
     *
     *     @http.GET()
     *     myAction(user: User) {
     *     }
     * }
     *
     * new App({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameter(classType: ClassType | string | any, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForToken.set(classType, resolver);
    }

    /**
     * Adds a parameter resolver for parameters based on its name. Use .resolveParameter() for class-based resolving.
     *
     * ```typescript
     *
     * class UserResolver {
     *     resolve(context: RouteParameterResolverContext): any | Promise<any> {
     *         return new User();
     *     }
     * }
     *
     * @http.resolveParameterByName('user', UserResolver)
     * class MyController {
     *
     *     @http.GET()
     *     myAction(user: User) {
     *     }
     * }
     *
     * new App({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameterByName(name: string, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForParameterName.set(name, resolver);
    }

    setAction(action: HttpAction) {
        this.t.addAction(action);
    }
}

export const httpClass: ClassDecoratorResult<typeof HttpControllerDecorator> = createClassDecoratorContext(HttpControllerDecorator);

export class HttpActionDecorator {
    t = new HttpAction;

    onDecorator(target: ClassType, property: string | undefined, parameterIndexOrDescriptor?: any) {
        if (!property) return;
        if (target === Object) return;
        this.t.methodName = property;
        httpClass.setAction(this.t)(target);
    }

    name(name: string) {
        this.t.name = name;
    }

    description(description: string) {
        this.t.description = description;
    }

    serialization(options: SerializationOptions) {
        this.t.serializationOptions = options;
    }

    serializer(serializer: Serializer) {
        this.t.serializer = serializer;
    }

    middleware(...middlewares: HttpActionMiddleware[]) {
        this.t.middlewares.push(...middlewares.map(v => isMiddlewareClassTypeOrFn(v) ? httpMiddleware.for(v) : v));
    }

    /**
     * Allows to change the HttpAction object and composite multiple properties into one function.
     *
     * @example
     * ```typescript
     * const authGroup = Symbol('authGroup');
     *
     * function authGroup(group: 'admin' | 'user') {
     *    return (action: HttpAction) => {
     *        action.data.set(authGroup, group);
     *    };
     * }
     *
     * class My Controller {
     *    @http.GET('/assets').use(authGroup('admin'))
     *    assets() {}
     * }
     * ```
     */
    use(use: (action: HttpAction) => void) {
        use(this.t);
    }

    /**
     * Arbitrary value container that can be read in RouterParameterResolver and all
     * HTTP workflow events (like authentication).
     *
     * @example
     * ```typescript
     * class My Controller {
     *    @http.GET('/assets').data('authGroup', 'admin')
     *    assets() {}
     * }
     * ```
     */
    data(name: string, value: any) {
        this.t.data.set(name, value);
    }

    category(category: string) {
        this.t.category = category;
    }

    group(...group: string[]) {
        this.t.groups.push(...group);
    }

    GET(path: string = '') {
        this.t.httpMethods.push('GET');
        if (path) this.t.path = path;
    }

    HEAD(path: string = '') {
        this.t.httpMethods.push('HEAD');
        if (path) this.t.path = path;
    }

    POST(path: string = '') {
        this.t.httpMethods.push('POST');
        if (path) this.t.path = path;
    }

    PUT(path: string = '') {
        this.t.httpMethods.push('PUT');
        if (path) this.t.path = path;
    }

    DELETE(path: string = '') {
        this.t.httpMethods.push('DELETE');
        if (path) this.t.path = path;
    }

    OPTIONS(path: string = '') {
        this.t.httpMethods.push('OPTIONS');
        if (path) this.t.path = path;
    }

    TRACE(path: string = '') {
        this.t.httpMethods.push('TRACE');
        if (path) this.t.path = path;
    }

    PATCH(path: string = '') {
        this.t.httpMethods.push('PATCH');
        if (path) this.t.path = path;
    }

    ANY(path: string = '') {
        this.t.httpMethods = [];
        if (path) this.t.path = path;
    }

    /**
     * Adds additional information about what HTTP status codes are available in this route.
     * You can add additionally a description and a response body type.
     *
     * The type is used for serialization for responses with the given statusCode.
     *
     * This information is available in Deepkit API console.
     *
     * ```typescript
     *
     * http.GET().response<boolean>(200, 'All ok')
     *
     * interface User {
     *     username: string;
     * }
     * http.GET().response<User>(200, 'User object')
     *
     * interface HttpErrorMessage {
     *     error: string;
     * }
     * http.GET().response<HttpErrorMessage>(500, 'Error')
     * ```
     */
    response<T>(statusCode: number, description: string = '', type?: ReceiveType<T>) {
        this.t.responses.push({ statusCode, description, type: type ? resolveReceiveType(type) : undefined });
    }

    /**
     * Adds a parameter resolver for parameters based on the class type. Use .resolveParameterByName() for name-based resolving.
     *
     * ```typescript
     *
     * class UserResolver {
     *     resolve(context: RouteParameterResolverContext): any | Promise<any> {
     *         return new User();
     *     }
     * }
     *
     * class MyController {
     *     @http.GET()
     *     @http.resolveParameter(User, UserResolver)
     *     myAction(user: User) {
     *     }
     * }
     *
     * new App({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameter(classType: ClassType | string | any, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForToken.set(classType, resolver);
    }

    /**
     * Adds a parameter resolver for parameters based on its name. Use .resolveParameter() for class-based resolving.
     *
     * ```typescript
     *
     * class UserResolver {
     *     resolve(context: RouteParameterResolverContext): any | Promise<any> {
     *         return new User();
     *     }
     * }
     *
     * class MyController {
     *     @http.GET()
     *     @http.resolveParameterByName('user', UserResolver)
     *     myAction(user: User) {
     *     }
     * }
     *
     * new App({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameterByName(name: string, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForParameterName.set(name, resolver);
    }
}

//this workaround is necessary since generic functions (necessary for response<T>) are lost during a mapped type and changed ReturnType
type HttpActionFluidDecorator<T, D extends Function> = {
    [name in keyof T]: name extends 'response' ? <T2>(statusCode: number, description?: string, type?: ReceiveType<T2>) => D & HttpActionFluidDecorator<T, D>
        : T[name] extends (...args: infer K) => any ? (...args: K) => D & HttpActionFluidDecorator<T, D>
        : D & HttpActionFluidDecorator<T, D> & { _data: ExtractApiDataType<T> };
};
type HttpActionPropertyDecoratorResult = HttpActionFluidDecorator<ExtractClass<typeof HttpActionDecorator>, PropertyDecoratorFn> & DecoratorAndFetchSignature<typeof HttpActionDecorator, PropertyDecoratorFn>;

export const httpAction: HttpActionPropertyDecoratorResult = createPropertyDecoratorContext(HttpActionDecorator);

//this workaround is necessary since generic functions are lost during a mapped type and changed ReturnType
type HttpMerge<U> = { [K in keyof U]: K extends 'response' ? <T2>(statusCode: number, description?: string, type?: ReceiveType<T2>) => PropertyDecoratorFn & U : U[K] extends ((...a: infer A) => infer R) ? R extends DualDecorator ? (...a: A) => PropertyDecoratorFn & R & U : (...a: A) => R : never };
type MergedHttp<T extends any[]> = HttpMerge<Omit<UnionToIntersection<T[number]>, '_fetch' | 't'>>

export type HttpDecorator = PropertyDecoratorFn & HttpActionFluidDecorator<HttpActionDecorator, PropertyDecoratorFn>;

export const http: MergedHttp<[typeof httpClass, typeof httpAction]> = mergeDecorator(httpClass, httpAction) as any as MergedHttp<[typeof httpClass, typeof httpAction]>;
