import * as WebSocket from "ws";
import {Injector} from "injection-js";
import {Observable, Subscription} from "rxjs";
import * as util from "util";
import {Application, Session} from "./application-server";
import {each} from "@kamille/core";

interface MessageResult {
    type: 'answer';
    id: number;
    next?: any;
    result?: any;
    error?: any;
}

interface Message {
    id: number;
    name: string;
    payload: any;
}

export class Connection {
    protected subscriptions: {[messageId: string]: Subscription} = {};
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

    public async action(data: {path: string, action: string, args: any[]}): Promise<any> {
        const controllerClass = await this.app.getControllerForPath(data.path);
        if (!controllerClass) {
            throw new Error(`Controller not found for ${data.path}`);
        }

        const access = await this.app.hasAccess(this.session, controllerClass, data.action);
        if (!access) {
            throw new Error(`Access denied.`);
        }

        const controller = this.injector.get(controllerClass);

        const methodName = data.action;

        if ((controller as any)[methodName]) {
            const actions = Reflect.getMetadata('kamille:actions', controllerClass) || {};

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
            const result = exec();
            if (typeof (result as any)['then'] === 'function') {
                // console.log('its an Promise');
                await this.sendMessage(message.id, await result);
            } else if (result instanceof Observable) {
                // console.log('its an observable');
                // console.log('new subscription', externalId);
                this.subscriptions[message.id] = result.subscribe((next) => {
                    this.write(JSON.stringify({type: 'answer', id: message.id, next: next} as MessageResult));
                }, (error) => {
                    console.log('error in Observable subscribe', error.stack);
                    // console.log(error.stack);
                    // console.log(error.originalStack);

                    this.write(JSON.stringify({
                        type: 'answer',
                        id: message.id,
                        error: error.toString()
                    } as MessageResult));

                    delete this.subscriptions[message.id];
                }, () => {
                    this.write(JSON.stringify({
                        type: 'answer',
                        id: message.id,
                        complete: true
                    } as MessageResult));
                    delete this.subscriptions[message.id];
                });
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

    public write(message: string) {
        if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(message);
        }
    }

    public async sendMessage(id: number, result: any) {
        this.write(JSON.stringify({type: 'answer', id: id, result: result} as MessageResult));
    }

    public async sendError(id: number, error: any) {
        this.write(JSON.stringify({type: 'answer', id: id, error: error} as MessageResult));
    }
}
