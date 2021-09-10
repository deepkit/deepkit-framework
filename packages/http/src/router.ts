/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import 'reflect-metadata';
import { asyncOperation, ClassType, CompilerContext, getClassName, isClass, urlJoin } from '@deepkit/core';
import {
    entity,
    getClassSchema,
    getPropertyXtoClassFunction,
    JitConverterOptions,
    jitValidateProperty,
    jsonSerializer,
    PropertySchema,
    Serializer,
    t,
    ValidationFailed,
    ValidationFailedItem
} from '@deepkit/type';
// @ts-ignore
import formidable from 'formidable';
import { IncomingMessage } from 'http';
import querystring from 'querystring';
import { httpClass } from './decorator';
import { HttpRequest, HttpRequestQuery, HttpRequestResolvedParameters } from './model';
import { injectable, InjectOptions, InjectorContext, TagRegistry } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { HttpControllers } from './controllers';
import { AppModule, MiddlewareRegistry, MiddlewareRegistryEntry } from '@deepkit/app';
import { HttpMiddlewareConfig, HttpMiddlewareFn } from './middleware';

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
    @t.required size!: number;

    /**
     * The path this file is being written to.
     */
    @t.required path!: string;

    /**
     * The name this file had according to the uploading client.
     */
    @t.string.required.nullable name!: string | null;

    /**
     * The mime type of this file, according to the uploading client.
     */
    @t.string.required.nullable type!: string | null;

    /**
     * A Date object (or `null`) containing the time this file was last written to.
     * Mostly here for compatibility with the [W3C File API Draft](http://dev.w3.org/2006/webapi/FileAPI/).
     */
    @t.date.required.nullable lastModifiedDate!: Date | null;

    // /**
    //  * If `options.hash` calculation was set, you can read the hex digest out of this var.
    //  */
    // @t.string.required.nullable hash!: string | 'sha1' | 'md5' | 'sha256' | null;
}

function parseBody(form: any, req: IncomingMessage, files: { [name: string]: UploadedFile }) {
    return asyncOperation((resolve, reject) => {
        form.parse(req, (err: any, fields: any, files: any) => {
            if (err) {
                reject(err);
            } else {
                resolve({ fields, files });
            }
        });
    });
}

export interface RouteControllerAction {
    //if not set, the root module is used
    module?: AppModule<any>;
    controller: ClassType;
    methodName: string;
}

function getRouterControllerActionName(action: RouteControllerAction): string {
    return `${getClassName(action.controller)}.${action.methodName}`;
}

export interface RouteParameterConfig {
    type?: 'body' | 'query' | 'queries';
    /**
     * undefined = propertyName, '' === root, else given path
     */
    typePath?: string;

    optional: boolean;
    name: string;
}

export class RouteConfig {
    public baseUrl: string = '';
    public parameterRegularExpressions: { [name: string]: any } = {};

    public responses: { statusCode: number, description: string, type?: PropertySchema }[] = [];

    public description: string = '';
    public groups: string[] = [];
    public category: string = '';

    /**
     * This is set when the route action has a manual return type defined using @t.
     */
    public returnSchema?: PropertySchema;

    public serializationOptions?: JitConverterOptions;
    public serializer?: Serializer;

    /**
     * When assigned defines where this route came from.
     */
    public module?: AppModule<any>;

    resolverForToken: Map<any, ClassType> = new Map();

    middlewares: { config: HttpMiddlewareConfig, module: AppModule<any> }[] = [];

    resolverForParameterName: Map<string, ClassType> = new Map();

    /**
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    public parameters: {
        [name: string]: RouteParameterConfig
    } = {};

    constructor(
        public readonly name: string,
        public readonly httpMethods: string[],
        public readonly path: string,
        public readonly action: RouteControllerAction,
        public internal: boolean = false,
    ) {
    }

    getSchemaForResponse(statusCode: number): PropertySchema | undefined {
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

/**
 * When this class is injected into a route, then validation errors are not automatically thrown (using onHttpControllerValidationError event),
 * but injected to the route itself. The user is then responsible to handle the errors.
 *
 * Note: The body parameter is still passed, however it might contain now invalid data. The BodyValidation tells what data is invalid.
 */
export class BodyValidation {
    constructor(
        public readonly errors: ValidationFailedItem[] = []
    ) {
    }

    hasErrors(prefix?: string): boolean {
        return this.getErrors(prefix).length > 0;
    }

    getErrors(prefix?: string): ValidationFailedItem[] {
        if (prefix) return this.errors.filter(v => v.path.startsWith(prefix));

        return this.errors;
    }

    getErrorsForPath(path: string): ValidationFailedItem[] {
        return this.errors.filter(v => v.path === path);
    }

    getErrorMessageForPath(path: string): string {
        return this.getErrorsForPath(path).map(v => v.message).join(', ');
    }
}

class ParsedRoute {
    public regex?: string;
    public customValidationErrorHandling?: ParsedRouteParameter;

    public pathParameterNames: { [name: string]: number } = {};

    protected parameters: ParsedRouteParameter[] = [];

    constructor(public routeConfig: RouteConfig) {
    }

    addParameter(property: PropertySchema, config?: RouteParameterConfig): ParsedRouteParameter {
        const parameter = new ParsedRouteParameter(property, config);
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
        public property: PropertySchema,
        public config?: RouteParameterConfig,
    ) {
    }

    get body() {
        return this.config ? this.config.type === 'body' : false;
    }

    get query() {
        return this.config ? this.config.type === 'query' : false;
    }

    get queries() {
        return this.config ? this.config.type === 'queries' : false;
    }

    get typePath() {
        return this.config ? this.config.typePath : undefined;
    }

    getName() {
        return this.property.name;
    }

    isPartOfPath(): boolean {
        return this.regexPosition !== undefined;
    }
}

function parseRoutePathToRegex(routeConfig: RouteConfig): { regex: string, parameterNames: { [name: string]: number } } {
    const parameterNames: { [name: string]: number } = {};
    let path = routeConfig.getFullPath();

    let argumentIndex = 0;
    path = path.replace(/:(\w+)/g, (a, name) => {
        parameterNames[name] = argumentIndex;
        argumentIndex++;
        return routeConfig.parameterRegularExpressions[name] ? '(' + routeConfig.parameterRegularExpressions[name] + ')' : String.raw`([^/]+)`;
    });

    return { regex: path, parameterNames };
}

export function parseRouteControllerAction(routeConfig: RouteConfig): ParsedRoute {
    const schema = getClassSchema(routeConfig.action.controller);
    const parsedRoute = new ParsedRoute(routeConfig);

    const methodArgumentProperties = schema.getMethodProperties(routeConfig.action.methodName);
    const parsedPath = parseRoutePathToRegex(routeConfig);
    parsedRoute.regex = parsedPath.regex;
    parsedRoute.pathParameterNames = parsedPath.parameterNames;

    for (const property of methodArgumentProperties) {
        const decoratorData = routeConfig.parameters[property.name];
        const parsedParameter = parsedRoute.addParameter(property, decoratorData);

        if (decoratorData && decoratorData.optional) property.isOptional = true;

        if (property.type === 'class' && property.getResolvedClassType() === BodyValidation) {
            parsedRoute.customValidationErrorHandling = parsedParameter;
        }
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

function filterMiddlewaresForRoute(middlewareRawConfigs: MiddlewareRegistryEntry[], routeConfig: RouteConfig, fullPath: string): { config: HttpMiddlewareConfig, module: AppModule<any> }[] {
    const middlewares = middlewareRawConfigs.slice(0);
    middlewares.push(...routeConfig.middlewares);

    const middlewareConfigs = middlewares.filter((v) => {
        if (!(v.config instanceof HttpMiddlewareConfig)) return false;

        if (v.config.controllers.length && !v.config.controllers.includes(routeConfig.action.controller)) {
            return false;
        }

        if (v.config.excludeControllers.length && v.config.excludeControllers.includes(routeConfig.action.controller)) {
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
            for (const name of v.config.routeNames) {
                if (name.includes('*')) {
                    const regex = new RegExp('^' + name.replace(/\*/g, '.*') + '$');
                    if (!regex.test(routeConfig.name)) return false;
                } else if (name !== routeConfig.name) {
                    return false;
                }
            }
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
    }) as { config: HttpMiddlewareConfig, module: AppModule<any> }[];

    middlewareConfigs.sort((a, b) => {
        return a.config.order - b.config.order;
    });

    return middlewareConfigs;
}

@injectable
export class Router {
    protected fn?: (request: HttpRequest) => ResolvedController | undefined;
    protected resolveFn?: (name: string, parameters: { [name: string]: any }) => string;

    protected routes: RouteConfig[] = [];

    //todo, move some settings to KernelConfig
    protected form = formidable({
        multiples: true,
        hash: 'sha1',
        enabledPlugins: ['octetstream', 'querystring', 'json'],
    });

    constructor(
        controllers: HttpControllers,
        private logger: Logger,
        tagRegistry: TagRegistry,
        private middlewareRegistry: MiddlewareRegistry = new MiddlewareRegistry,
    ) {
        for (const controller of controllers.controllers) {
            this.addRouteForController(controller.controller, controller.module);
        }
    }

    getRoutes(): RouteConfig[] {
        return this.routes;
    }

    static forControllers(
        controllers: (ClassType | { module: AppModule<any>, controller: ClassType })[],
        tagRegistry: TagRegistry = new TagRegistry(),
        middlewareRegistry: MiddlewareRegistry = new MiddlewareRegistry(),
        module: AppModule<any> = new AppModule({})
    ): Router {
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
        let bodyValidationErrorHandling = `if (bodyErrors.length) throw ValidationFailed.from(bodyErrors);`;

        let enableParseBody = false;
        const hasParameters = parsedRoute.getParameters().length > 0;
        let requiresAsyncParameters = false;
        let setParametersFromPath = '';

        const fullPath = routeConfig.getFullPath();
        const middlewareConfigs = filterMiddlewaresForRoute(this.middlewareRegistry.configs, routeConfig, fullPath);

        for (const parameter of parsedRoute.getParameters()) {
            if (parsedRoute.customValidationErrorHandling === parameter) {
                compiler.context.set('BodyValidation', BodyValidation);
                bodyValidationErrorHandling = '';
                setParameters.push(`parameters.${parameter.property.name} = new BodyValidation(bodyErrors);`);
                parameterNames.push(`parameters.${parameter.property.name}`);
            } else if (parameter.body) {
                const validatorVar = compiler.reserveVariable('argumentValidator', jitValidateProperty(parameter.property));
                const converterVar = compiler.reserveVariable('argumentConverter', getPropertyXtoClassFunction(parameter.property, jsonSerializer));

                enableParseBody = true;
                setParameters.push(`parameters.${parameter.property.name} = ${converterVar}(bodyFields);`);
                parameterValidator.push(`${validatorVar}(parameters.${parameter.property.name}, ${JSON.stringify(parameter.typePath || '')}, bodyErrors);`);
                parameterNames.push(`parameters.${parameter.property.name}`);
            } else if (parameter.query || parameter.queries) {
                const converted = parameter.property.type === 'any' ? (v: any) => v : getPropertyXtoClassFunction(parameter.property, jsonSerializer);
                const validator = parameter.property.type === 'any' ? (v: any) => undefined : jitValidateProperty(parameter.property);
                const converterVar = compiler.reserveVariable('argumentConverter', converted);
                const validatorVar = compiler.reserveVariable('argumentValidator', validator);

                const queryPath = parameter.typePath === undefined ? parameter.property.name : parameter.typePath;
                const accessor = queryPath ? `['` + (queryPath.replace(/\./g, `']['`)) + `']` : '';
                const queryAccessor = queryPath ? `_query${accessor}` : '_query';

                setParameters.push(`parameters.${parameter.property.name} = ${converterVar}(${queryAccessor});`);
                parameterNames.push(`parameters.${parameter.property.name}`);
                parameterValidator.push(`${validatorVar}(parameters.${parameter.property.name}, ${JSON.stringify(parameter.typePath)}, validationErrors);`);
            } else {
                parameterNames.push(`parameters.${parameter.property.name}`);

                if (parameter.isPartOfPath()) {
                    if (parameter.property.type !== 'class') {
                        const converted = parameter.property.type === 'any' ? (v: any) => v : getPropertyXtoClassFunction(parameter.property, jsonSerializer);
                        const converterVar = compiler.reserveVariable('argumentConverter', converted);
                        setParameters.push(`parameters.${parameter.property.name} = ${converterVar}(_match[${1 + (parameter.regexPosition || 0)}]);`);

                        const validator = parameter.property.type === 'any' ? (v: any) => undefined : jitValidateProperty(parameter.property);
                        const validatorVar = compiler.reserveVariable('argumentValidator', validator);
                        parameterValidator.push(`${validatorVar}(parameters.${parameter.property.name}, ${JSON.stringify(parameter.getName())}, validationErrors);`);
                    } else {
                        setParameters.push(`parameters.${parameter.property.name} = _match[${1 + (parameter.regexPosition || 0)}];`);
                    }
                }

                const injectorOptions = parameter.property.data['deepkit/inject'] as InjectOptions | undefined;

                const injectorToken = injectorOptions && injectorOptions.token ? injectorOptions.token : (parameter.property.type === 'class' ? parameter.property.getResolvedClassType() : undefined);
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
                        parameters.${parameter.property.name} = await ${instance}.resolve({
                            token: ${injectorTokenVar},
                            routeConfig: ${routeConfigVar},
                            request: request,
                            name: ${JSON.stringify(parameter.property.name)},
                            value: parameters.${parameter.property.name},
                            query: _query,
                            parameters: parameters
                        });
                    }`);
                } else {
                    if (!parameter.isPartOfPath() && parameter.property.type !== 'class' && (!injectorOptions || !injectorOptions.token)) {
                        throw new Error(
                            `Route parameter '${parameter.property.name}' of ${getRouterControllerActionName(routeConfig.action)} is not a ClassType nor is a @inject(T) set. It can not be requested from the DI container like that.` +
                            `If its a query parameter use '@http.query() ${parameter.property.name}' or if its a body '@http.body() ${parameter.property.name}'.`
                        );
                    }
                }

                if (!parameter.isPartOfPath()) {
                    let injectorGet = `parameters.${parameter.property.name} = ${injector}.get(${injectorTokenVar});`;
                    if (injectorOptions && injectorOptions.optional) {
                        injectorGet = `try {parameters.${parameter.property.name} = ${injector}.get(${injectorTokenVar}); } catch (e) {}`;
                    }
                    setParameters.push(`if (!${parameterResolverFoundVar}) ${injectorGet}`);
                }
            }
        }

        let parseBodyLoading = '';
        if (enableParseBody) {
            const parseBodyVar = compiler.reserveVariable('parseBody', parseBody);
            const formVar = compiler.reserveVariable('form', this.form);
            parseBodyLoading = `
            const bodyParsed = (await ${parseBodyVar}(${formVar}, request, uploadedFiles));
            const bodyFields = {...bodyParsed.fields, ...bodyParsed.files};`;
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
                const moduleVar = middlewareConfig.module ? ', ' + compiler.reserveVariable('module', middlewareConfig.module): '';

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
                if (validationErrors.length) throw ValidationFailed.from(validationErrors);
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
                const queryPath = parameter.typePath === undefined ? parameter.property.name : parameter.typePath;

                if (parameter.property.type === 'class') {
                    for (const property of parameter.property.getResolvedClassSchema().getProperties()) {
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
        this.routes.push(routeConfig);
        this.fn = undefined;
    }

    public addRouteForController(controller: ClassType, module: AppModule<any>) {
        const data = httpClass._fetch(controller);
        if (!data) throw new Error(`Http controller class ${getClassName(controller)} has no @http.controller decorator.`);
        const schema = getClassSchema(controller);

        for (const action of data.getActions()) {
            const routeConfig = new RouteConfig(action.name, action.httpMethods, action.path, {
                controller,
                module,
                methodName: action.methodName
            });
            routeConfig.module = module;
            routeConfig.parameterRegularExpressions = action.parameterRegularExpressions;
            routeConfig.responses = action.responses;
            routeConfig.description = action.description;
            routeConfig.category = action.category;
            routeConfig.groups = action.groups;
            routeConfig.data = new Map(action.data);
            routeConfig.baseUrl = data.baseUrl;

            routeConfig.middlewares = data.middlewares.map(v => {
                return { config: v(), module };
            });
            routeConfig.middlewares.push(...action.middlewares.map(v => {
                return { config: v(), module };
            }));

            for (const item of action.resolverForToken) routeConfig.resolverForToken.set(...item);

            routeConfig.resolverForToken = new Map(data.resolverForToken);
            for (const item of action.resolverForToken) routeConfig.resolverForToken.set(...item);

            routeConfig.resolverForParameterName = new Map(data.resolverForParameterName);
            for (const item of action.resolverForParameterName) routeConfig.resolverForParameterName.set(...item);

            routeConfig.parameters = { ...action.parameters };
            routeConfig.serializationOptions = action.serializationOptions;
            routeConfig.serializer = action.serializer;
            routeConfig.serializer = action.serializer;
            if (schema.hasMethod(action.methodName)) routeConfig.returnSchema = schema.getMethod(action.methodName);
            this.addRoute(routeConfig);
        }
    }

    protected build(): (request: HttpRequest) => ResolvedController | undefined {
        const compiler = new CompilerContext;
        compiler.context.set('ValidationFailed', ValidationFailed);
        compiler.context.set('qs', require('qs'));

        const code: string[] = [];

        for (const route of this.routes) {
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

        for (const route of this.routes) {
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
        if (!this.fn) {
            this.fn = this.build();
        }

        return this.fn(request);
    }

    public resolve(method: string, url: string): ResolvedController | undefined {
        method = method.toUpperCase();
        return this.resolveRequest({url, method} as any);
    }
}
