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
import { asyncOperation, ClassType, CompilerContext, getClassName, urlJoin } from '@deepkit/core';
import {
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
import { BasicInjector, injectable, NormalizedProvider, Tag, TagProvider, TagRegistry } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { HttpControllers } from './controllers';

export type RouteParameterResolverForInjector = ((injector: BasicInjector) => any[] | Promise<any[]>);
type ResolvedController = { parameters: RouteParameterResolverForInjector, routeConfig: RouteConfig, uploadedFiles: { [name: string]: UploadedFile } };

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

        form.on('file', (name: string, file: UploadedFile) => {
            files[name] = file;
        });
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
    controller: ClassType;
    methodName: string;
}

export interface RouteParameterConfig {
    type?: 'body' | 'query';
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
    public throws: { errorType: ClassType, message?: string }[] = [];
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
     * An arbitrary data container the user can use to store app specific settings/values.
     */
    data = new Map<any, any>();

    public parameters: {
        [name: string]: RouteParameterConfig
    } = {};

    constructor(
        public readonly name: string,
        public readonly httpMethod: string,
        public readonly path: string,
        public readonly action: RouteControllerAction,
    ) {
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

        if (property.type === 'class' && property.classType === BodyValidation) {
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
    classType: ClassType;
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

export class ParameterResolverTagProvider extends TagProvider<any> {
    public classTypes: ClassType[] = [];

    forClassType(...classTypes: ClassType[]): this {
        this.classTypes = classTypes;
        return this;
    }
}

export class RouteParameterResolverTag extends Tag<RouteParameterResolver, ParameterResolverTagProvider> {
    protected createTagProvider(provider: NormalizedProvider<any>): ParameterResolverTagProvider {
        return new ParameterResolverTagProvider(provider, this);
    }
}

@injectable()
export class Router {
    protected fn?: (request: HttpRequest) => ResolvedController | undefined;
    protected resolveFn?: (name: string, parameters: { [name: string]: any }) => string;

    protected routes: RouteConfig[] = [];

    protected parameterResolverTags: TagProvider<RouteParameterResolverTag>[] = [];

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
    ) {
        this.parameterResolverTags = tagRegistry.resolve(RouteParameterResolverTag);

        for (const controller of controllers.controllers) this.addRouteForController(controller);
    }

    getRoutes(): RouteConfig[] {
        return this.routes;
    }

    static forControllers(controllers: ClassType[], tagRegistry: TagRegistry = new TagRegistry()): Router {
        return new this(new HttpControllers(controllers), new Logger([], []), tagRegistry);
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
            } else if (parameter.query) {
                const converted = parameter.property.type === 'any' ? (v: any) => v : getPropertyXtoClassFunction(parameter.property, jsonSerializer);
                const validator = parameter.property.type === 'any' ? (v: any) => undefined : jitValidateProperty(parameter.property);
                const converterVar = compiler.reserveVariable('argumentConverter', converted);
                const validatorVar = compiler.reserveVariable('argumentValidator', validator);

                const queryPath = parameter.typePath === undefined ? parameter.property.name : parameter.typePath;
                const accessor = queryPath ? `['` + (queryPath.replace(/\./g, `']['`)) + `']` : '';
                const queryAccessor = queryPath ? `_query${accessor}` : '_query';
                setParameters.push(`parameters.${parameter.property.name} = ${converterVar}(${queryAccessor});`);
                parameterNames.push(`parameters.${parameter.property.name}`);
                parameterValidator.push(`${validatorVar}(${queryAccessor}, ${JSON.stringify(parameter.typePath)}, validationErrors);`);
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
                        setParameters.push(`parameters.${parameter.property.name} =_match[${1 + (parameter.regexPosition || 0)}];`);
                    }
                }

                if (parameter.property.type === 'class') {
                    const classType = parameter.property.getResolvedClassType();
                    const classTypeVar = compiler.reserveVariable('classType', classType);
                    const parameterResolverFoundVar = compiler.reserveVariable('parameterResolverFound', false);

                    setParameters.push(`${parameterResolverFoundVar} = false;`);

                    //make sure all parameter values from the path are available
                    if (this.parameterResolverTags.length && !setParametersFromPath) {
                        for (const i in parsedRoute.pathParameterNames) {
                            setParametersFromPath += `parameters.${i} = _match[${1 + parsedRoute.pathParameterNames[i]}];`;
                        }
                    }

                    for (const resolverTag of this.parameterResolverTags) {
                        if (resolverTag instanceof ParameterResolverTagProvider && resolverTag.classTypes.length && !resolverTag.classTypes.includes(classType)) continue;

                        const resolverProvideTokenVar = compiler.reserveVariable('resolverProvideToken', resolverTag.provider.provide);
                        requiresAsyncParameters = true;
                        const instance = compiler.reserveVariable('resolverInstance');
                        setParameters.push(`
                            //resolver ${getClassName(resolverTag.provider.provide)} for ${parameter.getName()}
                            ${instance} = _injector.get(${resolverProvideTokenVar});
                            if (!${parameterResolverFoundVar}) {
                                ${parameterResolverFoundVar} = true;
                                parameters.${parameter.property.name} = await ${instance}.resolve({
                                    classType: ${classTypeVar},
                                    routeConfig: ${routeConfigVar},
                                    request: request,
                                    name: ${JSON.stringify(parameter.property.name)},
                                    value: parameters.${parameter.property.name},
                                    query: _query,
                                    parameters: parameters
                                });
                            }`);
                    }

                    setParameters.push(`if (!${parameterResolverFoundVar}) parameters.${parameter.property.name} = _injector.get(${classTypeVar});`);
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

        return `
            //=> ${path}
            if (_method === '${routeConfig.httpMethod.toLowerCase()}' && ${matcher}) {
                return {routeConfig: ${routeConfigVar}, parameters: ${parameters}, uploadedFiles: uploadedFiles};
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
            if (parameter.query) {
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

    public addRouteForController(controller: ClassType) {
        const data = httpClass._fetch(controller);
        if (!data) return;
        const schema = getClassSchema(controller);

        for (const action of data.getActions()) {
            const routeConfig = new RouteConfig(action.name, action.httpMethod, action.path, {
                controller,
                methodName: action.methodName
            });
            routeConfig.parameterRegularExpressions = action.parameterRegularExpressions;
            routeConfig.throws = action.throws;
            routeConfig.description = action.description;
            routeConfig.category = action.category;
            routeConfig.groups = action.groups;
            routeConfig.data = new Map(action.data);
            routeConfig.baseUrl = data.baseUrl;
            routeConfig.parameters = { ...action.parameters };
            routeConfig.serializationOptions = action.serializationOptions;
            routeConfig.serializer = action.serializer;
            if (schema.hasMethod(action.methodName)) routeConfig.returnSchema = schema.getMethod(action.methodName);
            this.addRoute(routeConfig);
        }
    }

    protected build(): any {
        const compiler = new CompilerContext;
        compiler.context.set('_match', null);
        compiler.context.set('ValidationFailed', ValidationFailed);
        compiler.context.set('parseQueryString', querystring.parse);

        const code: string[] = [];

        for (const route of this.routes) {
            code.push(this.getRouteCode(compiler, route));
        }

        return compiler.build(`
            const _method = request.getMethod().toLowerCase();
            const _url = request.getUrl();
            const _qPosition = _url.indexOf('?');
            let uploadedFiles = {};
            const _path = _qPosition === -1 ? _url : _url.substr(0, _qPosition);
            const _query = _qPosition === -1 ? {} : parseQueryString(_url.substr(_qPosition + 1));
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

        return this.fn!(request);
    }

    public resolve(method: string, url: string): ResolvedController | undefined {
        return this.resolveRequest({
            getUrl() {
                return url;
            },
            getMethod() {
                return method;
            },
        } as any);
    }
}
