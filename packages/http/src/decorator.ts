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
    getClassSchema,
    isDecoratorContext,
    JitConverterOptions,
    mergeDecorator,
    PropertyDecoratorResult,
    Serializer
} from '@deepkit/type';
import { RouteParameterResolver } from './router';
import { httpMiddleware, HttpMiddleware, HttpMiddlewareConfig } from './middleware';

export interface ControllerOptions {
    name: string;
}

type HttpActionMiddleware = (() => HttpMiddlewareConfig) | ClassType<{ execute: HttpMiddleware }> | HttpMiddleware;

class HttpController {
    baseUrl: string = '';
    protected actions = new Set<HttpAction>();
    groups: string[] = [];

    middlewares: (() => HttpMiddlewareConfig)[] = [];

    resolverForToken: Map<any, ClassType> = new Map();
    resolverForParameterName: Map<string, ClassType> = new Map();

    getUrl(action: HttpAction): string {
        return urlJoin('/', this.baseUrl, action.path);
    }

    addAction(action: HttpAction) {
        this.actions.add(action);
    }

    getActions(): Set<HttpAction> {
        for (const a of this.actions) {
            for (const g of this.groups) {
                if (!a.groups.includes(g)) a.groups.push(g);
            }
        }

        return this.actions;
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
    type?: 'body' | 'query';

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
    httpMethod: string = 'GET';
    methodName: string = '';
    groups: string[] = [];
    serializer?: Serializer;
    middlewares: (() => HttpMiddlewareConfig)[] = [];
    serializationOptions?: JitConverterOptions;

    parameterRegularExpressions: { [name: string]: any } = {};

    resolverForToken: Map<any, ClassType> = new Map();
    resolverForParameterName: Map<string, ClassType> = new Map();

    /**
     * This is only filled when the user used @http.body() for example on an method argument.
     */
    parameters: { [name: string]: HttpActionParameter } = {};

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    throws: { errorType: ClassType, message?: string }[] = [];
}

export class HttpDecorator {
    t = new HttpController;

    controller(baseUrl: string = '') {
        this.t.baseUrl = baseUrl;
    }

    group(...group: string[]) {
        this.t.groups.push(...group);
    }

    middleware(...middlewares: HttpActionMiddleware[]) {
        this.t.middlewares.push(...middlewares.map(v => isClass(v) || !isDecoratorContext(httpMiddleware, v) ? httpMiddleware.for(v) : v));
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
     * Application.create({providers: [UserResolver]}).run();
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
     * Application.create({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameterByName(name: string, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForParameterName.set(name, resolver);
    }

    setAction(action: HttpAction) {
        this.t.addAction(action);
    }
}

export const httpClass: ClassDecoratorResult<typeof HttpDecorator> = createClassDecoratorContext(HttpDecorator);

export class HttpActionDecorator {
    t = new HttpAction;

    onDecorator(target: ClassType, property: string) {
        this.t.methodName = property;
        httpClass.setAction(this.t)(target);
    }

    name(name: string) {
        this.t.name = name;
    }

    setParameter(name: string, parameter: HttpActionParameter) {
        this.t.parameters[name] = parameter;
    }

    description(description: string) {
        this.t.description = description;
    }

    serialization(options: JitConverterOptions) {
        this.t.serializationOptions = options;
    }

    serializer(serializer: Serializer) {
        this.t.serializer = serializer;
    }

    middleware(...middlewares: HttpActionMiddleware[]) {
        this.t.middlewares.push(...middlewares.map(v => isClass(v) || !isDecoratorContext(httpMiddleware, v) ? httpMiddleware.for(v) : v));
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
        this.t.httpMethod = 'GET';
        this.t.path = path;
    }

    HEAD(path: string = '') {
        this.t.httpMethod = 'HEAD';
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

    OPTIONS(path: string = '') {
        this.t.httpMethod = 'HEAD';
        this.t.path = path;
    }

    TRACE(path: string = '') {
        this.t.httpMethod = 'HEAD';
        this.t.path = path;
    }

    PATCH(path: string = '') {
        this.t.httpMethod = 'PATCH';
        this.t.path = path;
    }

    ANY(path: string = '') {
        this.t.httpMethod = 'ANY';
        this.t.path = path;
    }

    throws(errorType: ClassType, message?: string) {
        this.t.throws.push({ errorType, message });
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
     * Application.create({providers: [UserResolver]}).run();
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
     * Application.create({providers: [UserResolver]}).run();
     * ```
     */
    resolveParameterByName(name: string, resolver: ClassType<RouteParameterResolver>) {
        this.t.resolverForParameterName.set(name, resolver);
    }

    regexp(parameterName: string, regex: any) {
        this.t.parameterRegularExpressions[parameterName] = regex;
    }
}

class HttpActionParameterDecorator {
    t = new HttpActionParameter();

    onDecorator(target: ClassType, propertyName?: string, parameterIndex?: number) {
        if (!propertyName) throw new Error('@http action parameter decorator can only be used on method arguments.');
        if (parameterIndex === undefined) throw new Error('@http action parameter decorator can only be used on method arguments.');
        const schema = getClassSchema(target);
        const property = schema.getMethodProperties(propertyName)[parameterIndex];
        this.t.name = property.name;
        if (this.t.typePath === undefined) {
            this.t.typePath = property.name;
        }
        httpAction.setParameter(property.name, this.t)(target.prototype, propertyName);
    }

    /**
     * Marks the argument as body parameter. Data from the client sent in the body
     * will be tried to parsed (JSON/form data) and deserialized to the defined type.
     * Make sure the class type as a schema assigned.
     *
     * @example
     * ```typescript
     * class MyActionBody {
     *     @t name!: string;
     * }
     *
     * class Controller {
     *     @http.GET()
     *     myAction(@http.body() body: MyActionBody) {
     *         console.log('body', body.name);
     *     }
     * }
     * ```
     */
    body() {
        this.t.type = 'body';
        this.t.typePath = ''; //root
    }

    query(path?: string) {
        this.t.typePath = path; //undefined === propertyName
        this.t.type = 'query';
    }

    get optional() {
        this.t.optional = true;
        return;
    }

    /**
     * Marks the argument as query parameter. Data from the query string is parsed
     * and deserialized to the defined type.
     * Define a `path` if you want to parse a subset of the query string only.
     *
     * Note: Make sure the defined parameter type has optional properties,
     * otherwise it's always required to pass a query string.
     *
     * @example
     * ```typescript
     * class MyActionQueries {
     *     @t.optional name?: string;
     * }
     *
     * class Controller {
     *     @http.GET('my-action')
     *     myAction(@http.queries() query: MyActionQueries) {
     *         console.log('query', query.name);
     *     }
     * }
     *
     * // Open via, e.g.
     * // -> /my-action?name=Peter
     * ```
     *
     */
    queries(path: string = '') {
        this.t.typePath = path; //'' === root
        this.t.type = 'query';
    }
}

createPropertyDecoratorContext(HttpActionDecorator);

export const httpAction: PropertyDecoratorResult<typeof HttpActionDecorator> = createPropertyDecoratorContext(HttpActionDecorator);

export const httpActionParameter: PropertyDecoratorResult<typeof HttpActionParameterDecorator> = createPropertyDecoratorContext(HttpActionParameterDecorator);

export const http = mergeDecorator(httpClass, httpAction, httpActionParameter);
