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

import {ClassType, CompilerContext, toFastProperties} from '@deepkit/core';
import {join} from 'path';
import {getClassSchema, getPropertyXtoClassFunction, jitValidateProperty, jsonSerializer} from '@deepkit/type';
import {ValidationError} from '@deepkit/framework-shared';
import {httpClass} from './decorator';
import {injectable} from './injector/injector';

type ResolvedController = { controller: ClassType, parameters: string[], method: string };

export class RouterControllers {
    constructor(public readonly controllers: ClassType[]) {
    }

    public add(controller: ClassType) {
        this.controllers.push(controller);
    }
}

@injectable()
export class Router {
    protected fn: (httpMethod: string, path: string) => ResolvedController;

    constructor(controllers: RouterControllers) {
        this.fn = this.build(controllers.controllers);
    }

    static forControllers(controllers: ClassType[]): Router {
        return new this(new RouterControllers(controllers));
    }

    protected getControllerCode(compiler: CompilerContext, controller: ClassType): string {
        const data = httpClass._fetch(controller);
        if (!data) return '';
        const staticRules = compiler.context.get('_static') as any;
        const controllerVar = compiler.reserveVariable('controller', controller);
        const schema = getClassSchema(controller);

        const code: string[] = [];
        for (const action of data.actions) {
            const methodArgumentProperties = schema.getMethodProperties(action.methodName);


            let path = data.baseUrl ? join(data.baseUrl, action.path) : action.path;
            if (!path.startsWith('/')) path = '/' + path;

            const names: string[] = [];
            const validators: Function[] = [];
            const converter: Function[] = [];
            const prefix = path.substr(0, path.indexOf(':'));
            let argumentIndex = 0;

            path = path.replace(/(:\w+)/, function (a, b, c, name) {
                names.push(name);
                if (!methodArgumentProperties[argumentIndex]) throw new Error(`Method ${schema.getClassPropertyName(action.methodName)} has no argument defined at #${argumentIndex}`);

                validators.push(jitValidateProperty(methodArgumentProperties[argumentIndex]));
                converter.push(getPropertyXtoClassFunction(methodArgumentProperties[argumentIndex], jsonSerializer));
                argumentIndex++;
                return action.parameterRegularExpressions[name] || String.raw`([^/]+)`;
            });

            const methodNameVar = compiler.reserveVariable('methodName', action.methodName);
            if (names.length === 0) {
                //static rule
                staticRules[action.httpMethod + path] = {controller, method: action.methodName, parameters: []};
            } else {
                const regexVar = compiler.reserveVariable('regex', new RegExp('^' + path + '$'));
                const setParameters: string[] = [];
                const parameterValidator: string[] = [];
                for (let i = 0; i < names.length; i++) {
                    const converterVar = compiler.reserveVariable('argumentConverter', converter[i]);
                    setParameters.push(`${converterVar}(_match[1 + ${i}])`);
                    const validatorVar = compiler.reserveVariable('argumentValidator', validators[i]);
                    parameterValidator.push(`${validatorVar}(_match[1 + ${i}], ${JSON.stringify(names[i])}, validationErrors);`);
                }

                const actionCode = `
                    //=> ${path}
                    if (_method === '${action.httpMethod}' && _path.startsWith(${JSON.stringify(prefix)}) && (_match = _path.match(${regexVar}))) {
                        const validationErrors = [];
                        ${parameterValidator.join('\n')}
                        if (validationErrors.length) throw ValidationError.from(validationErrors);
                        return {controller: ${controllerVar}, parameters: [${setParameters.join(',')}], method: ${methodNameVar}};
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
        return compiler.build(`
            if (_static.hasOwnProperty(_method + _path)) return _static[_method + _path];
            ${code.join('\n')}
        `, '_method', '_path') as any;
        // console.log('router', this.fn!.toString());
    }

    public isBuilt() {
        return !!this.fn;
    }

    resolve(httpMethod: string, path: string): ResolvedController | undefined {
        return this.fn(httpMethod.toUpperCase(), path);
    }
}
