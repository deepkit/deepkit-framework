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

import {arrayRemoveItem, asyncOperation, ClassType, CompilerContext, toFastProperties} from '@deepkit/core';
import {join} from 'path';
import {getClassSchema, getPropertyXtoClassFunction, isRegisteredEntity, jitValidateProperty, jsonSerializer, PropertySchema} from '@deepkit/type';
import {ValidationError, ValidationErrorItem} from '@deepkit/framework-shared';
import {httpClass} from './decorator';
import {injectable, Injector} from './injector/injector';
import {Logger} from './logger';
import {IncomingMessage, ServerResponse} from 'http';
import * as formidable from 'formidable';

type ResolvedController = { controller: ClassType, parameters: (injector: Injector) => any[], method: string };

export class RouterControllers {
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

@injectable()
export class Router {
    protected fn: (request: IncomingMessage) => Promise<ResolvedController | undefined>;

    //todo, move some settings to ApplicationConfig
    protected form = formidable({
        multiples: true,
        hash: 'sha1',
        enabledPlugins: ['octetstream', 'querystring', 'json'],
    });

    constructor(controllers: RouterControllers, private logger: Logger) {
        this.fn = this.build(controllers.controllers);
        // console.log('router', this.fn!.toString());
    }

    static forControllers(controllers: ClassType[]): Router {
        return new this(new RouterControllers(controllers), new Logger([], []));
    }

    protected getControllerCode(compiler: CompilerContext, controller: ClassType): string {
        const data = httpClass._fetch(controller);
        if (!data) return '';
        const staticRules = compiler.context.get('_static') as any;
        const controllerVar = compiler.reserveVariable('controller', controller);
        const schema = getClassSchema(controller);

        const excludedClassTypesForBody: any[] = [IncomingMessage, ServerResponse, BodyValidation];

        const code: string[] = [];
        for (const action of data.actions) {
            const methodArgumentProperties = schema.getMethodProperties(action.methodName);
            const methodArgumentPropertiesByName: { [name: string]: PropertySchema } = {};
            const parameterValidators: { [name: string]: (v: any) => any } = {};
            const parameterConverter: { [name: string]: (v: any) => any } = {};
            const manualInjection: string[] = [];
            let requiresBodyParser: PropertySchema | undefined = undefined;
            let customValidationErrorHandling: PropertySchema | undefined = undefined;

            for (const property of methodArgumentProperties) {
                methodArgumentPropertiesByName[property.name] = property;
                manualInjection.push(property.name);

                if (property.type === 'class' && property.classType === BodyValidation) {
                    customValidationErrorHandling = property;
                } else if (property.type === 'class' && !excludedClassTypesForBody.includes(property.getResolvedClassType()) && isRegisteredEntity(property.getResolvedClassType())) {
                    requiresBodyParser = property;
                    parameterValidators[property.name] = jitValidateProperty(property);
                    parameterConverter[property.name] = getPropertyXtoClassFunction(property, jsonSerializer);
                }
            }
            const parameterRegExIndex: { [name: string]: number } = {};

            let path = data.baseUrl ? join(data.baseUrl, action.path) : action.path;
            if (!path.startsWith('/')) path = '/' + path;

            const prefix = path.substr(0, path.indexOf(':'));

            let argumentIndex = 0;
            path = path.replace(/:(\w+)/g, (a, name) => {
                if (!methodArgumentPropertiesByName[name]) {
                    this.logger.warning(`Method ${schema.getClassPropertyName(action.methodName)} has no function argument defined named ${name}.`);
                } else {
                    parameterRegExIndex[name] = argumentIndex;
                    arrayRemoveItem(manualInjection, name);
                    const property = methodArgumentPropertiesByName[name];
                    if (property.type === 'any') {
                        parameterValidators[name] = (v: any) => undefined;
                        parameterConverter[name] = (v: any) => v;
                    } else {
                        parameterValidators[name] = jitValidateProperty(property);
                        parameterConverter[name] = getPropertyXtoClassFunction(methodArgumentPropertiesByName[name], jsonSerializer);
                    }
                }

                argumentIndex++;
                return action.parameterRegularExpressions[name] ? '(' + action.parameterRegularExpressions[name] + ')' : String.raw`([^/]+)`;
            });

            const methodNameVar = compiler.reserveVariable('methodName', action.methodName);
            if (path.length === 0) {
                //static rule
                staticRules[action.httpMethod + path] = {controller, method: action.methodName, parameters: () => []};
            } else {
                const regexVar = compiler.reserveVariable('regex', new RegExp('^' + path + '$'));
                const setParameters: string[] = [];
                const parameterValidator: string[] = [];
                let bodyValidationErrorHandling = `if (bodyErrors.length) throw ValidationError.from(bodyErrors);`;

                for (const property of methodArgumentProperties) {
                    if (parameterRegExIndex[property.name] !== undefined) {
                        const converterVar = compiler.reserveVariable('argumentConverter', parameterConverter[property.name]);
                        setParameters.push(`${converterVar}(_match[1 + ${parameterRegExIndex[property.name]}])`);
                        const validatorVar = compiler.reserveVariable('argumentValidator', parameterValidators[property.name]);
                        parameterValidator.push(`${validatorVar}(_match[1 + ${parameterRegExIndex[property.name]}], ${JSON.stringify(property.name)}, validationErrors);`);
                    } else {
                        if (customValidationErrorHandling === property) {
                            compiler.context.set('BodyValidation', BodyValidation);
                            bodyValidationErrorHandling = '';
                            setParameters.push(`new BodyValidation(bodyErrors)`);
                        } else if (requiresBodyParser === property) {
                            const parseBodyVar = compiler.reserveVariable('parseBody', parseBody);
                            const formVar = compiler.reserveVariable('form', this.form);
                            const bodyVar = compiler.reserveVariable('body');
                            const validatorVar = compiler.reserveVariable('argumentValidator', parameterValidators[property.name]);

                            const converterVar = compiler.reserveVariable('argumentConverter', parameterConverter[property.name]);
                            parameterValidator.push(`
                            ${bodyVar} = ${converterVar}((await ${parseBodyVar}(${formVar}, request)).fields);
                            ${validatorVar}(${bodyVar}, '', bodyErrors);
                            `);
                            setParameters.push(bodyVar);
                        } else if (property.type === 'class') {
                            const classType = compiler.reserveVariable('classType', property.getResolvedClassType());
                            setParameters.push(`_injector.get(${classType})`);
                        }
                    }
                }

                const actionCode = `
                    //=> ${path}
                    if (request.method === '${action.httpMethod}' && request.url.startsWith(${JSON.stringify(prefix)}) && (_match = request.url.match(${regexVar}))) {
                        const validationErrors = [];
                        const bodyErrors = [];
                        ${parameterValidator.join('\n')}
                        ${bodyValidationErrorHandling}
                        if (validationErrors.length) throw ValidationError.from(validationErrors);
                        return {controller: ${controllerVar}, parameters: (_injector) => [${setParameters.join(',')}], method: ${methodNameVar}};
                    }
                `;

                code.push(actionCode);
            }
        }

        return code.join('\n');
    }

    protected build(controllers: ClassType[]): any {
        const compiler = new CompilerContext;
        compiler.context.set('_match', null);
        const staticRules = {};
        compiler.context.set('_static', staticRules);
        compiler.context.set('ValidationError', ValidationError);

        const code: string[] = [];

        for (const controller of controllers) {
            code.push(this.getControllerCode(compiler, controller));
        }

        toFastProperties(staticRules);
        return compiler.buildAsync(`
            if (_static.hasOwnProperty(request.method + request.url)) return _static[request.method + request.url];
            ${code.join('\n')}
        `, 'request') as any;
    }

    public isBuilt() {
        return !!this.fn;
    }

    async resolveRequest(request: IncomingMessage): Promise<ResolvedController | undefined> {
        return this.fn(request);
    }

    async resolve(method: string, url: string): Promise<ResolvedController | undefined> {
        return this.fn({
            method,
            url
        } as IncomingMessage);
    }
}
