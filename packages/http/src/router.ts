/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { asyncOperation, ClassType, CompilerContext, getClassName, isArray, isClass, isObject, urlJoin } from '@deepkit/core';
import {
    assertType,
    entity,
    findMember,
    getSerializeFunction,
    getValidatorFunction,
    metaAnnotation,
    ReflectionClass,
    ReflectionFunction,
    ReflectionKind,
    ReflectionParameter,
    SerializationOptions,
    serializer,
    Serializer,
    stringifyType,
    Type,
    typeToObject,
    ValidationError
} from '@deepkit/type';
// @ts-ignore
import formidable from 'formidable';
import { HttpAction, httpClass, HttpController, HttpDecorator } from './decorator.js';
import { BodyValidationError, getRegExp, HttpRequest, HttpRequestQuery, HttpRequestResolvedParameters, ValidatedBody } from './model.js';
import { InjectorContext, InjectorModule, TagRegistry } from '@deepkit/injector';
import { Logger, LoggerInterface } from '@deepkit/logger';
import { HttpControllers } from './controllers.js';
import { MiddlewareRegistry, MiddlewareRegistryEntry } from '@deepkit/app';
import { HttpMiddlewareConfig, HttpMiddlewareFn } from './middleware.js';

//@ts-ignore
import qs from 'qs';
import { HtmlResponse, JSONResponse, Response } from './http.js';

export type RouteParameterResolverForInjector = ((injector: InjectorContext) => any[] | Promise<any[]>);

interface ResolvedController {
    parameters: RouteParameterResolverForInjector;
    routeConfig: RouteConfig;
    uploadedFiles: { [name: string]: UploadedFile };
    middlewares?: (injector: InjectorContext) => { fn: HttpMiddlewareFn, timeout: number }[];
}

@entity.name('@deepkit/UploadedFile')
export class UploadedFile {
    /**
     * The size of the uploaded file in bytes.
     */
    size!: number;

    /**
     * The local path this file is being written to. Will be deleted when request is handled.
     */
    path!: string;

    /**
     * The name this file had according to the uploading client.
     */
    name!: string | null;

    /**
     * The mime type of this file, according to the uploading client.
     */
    type!: string | null;

    /**
     * A Date object (or `null`) containing the time this file was last written to.
     * Mostly here for compatibility with the [W3C File API Draft](http://dev.w3.org/2006/webapi/FileAPI/).
     */
    lastModifiedDate!: Date | null;

    // /**
    //  * If `options.hash` calculation was set, you can read the hex digest out of this var.
    //  */
    // hash!: string | 'sha1' | 'md5' | 'sha256' | null;
}

export interface RouteFunctionControllerAction {
    type: 'function';
    //if not set, the root module is used
    module?: InjectorModule<any>;
    fn: (...args: any[]) => any;
}

export interface RouteClassControllerAction {
    type: 'controller';
    //if not set, the root module is used
    module?: InjectorModule<any>;
    controller: ClassType;
    methodName: string;
}

export class RouteConfig {
    public baseUrl: string = '';

    public responses: { statusCode: number, description: string, type?: Type }[] = [];

    public description: string = '';
    public groups: string[] = [];
    public category: string = '';

    public returnType?: Type;

    public serializationOptions?: SerializationOptions;
    public serializer?: Serializer;

    /**
     * When assigned defines where this route came from.
     */
    public module?: InjectorModule<any>;

    resolverForToken: Map<any, ClassType> = new Map();

    middlewares: { config: HttpMiddlewareConfig, module?: InjectorModule<any> }[] = [];

    resolverForParameterName: Map<string, ClassType> = new Map();

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    constructor(
        public readonly name: string,
        public readonly httpMethods: string[],
        public readonly path: string,
        public readonly action: RouteClassControllerAction | RouteFunctionControllerAction,
        public internal: boolean = false,
    ) {
    }

    getReflectionFunction(): ReflectionFunction {
        return this.action.type === 'controller' ?
            ReflectionClass.from(this.action.controller).getMethod(this.action.methodName)
            : ReflectionFunction.from(this.action.fn);
    }

    getSchemaForResponse(statusCode: number): Type | undefined {
        if (!this.responses.length) return;
        for (const response of this.responses) {
            if (response.statusCode === statusCode) return response.type;
        }
        return;
    }

    getFullPath(): string {
        let path = this.baseUrl ? urlJoin(this.baseUrl, this.path) : this.path;
        if (!path.startsWith('/')) path = '/' + path;
        return path;
    }
}

class ParsedRoute {
    public regex?: string;

    public pathParameterNames: { [name: string]: number } = {};

    protected parameters: ParsedRouteParameter[] = [];

    constructor(public routeConfig: RouteConfig) {
    }

    addParameter(property: ReflectionParameter): ParsedRouteParameter {
        const parameter = new ParsedRouteParameter(property);
        this.parameters.push(parameter);
        return parameter;
    }

    getParameters(): ParsedRouteParameter[] {
        return this.parameters;
    }

    getParameter(name: string): ParsedRouteParameter {
        for (const parameter of this.parameters) {
            if (parameter.getName() === name) return parameter;
        }
        throw new Error(`No route parameter with name ${name} defined.`);
    }
}

class ParsedRouteParameter {
    regexPosition?: number;

    constructor(
        public parameter: ReflectionParameter,
    ) {
    }

    get body() {
        return metaAnnotation.getForName(this.parameter.type, 'httpBody') !== undefined;
    }

    get bodyValidation() {
        return metaAnnotation.getForName(this.parameter.type, 'httpBodyValidation') !== undefined;
    }

    getType(): Type {
        if (this.bodyValidation) {
            assertType(this.parameter.type, ReflectionKind.class);
            const valueType = findMember('value', this.parameter.type.types);
            if (!valueType || valueType.kind !== ReflectionKind.property) throw new Error(`No property value found at ${stringifyType(this.parameter.type)}`);
            return valueType.type as Type;
        }
        return this.parameter.type;
    }

    get query() {
        return metaAnnotation.getForName(this.parameter.type, 'httpQuery') !== undefined;
    }

    get queries() {
        return metaAnnotation.getForName(this.parameter.type, 'httpQueries') !== undefined;
    }

    get typePath(): string | undefined {
        const typeOptions = metaAnnotation.getForName(this.parameter.type, 'httpQueries') || metaAnnotation.getForName(this.parameter.type, 'httpQuery');
        if (!typeOptions) return;
        const options = typeToObject(typeOptions[0]);
        if (isObject(options)) return options.name;
        return;
    }

    getName() {
        return this.parameter.name;
    }

    isPartOfPath(): boolean {
        return this.regexPosition !== undefined;
    }
}

function parseRoutePathToRegex(routeConfig: RouteConfig): { regex: string, parameterNames: { [name: string]: number } } {
    const parameterNames: { [name: string]: number } = {};
    let path = routeConfig.getFullPath();

    const fn = routeConfig.getReflectionFunction();

    let argumentIndex = 0;
    path = path.replace(/:(\w+)/g, (a, name) => {
        parameterNames[name] = argumentIndex;
        argumentIndex++;
        const parameter = fn.getParameterOrUndefined(name);
        if (parameter) {
            const regExp = getRegExp(parameter.type);
            if (regExp instanceof RegExp) {
                return '(' + regExp.source + ')';
            } else if (regExp) {
                return '(' + regExp + ')';
            }
        }
        return String.raw`([^/]+)`;
    });

    return { regex: path, parameterNames };
}

export function parseRouteControllerAction(routeConfig: RouteConfig): ParsedRoute {
    const parsedRoute = new ParsedRoute(routeConfig);

    const methodArgumentProperties = routeConfig.getReflectionFunction().getParameters();
    const parsedPath = parseRoutePathToRegex(routeConfig);
    parsedRoute.regex = parsedPath.regex;
    parsedRoute.pathParameterNames = parsedPath.parameterNames;

    for (const property of methodArgumentProperties) {
        const parsedParameter = parsedRoute.addParameter(property);
        parsedParameter.regexPosition = parsedPath.parameterNames[property.name];
    }

    return parsedRoute;
}

export function dotToUrlPath(dotPath: string): string {
    if (-1 === dotPath.indexOf('.')) return dotPath;

    return dotPath.replace(/\./g, '][').replace('][', '[') + ']';
}

export interface RouteParameterResolver {
    resolve(context: RouteParameterResolverContext): any | Promise<any>;
}

export interface RouteParameterResolverContext {
    token: ClassType | string | symbol | any;
    route: RouteConfig;
    request: HttpRequest;

    /**
     * The parameter name (variable name).
     */
    name: any;

    /**
     * The raw parameter value from the path, if the parameter is defined in the path (e.g. /user/:name).
     * If not in the path, you have to use `parameters.<name>` instead.
     */
    value: any;

    query: HttpRequestQuery;
    parameters: HttpRequestResolvedParameters;
}

function filterMiddlewaresForRoute(middlewareRawConfigs: MiddlewareRegistryEntry[], routeConfig: RouteConfig, fullPath: string): { config: HttpMiddlewareConfig, module: InjectorModule<any> }[] {
    const middlewares = middlewareRawConfigs.slice(0);
    middlewares.push(...routeConfig.middlewares as any[]);

    const middlewareConfigs = middlewares.filter((v) => {
        if (!(v.config instanceof HttpMiddlewareConfig)) return false;

        if (v.config.controllers.length && routeConfig.action.type === 'controller' && !v.config.controllers.includes(routeConfig.action.controller)) {
            return false;
        }

        if (v.config.excludeControllers.length && routeConfig.action.type === 'controller' && v.config.excludeControllers.includes(routeConfig.action.controller)) {
            return false;
        }

        if (v.config.modules.length && (!routeConfig.module || !v.config.modules.includes(routeConfig.module))) {
            if (!routeConfig.module) return false;
            for (const module of v.config.modules) {
                if (routeConfig.module.id !== module.id) return false;
            }
        }

        if (v.config.selfModule && v.module.id !== routeConfig.module?.id) return false;

        if (v.config.routeNames.length) {
            let found: boolean = false;
            for (const name of v.config.routeNames) {
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
            if (!found) return false;
        }

        if (v.config.excludeRouteNames.length) {
            for (const name of v.config.excludeRouteNames) {
                if (name.includes('*')) {
                    const regex = new RegExp('^' + name.replace(/\*/g, '.*') + '$');
                    if (regex.test(routeConfig.name)) return false;
                } else if (name == routeConfig.name) {
                    return false;
                }
            }
        }

        for (const route of v.config.routes) {
            if (route.httpMethod && !routeConfig.httpMethods.includes(route.httpMethod)) return false;

            if (route.category && route.category !== routeConfig.category) return false;
            if (route.excludeCategory && route.excludeCategory === routeConfig.category) return false;

            if (route.group && !routeConfig.groups.includes(route.group)) return false;
            if (route.excludeGroup && routeConfig.groups.includes(route.excludeGroup)) return false;

            if (route.path || route.pathRegExp) {
                if (!route.pathRegExp && route.path) route.pathRegExp = new RegExp('^' + route.path.replace(/\*/g, '.*') + '$');
                if (route.pathRegExp && !route.pathRegExp.test(fullPath)) return false;
            }
        }

        return true;
    }) as { config: HttpMiddlewareConfig, module: any }[];

    middlewareConfigs.sort((a, b) => {
        return a.config.order - b.config.order;
    });

    return middlewareConfigs;
}

export interface HttpRouterFunctionOptions {
    path: string;
    name?: string;
    methods?: string[];
    description?: string;
    category?: string;
    groups?: string[];

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data?: Record<any, any>;

    baseUrl?: string;
    middlewares?: (() => HttpMiddlewareConfig)[];

    serializer?: Serializer;
    serializationOptions?: SerializationOptions;

    resolverForToken?: Map<any, ClassType>;
    resolverForParameterName?: Map<string, ClassType>;

    responses?: { statusCode: number, description: string, type?: Type }[];
}

function convertOptions(methods: string[], pathOrOptions: string | HttpRouterFunctionOptions, defaultOptions: Partial<HttpRouterFunctionOptions>): HttpRouterFunctionOptions {
    const options = 'string' === typeof pathOrOptions ? { path: pathOrOptions } : pathOrOptions;
    if (options.methods) return options;
    return { ...options, methods };
}

/**
 * Annotated types like HTMLResponse/JSONResponse are not used for serialization.
 */
function filterValidReturnType(type: Type): Type | undefined {
    if (type.kind === ReflectionKind.class && (type.classType === HtmlResponse || type.classType === JSONResponse || type.classType === Response)) return;
    return type;
}

export abstract class HttpRouterRegistryFunctionRegistrar {
    protected defaultOptions: Partial<HttpRouterFunctionOptions> = {};

    abstract addRoute(routeConfig: RouteConfig): void;

    /**
     * Returns a new registrar object with default options that apply to each registered route through this registrar.
     *
     * ```typescript
     * const registry: HttpRouterRegistry = ...;
     *
     * const secretRegistry = registry.forOptions({groups: ['secret']});
     *
     * secretRegistry.get('/admin/groups', () => {
     * });
     *
     * secretRegistry.get('/admin/users', () => {
     * });
     * ```
     */
    forOptions(options: Partial<HttpRouterFunctionOptions>): HttpRouterRegistryFunctionRegistrar {
        const that = this;
        return new class extends HttpRouterRegistryFunctionRegistrar {
            defaultOptions = options;

            addRoute(routeConfig: RouteConfig) {
                that.addRoute(routeConfig);
            }
        };
    }

    public any(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions([], pathOrOptions, this.defaultOptions), callback);
    }

    public add(decorator: HttpDecorator, callback: (...args: any[]) => any) {
        const data = decorator(Object, '_');
        const action = isArray(data) ? data.find(v => v instanceof HttpAction) : undefined;
        if (!action) throw new Error('No HttpAction available');

        const fn = ReflectionFunction.from(callback);
        const routeConfig = createRouteConfigFromHttpAction({
            type: 'function',
            fn: callback,
        }, action);
        routeConfig.returnType = filterValidReturnType(fn.getReturnType());
        this.addRoute(routeConfig);
    }

    public get(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['GET'], pathOrOptions, this.defaultOptions), callback);
    }

    public post(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['POST'], pathOrOptions, this.defaultOptions), callback);
    }

    public put(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['PUT'], pathOrOptions, this.defaultOptions), callback);
    }

    public patch(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['PATCH'], pathOrOptions, this.defaultOptions), callback);
    }

    public delete(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['DELETE'], pathOrOptions, this.defaultOptions), callback);
    }

    public options(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['OPTIONS'], pathOrOptions, this.defaultOptions), callback);
    }

    public trace(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['TRACE'], pathOrOptions, this.defaultOptions), callback);
    }

    public head(pathOrOptions: string | HttpRouterFunctionOptions, callback: (...args: any[]) => any) {
        this.register(convertOptions(['HEAD'], pathOrOptions, this.defaultOptions), callback);
    }

    private register(options: HttpRouterFunctionOptions, callback: (...args: any[]) => any, module?: InjectorModule<any>) {
        const fn = ReflectionFunction.from(callback);

        const routeConfig = new RouteConfig(options.name || '', options.methods || [], options.path, {
            type: 'function',
            fn: callback,
        });
        routeConfig.module = module;
        if (options.responses) routeConfig.responses = options.responses;
        if (options.description) routeConfig.description = options.description;
        if (options.category) routeConfig.category = options.category;
        if (options.groups) routeConfig.groups = options.groups;
        if (options.data) routeConfig.data = new Map(Object.entries(options.data));
        if (options.baseUrl) routeConfig.baseUrl = options.baseUrl;
        if (options.middlewares) {
            routeConfig.middlewares = options.middlewares.map(v => {
                return { config: v(), module };
            });
        }

        if (options.resolverForToken) {
            for (const item of options.resolverForToken) routeConfig.resolverForToken.set(...item);
        }

        if (options.resolverForToken) {
            for (const item of options.resolverForToken) routeConfig.resolverForToken.set(...item);
        }

        if (options.resolverForParameterName) {
            for (const item of options.resolverForParameterName) routeConfig.resolverForParameterName.set(...item);
        }

        routeConfig.serializer = options.serializer;
        routeConfig.serializationOptions = options.serializationOptions;

        routeConfig.returnType = filterValidReturnType(fn.getReturnType());
        this.addRoute(routeConfig);
    }
}

function createRouteConfigFromHttpAction(routeAction: RouteClassControllerAction | RouteFunctionControllerAction, action: HttpAction, module?: InjectorModule<any>, controller?: HttpController) {
    const routeConfig = new RouteConfig(action.name, action.httpMethods, action.path, routeAction);
    routeConfig.responses = action.responses;
    routeConfig.description = action.description;
    routeConfig.category = action.category;
    routeConfig.groups = action.groups;
    routeConfig.data = new Map(action.data);
    if (controller) {
        routeConfig.baseUrl = controller.baseUrl;

        routeConfig.middlewares = controller.middlewares.map(v => {
            return { config: v(), module };
        });
        routeConfig.resolverForToken = new Map(controller.resolverForToken);
        routeConfig.resolverForParameterName = new Map(controller.resolverForParameterName);
    }

    routeConfig.middlewares.push(...action.middlewares.map(v => {
        return { config: v(), module };
    }));

    for (const item of action.resolverForToken) routeConfig.resolverForToken.set(...item);

    for (const item of action.resolverForParameterName) routeConfig.resolverForParameterName.set(...item);

    routeConfig.serializer = action.serializer;
    routeConfig.serializationOptions = action.serializationOptions;
    return routeConfig;
}

export class HttpRouterRegistry extends HttpRouterRegistryFunctionRegistrar {
    protected routes: RouteConfig[] = [];
    private buildId: number = 1;

    public getBuildId(): number {
        return this.buildId;
    }

    public getRoutes(): RouteConfig[] {
        return this.routes;
    }

    public addRouteForController(controller: ClassType, module: InjectorModule<any>) {
        const controllerData = httpClass._fetch(controller);
        if (!controllerData) throw new Error(`Http controller class ${getClassName(controller)} has no @http.controller decorator.`);
        const schema = ReflectionClass.from(controller);

        for (const action of controllerData.getActions()) {
            const routeAction: RouteClassControllerAction = {
                type: 'controller',
                controller,
                module,
                methodName: action.methodName
            };
            const routeConfig = createRouteConfigFromHttpAction(routeAction, action, module, controllerData);

            routeConfig.module = module;

            if (schema.hasMethod(action.methodName)) routeConfig.returnType = filterValidReturnType(schema.getMethod(action.methodName).getReturnType());
            this.addRoute(routeConfig);
        }
    }

    public addRoute(routeConfig: RouteConfig) {
        this.routes.push(routeConfig);
        this.buildId++;
    }
}

export class HttpRouter {
    protected fn?: (request: HttpRequest) => ResolvedController | undefined;
    protected buildId: number = 0;
    protected resolveFn?: (name: string, parameters: { [name: string]: any }) => string;

    private parseBody(req: HttpRequest, foundFiles: { [name: string]: UploadedFile }) {
        const form = formidable({
            multiples: true,
            hash: 'sha1',
        });
        return asyncOperation((resolve, reject) => {
            if (req.body) {
                return resolve(req.body);
            }
            form.parse(req, (err: any, fields: any, files: any) => {
                if (err) {
                    reject(err);
                } else {
                    for (const [name, file] of Object.entries(files) as any) {
                        if (file.size === 0) continue;
                        foundFiles[name] = {
                            size: file.size,
                            path: file.filepath,
                            name: file.originalFilename,
                            type: file.mimetype,
                            lastModifiedDate: file.lastModifiedDate,
                        }
                    }
                    const body = req.body = { ...fields, ...foundFiles };
                    resolve(body);
                }
            });
        });
    }

    constructor(
        controllers: HttpControllers,
        private logger: LoggerInterface,
        tagRegistry: TagRegistry,
        private middlewareRegistry: MiddlewareRegistry = new MiddlewareRegistry,
        private registry: HttpRouterRegistry = new HttpRouterRegistry,
    ) {
        for (const controller of controllers.controllers) {
            this.addRouteForController(controller.controller, controller.module);
        }
    }

    getRoutes(): RouteConfig[] {
        return this.registry.getRoutes();
    }

    static forControllers(
        controllers: (ClassType | { module: InjectorModule<any>, controller: ClassType })[],
        tagRegistry: TagRegistry = new TagRegistry(),
        middlewareRegistry: MiddlewareRegistry = new MiddlewareRegistry(),
        module: InjectorModule<any> = new InjectorModule()
    ): HttpRouter {
        return new this(new HttpControllers(controllers.map(v => {
            return isClass(v) ? { controller: v, module } : v;
        })), new Logger([], []), tagRegistry, middlewareRegistry);
    }

    protected getRouteCode(compiler: CompilerContext, routeConfig: RouteConfig): string {
        const routeConfigVar = compiler.reserveVariable('routeConfigVar', routeConfig);
        const parsedRoute = parseRouteControllerAction(routeConfig);
        const path = routeConfig.getFullPath();
        const prefix = path.substr(0, path.indexOf(':'));

        const regexVar = compiler.reserveVariable('regex', new RegExp('^' + parsedRoute.regex + '$'));
        const setParameters: string[] = [];
        const parameterNames: string[] = [];
        const parameterValidator: string[] = [];
        let bodyValidationErrorHandling = `if (bodyErrors.length) throw ValidationError.from(bodyErrors);`;

        let enableParseBody = false;
        const hasParameters = parsedRoute.getParameters().length > 0;
        let requiresAsyncParameters = false;
        let setParametersFromPath = '';

        const fullPath = routeConfig.getFullPath();
        const middlewareConfigs = filterMiddlewaresForRoute(this.middlewareRegistry.configs, routeConfig, fullPath);

        for (const parameter of parsedRoute.getParameters()) {
            if (parameter.body || parameter.bodyValidation) {
                const type = parameter.getType();
                const validatorVar = compiler.reserveVariable('argumentValidator', getValidatorFunction(undefined, type));
                const converterVar = compiler.reserveVariable('argumentConverter', getSerializeFunction(type, serializer.deserializeRegistry));

                enableParseBody = true;
                setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(bodyFields, {loosely: true});`);
                parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: bodyErrors});`);
                if (parameter.bodyValidation) {
                    compiler.context.set('BodyValidation', ValidatedBody);
                    compiler.context.set('BodyValidationError', BodyValidationError);
                    parameterNames.push(`new BodyValidation(new BodyValidationError(bodyErrors), bodyErrors.length === 0 ? parameters.${parameter.parameter.name} : undefined)`);
                    bodyValidationErrorHandling = '';
                } else {
                    parameterNames.push(`parameters.${parameter.parameter.name}`);
                }
            } else if (parameter.query || parameter.queries) {
                const converted = getSerializeFunction(parameter.parameter.parameter, serializer.deserializeRegistry, undefined, parameter.getName());
                const validator = getValidatorFunction(undefined, parameter.parameter.parameter,);
                const converterVar = compiler.reserveVariable('argumentConverter', converted);
                const validatorVar = compiler.reserveVariable('argumentValidator', validator);

                const queryPath = parameter.typePath === undefined && parameter.query ? parameter.parameter.name : parameter.typePath;
                const accessor = queryPath ? `['` + (queryPath.replace(/\./g, `']['`)) + `']` : '';
                const queryAccessor = queryPath ? `_query${accessor}` : '_query';

                setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(${queryAccessor}, {loosely: true});`);
                parameterNames.push(`parameters.${parameter.parameter.name}`);
                parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: validationErrors}, ${JSON.stringify(parameter.typePath || parameter.getName())});`);
            } else {
                parameterNames.push(`parameters.${parameter.parameter.name}`);

                if (parameter.isPartOfPath()) {
                    if (parameter.parameter.type.kind !== ReflectionKind.class) {
                        const converted = getSerializeFunction(parameter.parameter.parameter, serializer.deserializeRegistry, undefined, parameter.getName());
                        const converterVar = compiler.reserveVariable('argumentConverter', converted);
                        setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(_match[${1 + (parameter.regexPosition || 0)}], {loosely: true});`);

                        const validator = getValidatorFunction(undefined, parameter.parameter.parameter);
                        const validatorVar = compiler.reserveVariable('argumentValidator', validator);
                        parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: validationErrors}, ${JSON.stringify(parameter.getName())});`);
                    } else {
                        setParameters.push(`parameters.${parameter.parameter.name} = _match[${1 + (parameter.regexPosition || 0)}];`);
                    }
                }

                const injectorToken = parameter.parameter.type.kind === ReflectionKind.class ? parameter.parameter.type.classType : undefined;
                const injectorTokenVar = compiler.reserveVariable('classType', injectorToken);
                const parameterResolverFoundVar = compiler.reserveVariable('parameterResolverFound', false);

                setParameters.push(`${parameterResolverFoundVar} = false;`);

                const resolver = routeConfig.resolverForParameterName.get(parameter.getName()) || routeConfig.resolverForToken.get(injectorToken);

                //make sure all parameter values from the path are available
                if (resolver && !setParametersFromPath) {
                    for (const i in parsedRoute.pathParameterNames) {
                        setParametersFromPath += `parameters.${i} = _match[${1 + parsedRoute.pathParameterNames[i]}];`;
                    }
                }

                let injector = '_injector';
                const moduleVar = routeConfig.module ? ', ' + compiler.reserveConst(routeConfig.module, 'module') : '';

                if (resolver) {
                    const resolverProvideTokenVar = compiler.reserveVariable('resolverProvideToken', resolver);
                    requiresAsyncParameters = true;
                    const instance = compiler.reserveVariable('resolverInstance');

                    setParameters.push(`
                    //resolver ${getClassName(resolver)} for ${parameter.getName()}
                    ${instance} = ${injector}.get(${resolverProvideTokenVar}${moduleVar});
                    if (!${parameterResolverFoundVar}) {
                        ${parameterResolverFoundVar} = true;
                        parameters.${parameter.parameter.name} = await ${instance}.resolve({
                            token: ${injectorTokenVar},
                            route: ${routeConfigVar},
                            request: request,
                            name: ${JSON.stringify(parameter.parameter.name)},
                            value: parameters.${parameter.parameter.name},
                            query: _query,
                            parameters: parameters
                        });
                    }`);
                }

                if (!parameter.isPartOfPath()) {
                    let injectorGet = `parameters.${parameter.parameter.name} = ${injector}.get(${injectorTokenVar});`;
                    if (parameter.parameter.isOptional()) {
                        injectorGet = `try {parameters.${parameter.parameter.name} = ${injector}.get(${injectorTokenVar}); } catch (e) {}`;
                    }
                    setParameters.push(`if (!${parameterResolverFoundVar}) ${injectorGet}`);
                }
            }
        }

        let parseBodyLoading = '';
        if (enableParseBody) {
            const parseBodyVar = compiler.reserveVariable('parseBody', this.parseBody.bind(this));
            parseBodyLoading = `
            const bodyFields = (await ${parseBodyVar}(request, uploadedFiles));`;
            requiresAsyncParameters = true;
        }

        let matcher = `_path.startsWith(${JSON.stringify(prefix)}) && (_match = _path.match(${regexVar}))`;
        if (!hasParameters) {
            matcher = `_path === ${JSON.stringify(path)}`;
        }

        let middlewares = 'undefined';
        if (middlewareConfigs.length) {
            const middlewareItems: string[] = [];
            for (const middlewareConfig of middlewareConfigs) {
                const moduleVar = middlewareConfig.module ? ', ' + compiler.reserveVariable('module', middlewareConfig.module) : '';

                for (const middleware of middlewareConfig.config.middlewares) {
                    if (isClass(middleware)) {
                        const classVar = compiler.reserveVariable('middlewareClassType', middleware);
                        middlewareItems.push(`{fn: function() {return _injector.get(${classVar}${moduleVar}).execute(...arguments) }, timeout: ${middlewareConfig.config.timeout}}`);
                    } else {
                        middlewareItems.push(`{fn: ${compiler.reserveVariable('middlewareFn', middleware)}, timeout: ${middlewareConfig.config.timeout}}`);
                    }
                }
            }

            middlewares = `
                function(_injector) {
                    return [${middlewareItems.join(', ')}];
                }
            `;
        }

        let parameters = '() => []';
        if (setParameters.length) {
            parameters = `${requiresAsyncParameters ? 'async' : ''} function(_injector){
                const validationErrors = [];
                const bodyErrors = [];
                const parameters = {};
                ${setParametersFromPath}
                ${parseBodyLoading}
                ${setParameters.join('\n')}
                ${parameterValidator.join('\n')}
                ${bodyValidationErrorHandling}
                if (validationErrors.length) throw new ValidationError(validationErrors);
                return [${parameterNames.join(',')}];
            }`;
        }

        let methodCheck = '';
        if (routeConfig.httpMethods.length) {
            methodCheck = '(' + routeConfig.httpMethods.map(v => {
                return `_method === '${v.toUpperCase()}'`;
            }).join(' || ') + ') && ';
        }

        return `
            //=> ${routeConfig.httpMethods.join(',')} ${path}
            if (${methodCheck}${matcher}) {
                return {routeConfig: ${routeConfigVar}, parameters: ${parameters}, uploadedFiles: uploadedFiles, middlewares: ${middlewares}};
            }
        `;
    }

    protected getRouteUrlResolveCode(compiler: CompilerContext, routeConfig: RouteConfig): string {
        const parsedRoute = parseRouteControllerAction(routeConfig);

        let url = routeConfig.getFullPath();
        url = url.replace(/:(\w+)/g, (a, name) => {
            return `\${parameters.${name}}`;
        });

        const modify: string[] = [];
        for (const parameter of parsedRoute.getParameters()) {
            if (parameter.query || parameter.queries) {
                const queryPath = parameter.typePath === undefined && parameter.query ? parameter.parameter.name : parameter.typePath || '';

                if (parameter.parameter.type.kind === ReflectionKind.class || parameter.parameter.type.kind === ReflectionKind.objectLiteral) {
                    for (const property of ReflectionClass.from(parameter.parameter.type).getProperties()) {
                        const accessor = `parameters.${parameter.getName()}?.${property.name}`;
                        const thisPath = queryPath ? queryPath + '.' + property.name : property.name;
                        modify.push(`${accessor} !== undefined && query.push(${JSON.stringify(dotToUrlPath(thisPath))} + '=' + encodeURIComponent(${accessor}))`);
                    }
                } else {
                    modify.push(`parameters.${parameter.getName()} !== undefined && query.push(${JSON.stringify(dotToUrlPath(queryPath))} + '=' + encodeURIComponent(parameters.${parameter.getName()}))`);

                }
            }
        }

        return `
            case ${JSON.stringify(routeConfig.name)}: {
                let url = \`${url}\`;
                let query = [];
                ${modify.join('\n')}
                return url + (query.length ? '?'+query.join('&') : '');
            }
        `;
    }

    public addRoute(routeConfig: RouteConfig) {
        this.registry.addRoute(routeConfig);
    }

    public addRouteForController(controller: ClassType, module: InjectorModule<any>) {
        this.registry.addRouteForController(controller, module);
    }

    protected build(): (request: HttpRequest) => ResolvedController | undefined {
        this.buildId = this.registry.getBuildId();
        const compiler = new CompilerContext;
        compiler.context.set('ValidationError', ValidationError);
        compiler.context.set('qs', qs);

        const code: string[] = [];

        for (const route of this.getRoutes()) {
            code.push(this.getRouteCode(compiler, route));
        }

        return compiler.build(`
            let _match;
            const _method = request.method || 'GET';
            const _url = request.url || '/';
            const _qPosition = _url.indexOf('?');
            let uploadedFiles = {};
            const _path = _qPosition === -1 ? _url : _url.substr(0, _qPosition);
            const _query = _qPosition === -1 ? {} : qs.parse(_url.substr(_qPosition + 1));
            ${code.join('\n')}
        `, 'request') as any;
    }

    protected buildUrlResolver(): any {
        const compiler = new CompilerContext;
        const code: string[] = [];

        for (const route of this.getRoutes()) {
            code.push(this.getRouteUrlResolveCode(compiler, route));
        }

        return compiler.build(`
        switch (name) {
            ${code.join('\n')}
        }
        throw new Error('No route for name ' + name + ' found');
        `, 'name', 'parameters') as any;
    }

    public resolveUrl(routeName: string, parameters: { [name: string]: any } = {}): string {
        if (!this.resolveFn) {
            this.resolveFn = this.buildUrlResolver();
        }

        return this.resolveFn!(routeName, parameters);
    }

    public resolveRequest(request: HttpRequest): ResolvedController | undefined {
        if (!this.fn || this.buildId !== this.registry.getBuildId()) {
            this.fn = this.build();
        }

        return this.fn(request);
    }

    public resolve(method: string, url: string): ResolvedController | undefined {
        method = method.toUpperCase();
        return this.resolveRequest({ url, method } as any);
    }
}
