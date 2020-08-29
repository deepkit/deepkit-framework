import {HttpNotFoundError, injectable, Injector} from '@super-hornet/framework-server-common';
import {argumentPlainToClass, getClassSchema, validateMethodArgs} from '@super-hornet/marshal';
import {Router} from './router';


@injectable()
export class HttpHandler {
    constructor(protected router: Router) {
    }

    async handleRequest(injector: Injector, method: string, path: string, queryString: string = ''): Promise<any> {
        // //- resolve controller
        const resolved = this.router.resolve(method || 'GET', path || '/');
        if (!resolved) throw new HttpNotFoundError();

        //- call PRE_REQUEST listener
        //- resolve function arguments and validate
        const args = resolved.parameters;
        const schema = getClassSchema(resolved.controller);
        const properties = schema.getMethodProperties(resolved.method);

        const errors = validateMethodArgs(resolved.controller, resolved.method, args);
        if (errors.length) {
            //throw errors
        }

        for (let i = 0; i < args.length; i++) {
            args[i] = argumentPlainToClass(resolved.controller, resolved.method, i, args[i]);
        }

        for (let i = args.length; i < properties.length; i++) {
            const property = properties[i];
            if (property.type === 'class') {
                args[i] = injector.get(property.classType);
            } else {
                throw new Error(`Could not resolve controller action argument #${i}, with type ${property.type}`);
            }
        }

        //- call controller
        const controllerInstance = injector.get(resolved.controller);
        const response = await controllerInstance[resolved.method](...args);
        //- parse response/view

        //- call POST_REQUEST listener


        return response;
    }
}