import * as WebSocket from "ws";
import {Injector} from "injection-js";
import {Observable, Subscription} from "rxjs";
import * as util from "util";
import {Application, Session} from "./application";
import {Collection, each, MessageResult} from "@kamille/core";
import {classToPlain, getEntityName, RegisteredEntities} from "@marcj/marshal";

interface Message {
    id: number;
    name: string;
    payload: any;
}

function getSafeEntityName(object: any): string | undefined {
    try {
        return getEntityName(object.constructor);
    } catch (e) {
        return undefined;
    }
}

export class Connection {
    protected subscriptions: { [messageId: string]: Subscription } = {};
    protected session?: Session;
    protected app: Application;

    constructor(
        protected socket: WebSocket,
        protected injector: Injector,
    ) {
        this.app = this.injector.get(Application);
    }

    public destroy() {
        for (const sub of each(this.subscriptions)) {
            sub.unsubscribe();
        }
    }

    public async onMessage(raw: string) {
        if ('string' === typeof raw) {
            const message = JSON.parse(raw) as Message;

            if ('authenticate' === message['name']) {
                this.send(message, async () => {
                    this.session = await this.app.authenticate(message.payload);
                    if (this.session instanceof Session) {
                        return true;
                    }

                    return false;
                });
            }

            if ('action' === message['name']) {
                // console.log('Got action', message);
                try {
                    this.send(message, () => this.action(message.payload));
                } catch (error) {
                    console.log('Unhandled shit', error);
                }
            }

            if ('unsubscribe' === message['name']) {
                if (this.subscriptions[message.id]) {
                    try {
                        this.subscriptions[message.id].unsubscribe();
                    } catch (error) {
                        console.error('Error in unsubscribing', error);
                    }
                } else {
                    console.log('already unsubscribed from', message.id);
                }
            }
        }
    }

    public async action(data: { controller: string, action: string, args: any[] }): Promise<any> {
        const controllerClass = await this.app.getController(data.controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${data.controller}`);
        }

        const access = await this.app.hasAccess(this.session, controllerClass, data.action);
        if (!access) {
            throw new Error(`Access denied.`);
        }

        const controller = this.injector.get(controllerClass);

        const methodName = data.action;

        if ((controller as any)[methodName]) {
            const actions = Reflect.getMetadata('kamille:actions', controllerClass.prototype) || {};

            if (!actions[methodName]) {
                console.log('Action unknown, but method exists.', methodName);
                throw new Error(`Action unknown ${methodName}`);
            }

            try {
                const result = (controller as any)[methodName](...data['args']);
                return result;
            } catch (error) {
                // possible security whole, when we send all errors.
                console.error(error);
                throw new Error(`Action ${methodName} failed: ${error}`);
            }
        }

        console.error('Action unknown', methodName);
        throw new Error(`Action unknown ${methodName}`);
    }

    public async send(message: Message, exec: (() => Promise<any> | Observable<any>)) {
        if (this.subscriptions[message.id]) {
            throw new Error(`Message id ${message.id} already used.`);
        }

        try {
            let result = exec();
            console.log('result', result);

            if (typeof (result as any)['then'] === 'function') {
                // console.log('its an Promise');
                result = await result;
            }

            if (result instanceof Collection) {
                this.write({type: 'type', id: message.id, returnType: 'collection', entityName: result.entityName});



            } else if (result instanceof Observable) {
                this.write({type: 'type', id: message.id, returnType: 'observable'});

                this.subscriptions[message.id] = result.subscribe((next) => {
                    const entityName = getSafeEntityName(next);
                    if (entityName && RegisteredEntities[entityName]) {
                        next = classToPlain(RegisteredEntities[entityName], next);
                    }

                    this.write({type: 'next', id: message.id, entityName: entityName, next: next});
                }, (error) => {
                    this.write({
                        type: 'error',
                        id: message.id,
                        error: error.toString()
                    });

                    delete this.subscriptions[message.id];
                }, () => {
                    this.write({type: 'complete', id: message.id});
                    delete this.subscriptions[message.id];
                    delete this.subscriptions[message.id];
                });
            } else {
                this.write({type: 'next', id: message.id, next: result});
                this.write({type: 'complete', id: message.id});
            }
        } catch (e) {
            console.log('Worker execution error', message, util.inspect(e));

            if (e instanceof Error) {
                await this.sendError(message.id, e.message);
            } else {
                await this.sendError(message.id, e);
            }
        }
    }

    public write(message: MessageResult) {
        if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    public async sendError(id: number, error: any) {
        this.write({type: 'error', id: id, error: error});
    }
}
