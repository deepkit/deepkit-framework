/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {asyncOperation, ClassType, CompilerContext} from '@deepkit/core';
import {join} from 'path';
import {getClassSchema, getPropertyXtoClassFunction, jitValidateProperty, jsonSerializer, PropertySchema} from '@deepkit/type';
import {ValidationError, ValidationErrorItem} from '@deepkit/framework-shared';
import {httpClass} from './decorator';
import {BasicInjector, injectable} from './injector/injector';
import {Logger} from './logger';
import {IncomingMessage} from 'http';
import formidable from 'formidable';
import querystring from 'querystring';

type ResolvedController = { parameters: (injector: BasicInjector) => any[], routeConfig: RouteConfig };

export class HttpControllers {
    constructor(public readonly controllers: ClassType[]) {
    }

    public add(controller: ClassType) {
        this.controllers.push(controller);
    }
}

function parseBody(form: any, req: IncomingMessage) {
    return asyncOperation((resolve, reject) => {
        form.parse(req, (err: any, fields: any, files: any) => {
            if (err) {
                reject(err);
            } else {
                resolve({fields, files});
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

    public parameters: {
        [name: string]: RouteParameterConfig
    } = {};

    constructor(
        public readonly name: string,
        public readonly httpMethod: string,
        public readonly path: string,
        public readonly action: RouteControllerAction,
    ) {
        this.httpMethod = this.httpMethod.toLowerCase();
    }

    getFullPath(): string {
        let path = this.baseUrl ? join(this.baseUrl, this.path) : this.path;
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
        public readonly errors: ValidationErrorItem[] = []
    ) {
    }

    hasErrors(prefix?: string): boolean {
        return this.getErrors(prefix).length > 0;
    }

    getErrors(prefix?: string): ValidationErrorItem[] {
        if (prefix) return this.errors.filter(v => v.path.startsWith(prefix));

        return this.errors;
    }

    getErrorsForPath(path: string): ValidationErrorItem[] {
        return this.errors.filter(v => v.path === path);
    }

    getErrorMessageForPath(path: string): string {
        return this.getErrorsForPath(path).map(v => v.message).join(', ');
    }
}

class ParsedRoute {
    public regex?: string;
    public customValidationErrorHandling?: ParsedRouteParameter;

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

    return {regex: path, parameterNames};
}

export function parseRouteControllerAction(routeConfig: RouteConfig): ParsedRoute {
    const schema = getClassSchema(routeConfig.action.controller);
    const parsedRoute = new ParsedRoute(routeConfig);

    const methodArgumentProperties = schema.getMethodProperties(routeConfig.action.methodName);
    const parsedPath = parseRoutePathToRegex(routeConfig);
    parsedRoute.regex = parsedPath.regex;

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

@injectable()
export class Router {
    protected fn?: (request: IncomingMessage) => Promise<ResolvedController | undefined>;

    protected routes: RouteConfig[] = [];

    //todo, move some settings to ApplicationConfig
    protected form = formidable({
        multiples: true,
        hash: 'sha1',
        enabledPlugins: ['octetstream', 'querystring', 'json'],
    });

    constructor(controllers: HttpControllers, private logger: Logger) {
        for (const controller of controllers.controllers) this.addRouteForController(controller);
    }

    getRoutes(): RouteConfig[] {
        return this.routes;
    }

    static forControllers(controllers: ClassType[]): Router {
        return new this(new HttpControllers(controllers), new Logger([], []));
    }

    protected getRouteCode(compiler: CompilerContext, routeConfig: RouteConfig): string {
        const routeConfigVar = compiler.reserveVariable('routeConfigVar', routeConfig);
        const parsedRoute = parseRouteControllerAction(routeConfig);
        const path = routeConfig.getFullPath();
        const prefix = path.substr(0, path.indexOf(':'));

        const regexVar = compiler.reserveVariable('regex', new RegExp('^' + parsedRoute.regex + '$'));
        const setParameters: string[] = [];
        const parameterValidator: string[] = [];
        let bodyValidationErrorHandling = `if (bodyErrors.length) throw ValidationError.from(bodyErrors);`;

        let enableParseBody = false;

        for (const parameter of parsedRoute.getParameters()) {
            if (parameter.isPartOfPath()) {
                const converted = parameter.property.type === 'any' ? (v: any) => v : getPropertyXtoClassFunction(parameter.property, jsonSerializer);
                const validator = parameter.property.type === 'any' ? (v: any) => undefined : jitValidateProperty(parameter.property);
                const converterVar = compiler.reserveVariable('argumentConverter', converted);
                const validatorVar = compiler.reserveVariable('argumentValidator', validator);

                setParameters.push(`${converterVar}(_match[1 + ${parameter.regexPosition}])`);
                parameterValidator.push(`${validatorVar}(_match[1 + ${parameter.regexPosition}], ${JSON.stringify(parameter.getName())}, validationErrors);`);
            } else {
                if (parsedRoute.customValidationErrorHandling === parameter) {
                    compiler.context.set('BodyValidation', BodyValidation);
                    bodyValidationErrorHandling = '';
                    setParameters.push(`new BodyValidation(bodyErrors)`);
                } else if (parameter.body) {
                    const bodyVar = compiler.reserveVariable('body');

                    const validatorVar = compiler.reserveVariable('argumentValidator', jitValidateProperty(parameter.property));
                    const converterVar = compiler.reserveVariable('argumentConverter', getPropertyXtoClassFunction(parameter.property, jsonSerializer));

                    enableParseBody = true;
                    parameterValidator.push(`
                    ${bodyVar} = ${converterVar}(bodyFields);
                    ${validatorVar}(${bodyVar}, ${JSON.stringify(parameter.typePath || '')}, bodyErrors);
                    `);
                    setParameters.push(bodyVar);
                    // } else if (parameter.property.type === 'class') {
                } else if (parameter.query) {
                    const converted = parameter.property.type === 'any' ? (v: any) => v : getPropertyXtoClassFunction(parameter.property, jsonSerializer);
                    const validator = parameter.property.type === 'any' ? (v: any) => undefined : jitValidateProperty(parameter.property);
                    const converterVar = compiler.reserveVariable('argumentConverter', converted);
                    const validatorVar = compiler.reserveVariable('argumentValidator', validator);

                    const queryPath = parameter.typePath === undefined ? parameter.property.name : parameter.typePath;
                    const accessor = queryPath ? `['` + (queryPath.replace(/\./g, `']['`)) + `']` : '';
                    const queryAccessor = queryPath ? `_query${accessor}` : '_query';
                    setParameters.push(`${converterVar}(${queryAccessor})`);
                    parameterValidator.push(`${validatorVar}(${queryAccessor}, ${JSON.stringify(parameter.typePath)}, validationErrors);`);
                } else {
                    const classType = compiler.reserveVariable('classType', parameter.property.getResolvedClassType());
                    setParameters.push(`_injector.get(${classType})`);
                }
            }
        }

        let parseBodyLoading = '';
        if (enableParseBody) {
            const parseBodyVar = compiler.reserveVariable('parseBody', parseBody);
            const formVar = compiler.reserveVariable('form', this.form);
            parseBodyLoading = `const bodyFields = (await ${parseBodyVar}(${formVar}, request)).fields;`;
        }

        return `
            //=> ${path}
            if (_method === '${routeConfig.httpMethod}' && _path.startsWith(${JSON.stringify(prefix)}) && (_match = _path.match(${regexVar}))) {
                const validationErrors = [];
                const bodyErrors = [];
                ${parseBodyLoading}
                ${parameterValidator.join('\n')}
                ${bodyValidationErrorHandling}
                if (validationErrors.length) throw ValidationError.from(validationErrors);
                return {routeConfig: ${routeConfigVar}, parameters: (_injector) => [${setParameters.join(',')}]};
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

        for (const action of data.getActions()) {
            const routeConfig = new RouteConfig(action.name, action.httpMethod, action.path, {controller, methodName: action.methodName});
            routeConfig.parameterRegularExpressions = action.parameterRegularExpressions;
            routeConfig.throws = action.throws;
            routeConfig.description = action.description;
            routeConfig.category = action.category;
            routeConfig.groups = action.groups;
            routeConfig.baseUrl = data.baseUrl;
            routeConfig.parameters = {...action.parameters};
            this.addRoute(routeConfig);
        }
    }

    protected build(): any {
        const compiler = new CompilerContext;
        compiler.context.set('_match', null);
        compiler.context.set('ValidationError', ValidationError);
        compiler.context.set('parseQueryString', querystring.parse);

        const code: string[] = [];

        for (const route of this.routes) {
            code.push(this.getRouteCode(compiler, route));
        }

        return compiler.buildAsync(`
            const _method = request.method.toLowerCase();
            const _qPosition = request.url.indexOf('?');
            const _path = _qPosition === -1 ? request.url : request.url.substr(0, _qPosition); 
            const _query = _qPosition === -1 ? {} : parseQueryString(request.url.substr(_qPosition + 1));
            ${code.join('\n')}
        `, 'request') as any;
    }

    async resolveRequest(request: IncomingMessage): Promise<ResolvedController | undefined> {
        if (!this.fn) {
            this.fn = this.build();
        }

        return this.fn!(request);
    }

    async resolve(method: string, url: string): Promise<ResolvedController | undefined> {
        return this.resolveRequest({
            method,
            url
        } as IncomingMessage);
    }
}
