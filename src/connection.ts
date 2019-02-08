import * as WebSocket from "ws";
import {Injectable} from "injection-js";
import {Observable, Subscription} from "rxjs";
import {Application, SessionStack} from "./application";
import {Collection, CollectionStream, each, MessageAll, Subscriptions} from "@kamille/core";
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

@Injectable()
export class Connection {
    protected subscriptions: { [messageId: string]: Subscription | Subscriptions } = {};

    constructor(
        protected app: Application,
        protected socket: WebSocket,
        protected sessionStack: SessionStack,
        protected injector: (token: any) => any,
    ) {
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
                    this.sessionStack.setSession(await this.app.authenticate(message.payload));

                    if (this.sessionStack.isSet()) {
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
                }
            }
        }
    }

    public async action(data: { controller: string, action: string, args: any[] }): Promise<any> {
        const controllerClass = await this.app.getController(data.controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${data.controller}`);
        }

        const access = await this.app.hasAccess(this.sessionStack.getSession(), controllerClass, data.action);
        if (!access) {
            throw new Error(`Access denied.`);
        }

        const controller = this.injector(controllerClass);

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

            if (typeof (result as any)['then'] === 'function') {
                // console.log('its an Promise');
                result = await result;
            }

            if (result instanceof Collection) {
                const collection: Collection<any> = result;

                this.write({type: 'type', id: message.id, returnType: 'collection', entityName: collection.entityName});
                let nextValue: CollectionStream | undefined;

                if (collection.count() > 0) {
                    nextValue = {
                        type: 'set',
                        total: collection.count(),
                        items: collection.all().map(v => classToPlain(collection.classType, v))
                    };
                    this.write({type: 'next', id: message.id, next: nextValue});
                }

                collection.ready.toPromise().then(() => {
                    nextValue = {type: 'ready'};
                    this.write({type: 'next', id: message.id, next: nextValue});
                });

                this.subscriptions[message.id] = new Subscriptions(() => {
                    collection.complete();
                });

                this.subscriptions[message.id].add = collection.subscribe((next) => {

                }, (error) => {
                    this.sendError(message.id, error);
                }, () => {
                    console.log('completed');
                    this.complete(message.id);
                });

                this.subscriptions[message.id].add = collection.event.subscribe((event) => {
                    if (event.type === 'add') {
                        nextValue = {type: 'add', item: classToPlain(collection.classType, event.item)};
                        this.write({type: 'next', id: message.id, next: nextValue});
                    }

                    if (event.type === 'remove') {
                        nextValue = {type: 'remove', id: event.id};
                        this.write({type: 'next', id: message.id, next: nextValue});
                    }

                    if (event.type === 'set') {
                        //consider batching the items, so we don't block the connection stack
                        //when we have thousand of items
                        nextValue = {
                            type: 'set',
                            total: event.items.length,
                            items: event.items.map(v => classToPlain(collection.classType, v))
                        };
                        this.write({type: 'next', id: message.id, next: nextValue});
                    }
                });
            } else if (result instanceof Observable) {
                this.write({type: 'type', id: message.id, returnType: 'observable'});

                this.subscriptions[message.id] = result.subscribe((next) => {
                    const entityName = getSafeEntityName(next);
                    if (entityName && RegisteredEntities[entityName]) {
                        next = classToPlain(RegisteredEntities[entityName], next);
                    }

                    this.write({type: 'next', id: message.id, entityName: entityName, next: next});
                }, (error) => {
                    this.sendError(message.id, error);
                }, () => {
                    this.complete(message.id);
                });
            } else {
                this.write({type: 'type', id: message.id, returnType: 'json'});
                this.write({type: 'next', id: message.id, next: result});
                this.complete(message.id);
            }
        } catch (error) {
            console.log('Worker execution error', message, error);
            await this.sendError(message.id, error);
        }
    }

    public write(message: MessageAll) {
        if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    public complete(id: number) {
        delete this.subscriptions[id];
        this.write({type: 'complete', id: id});
    }

    public sendError(id: number, error: any) {
        delete this.subscriptions[id];
        this.write({type: 'error', id: id, error: error instanceof Error ? error.message : error});
    }
}
