import {Injectable, Injector} from "injection-js";
import {Observable} from "rxjs";
import {Application, SessionStack} from "./application";
import {ClientMessageAll, Collection, EntitySubject, ServerMessageActionType} from "@marcj/glut-core";
import {ConnectionMiddleware} from "./connection-middleware";
import {ConnectionWriter} from "./connection-writer";
import {arrayRemoveItem, each, eachKey, isArray, isObject, isPlainObject, getClassName} from "@marcj/estdlib";
import {getActionParameters, getActionReturnType, getActions} from "./decorators";
import {plainToClass, RegisteredEntities, validate, classToPlain, partialPlainToClass, partialClassToPlain} from "@marcj/marshal";
import {map} from "rxjs/operators";

type ActionTypes = { parameters: ServerMessageActionType[], returnType: ServerMessageActionType };

@Injectable()
export class ClientConnection {
    protected timeoutTimers: any[] = [];
    protected destroyed = false;
    protected usedControllers: { [path: string]: any } = {};

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    constructor(
        protected app: Application,
        protected sessionStack: SessionStack,
        protected injector: Injector,
        protected connectionMiddleware: ConnectionMiddleware,
        protected writer: ConnectionWriter,
    ) {
    }

    public destroy() {
        this.connectionMiddleware.destroy();
        this.destroyed = true;

        for (const timeout of this.timeoutTimers) {
            clearTimeout(timeout);
        }

        for (const usedController of each(this.usedControllers)) {
            if (usedController.destroy) {
                usedController.destroy();
            }
        }
    }

    public isActive(): boolean {
        return !this.destroyed;
    }

    /**
     * Creates a regular timer using setTimeout() and automatically cancel it once the connection breaks or server stops.
     */
    public setTimeout(cb: () => void, timeout: number): any {
        const timer = setTimeout(() => {
            cb();
            arrayRemoveItem(this.timeoutTimers, timer);
        }, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    public async onMessage(raw: string) {
        if ('string' === typeof raw) {
            const message = JSON.parse(raw) as ClientMessageAll;

            if (message.name === 'action') {
                this.actionSend(message, () => this.action(message.controller, message.action, message.args));
                return;
            }

            if (message.name === 'actionTypes') {
                try {
                    const {parameters, returnType} = await this.getActionTypes(message.controller, message.action);

                    this.writer.write({
                        type: 'actionTypes/result',
                        id: message.id,
                        returnType: returnType,
                        parameters: parameters,
                    });
                } catch (error) {
                    this.writer.sendError(message.id, error);
                }
                return;
            }

            if (message.name === 'authenticate') {
                this.sessionStack.setSession(await this.app.authenticate(this.injector, message.token));

                this.writer.write({
                    type: 'authenticate/result',
                    id: message.id,
                    result: this.sessionStack.isSet(),
                });
                return;
            }

            await this.connectionMiddleware.messageIn(message);
        }
    }

    public async getActionTypes(controller: string, action: string)
        : Promise<ActionTypes> {

        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }

        if (!this.cachedActionsTypes[controller][action]) {

            const controllerClass = await this.app.resolveController(controller);

            if (!controllerClass) {
                throw new Error(`Controller not found for ${controller}`);
            }
0
            const access = await this.app.hasAccess(this.injector, this.sessionStack.getSessionOrUndefined(), controllerClass, action);
            if (!access) {
                throw new Error(`Access denied`);
            }

            const actions = getActions(controllerClass);

            if (!actions[action]) {
                console.log('Action unknown, but method exists.', action);
                throw new Error(`Action unknown ${action}`);
            }

            this.cachedActionsTypes[controller][action] = {
                parameters: getActionParameters(controllerClass, action),
                returnType: getActionReturnType(controllerClass, action)
            };
        }

        return this.cachedActionsTypes[controller][action];
    }

    public async action(controller: string, action: string, args: any[]): Promise<any> {
        const controllerClass = await this.app.resolveController(controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${controller}`);
        }

        const access = await this.app.hasAccess(this.injector, this.sessionStack.getSessionOrUndefined(), controllerClass, action);
        if (!access) {
            throw new Error(`Access denied`);
        }

        const controllerInstance = this.injector.get(controllerClass);

        this.usedControllers[controller] = controllerInstance;

        const methodName = action;
        const fullName = `${controller}::${action}`;

        if ((controllerInstance as any)[methodName]) {
            const actions = getActions(controllerClass);

            if (!actions[methodName]) {
                console.log('Action unknown, but method exists.', fullName);
                throw new Error(`Action unknown ${fullName}`);
            }

            const types = await this.getActionTypes(controller, action);

            for (const i of eachKey(args)) {
                const type = types.parameters[i];
                if (type.type === 'Entity' && type.entityName) {
                    if (!RegisteredEntities[type.entityName]) {
                        throw new Error(`Action's parameter ${controller}::${methodName}:${i} has invalid entity referenced ${type.entityName}.`);
                    }

                    //todo, validate also partial objects, but @marcj/marshal needs an adjustments for the `validation` method to avoid Required() validator
                    // otherwise it fails always.
                    if (!type.partial) {
                        const errors = await validate(RegisteredEntities[type.entityName], args[i]);
                        if (errors.length) {
                            //todo, wrap in own ValidationError so we can serialise it better when send to the client
                            throw new Error(`${fullName} validation failed: ` + JSON.stringify(errors));
                        }
                    }
                    if (type.partial) {
                        args[i] = partialPlainToClass(RegisteredEntities[type.entityName], args[i]);
                    } else {
                        args[i] = plainToClass(RegisteredEntities[type.entityName], args[i]);
                    }
                }
            }

            try {
                let result = (controllerInstance as any)[methodName](...args);

                if (typeof (result as any)['then'] === 'function') {
                    // console.log('its an Promise');
                    result = await result;
                }

                if (result instanceof EntitySubject) {
                    return result;
                }

                if (result instanceof Collection) {
                    return result;
                }

                const converter: {[name: string]: (v: any) => any} = {
                    'Entity': (v: any) => {
                        if (types.returnType.partial) {
                            return partialClassToPlain(RegisteredEntities[types.returnType.entityName!], v);
                        } else {
                            return classToPlain(RegisteredEntities[types.returnType.entityName!], v);
                        }
                    },
                    'Boolean': (v: any) => {
                        return Boolean(v);
                    },
                    'Number': (v: any) => {
                        return Number(v);
                    },
                    'Date': (v: any) => {
                        return v;
                    },
                    'String': (v: any) => {
                        return String(v);
                    },
                    'Object': (v: any) => {
                        return v;
                    }
                };

                function checkForNonObjects(v: any, prefix: string = 'Result') {
                    if (isArray(v) && v[0]) {
                        v = v[0];
                    }

                    if (isObject(v) && !isPlainObject(v)) {
                        throw new Error(`${prefix} returns an not annotated custom class instance (${getClassName(v)}) that can not be serialized.\n` +
                            `Use e.g. @ReturnType(MyClass) at your action.`);
                    } else if (isObject(v)) {
                        throw new Error(`${prefix} returns an not annotated object literal that can not be serialized.\n` +
                            `Use either @ReturnPlainObject() to avoid serialisation, or (better) create an entity and use @ReturnType(MyEntity) at your action.`);
                    }
                }

                if (result instanceof Observable) {
                    return result.pipe(map((v) => {
                        if (types.returnType.type === 'undefined') {
                            checkForNonObjects(v, `Action ${fullName} failed: Observable`);

                            return v;
                        }

                        if (isArray(v)) {
                            return v.map((j: any) => converter[types.returnType.type](j));
                        }

                        return converter[types.returnType.type](v);
                    }));
                }

                if (types.returnType.type === 'undefined') {
                    checkForNonObjects(result);

                    return result;
                }

                if (types.returnType.type === 'Object') {
                    checkForNonObjects(result);

                    return result;
                }

                if (isArray(result)) {
                    return result.map((v: any) => converter[types.returnType.type](v));
                }

                return converter[types.returnType.type](result);
            } catch (error) {
                // possible security whole, when we send all errors.
                console.error(error);
                throw new Error(`Action ${fullName} failed: ${error}`);
            }
        }

        throw new Error(`Action unknown ${fullName}`);
    }

    public async actionSend(message: ClientMessageAll, exec: (() => Promise<any> | Observable<any>)) {
        try {
            await this.connectionMiddleware.actionMessageOut(message, await exec());
        } catch (error) {
            await this.writer.sendError(message.id, error);
        }
    }
}
