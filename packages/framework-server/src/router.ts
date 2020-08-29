import {ClassType, CompilerContext, toFastProperties} from '@super-hornet/core';
import {httpClass} from '@super-hornet/framework-server-common';
import {join} from 'path';

type ResolvedController = { controller: ClassType, parameters: string[], method: string };

export class Router {
    protected fn?: (httpMethod: string, path: string) => ResolvedController | undefined = undefined;

    static forControllers(controllers: ClassType[]): Router {
        const router = new this;
        router.build(controllers);
        return router;
    }

    protected getControllerCode(compiler: CompilerContext, controller: ClassType): string {
        const data = httpClass._fetch(controller);
        if (!data) return '';
        const staticRules = compiler.context.get('_static') as any;
        const controllerVar = compiler.reserveVariable('controller', controller);

        const code: string[] = [];
        for (const action of data.actions) {
            let path = data.baseUrl ? join(data.baseUrl, action.path) : action.path;
            if (!path.startsWith('/')) path = '/' + path;

            const names: string[] = [];
            const prefix = path.substr(0, path.indexOf(':'));

            path = path.replace(/(:\w+)/, function (a, b, c, name) {
                names.push(name);
                return action.parameterRegularExpressions[name] || String.raw`([^/]+)`;
            });

            const methodNameVar = compiler.reserveVariable('methodName', action.methodName);
            if (names.length === 0) {
                //static rule
                staticRules[action.httpMethod + path] = {controller, method: action.methodName, parameters: []};
                code.push(`
                    //=> ${path}
                    if (_static[_method + _path]) return _static[_method + _path]; 
                `);
            } else {
                const regexVar = compiler.reserveVariable('regex', new RegExp('^' + path + '$'));
                const setParameters: string[] = [];
                for (let i = 0; i < names.length; i++) {
                    setParameters.push(`_match[1 + ${i}]`);
                }
                const actionCode = `
                    //=> ${path}
                    if (_method === '${action.httpMethod}' && _path.startsWith(${JSON.stringify(prefix)}) && (_match = _path.match(${regexVar}))) {
                        return {controller: ${controllerVar}, parameters: [${setParameters.join(',')}], method: ${methodNameVar}};
                    }
                `;

                code.push(actionCode);
            }
        }

        return code.join('\n');
    }

    public build(controllers: ClassType[]): any {
        const compiler = new CompilerContext;
        compiler.context.set('_match', null);
        const staticRules = {};
        compiler.context.set('_static', staticRules);

        const code: string[] = [];

        for (const controller of controllers) {
            code.push(this.getControllerCode(compiler, controller));
        }

        toFastProperties(staticRules);
        this.fn = compiler.build(code.join('\n'), '_method', '_path') as any;
        console.log('router', this.fn!.toString());
    }

    public isBuilt() {
        return !!this.fn;
    }

    resolve(httpMethod: string, path: string): ResolvedController | undefined {
        if (!this.fn) throw new Error(`Router not built yet`);

        return this.fn(httpMethod.toUpperCase(), path);
    }
}
