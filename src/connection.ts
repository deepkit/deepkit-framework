import * as WebSocket from "ws";
import {Injectable} from "injection-js";
import {Observable, Subscription} from "rxjs";
import {Application, SessionStack} from "./application";
import {
    ClientMessageAll,
    Collection,
    CollectionStream,
    each,
    ServerMessageAll,
    Subscriptions,
    EntitySubject
} from "@kamille/core";
import {classToPlain, getEntityName, RegisteredEntities} from "@marcj/marshal";

function getSafeEntityName(object: any): string | undefined {
    try {
        return getEntityName(object.constructor);
    } catch (e) {
        return undefined;
    }
}

@Injectable()
export class Connection {
    protected collectionSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected observables: { [messageId: string]: { observable: Observable<any>, subscriber: { [subscriberId: string]: Subscription } } } = {};

    constructor(
        protected app: Application,
        protected socket: WebSocket,
        protected sessionStack: SessionStack,
        protected injector: (token: any) => any,
    ) {
    }

    public destroy() {
        for (const sub of each(this.collectionSubscriptions)) {
            sub.unsubscribe();
        }
        for (const ob of each(this.observables)) {
            for (const sub of each(ob.subscriber)) {
                sub.unsubscribe();
            }
        }
    }

    public async onMessage(raw: string) {
        if ('string' === typeof raw) {
            const message = JSON.parse(raw) as ClientMessageAll;

            if (message.name === 'authenticate') {
                this.sessionStack.setSession(await this.app.authenticate(message.token));

                this.write({
                    type: 'authenticate/result',
                    id: message.id,
                    result: this.sessionStack.isSet(),
                });
            }

            if (message.name === 'action') {
                // console.log('Got action', message);
                try {
                    this.send(message, () => this.action(message.controller, message.action, message.args));
                } catch (error) {
                    console.log('Unhandled action error', error);
                }
            }

            if (message.name === 'observable/subscribe') {
                if (!this.observables[message.id]) {
                    throw new Error('No observable registered.');
                }

                if (this.observables[message.id].subscriber[message.subscribeId]) {
                    throw new Error('Subscriber already registered.');
                }

                this.observables[message.id].subscriber[message.subscribeId] = this.observables[message.id].observable.subscribe((next) => {
                    const entityName = getSafeEntityName(next);
                    if (entityName && RegisteredEntities[entityName]) {
                        next = classToPlain(RegisteredEntities[entityName], next);
                    }

                    this.write({
                        type: 'next/observable',
                        id: message.id,
                        subscribeId: message.subscribeId,
                        entityName: entityName,
                        next: next
                    });
                }, (error) => {
                    this.sendError(message.id, error);
                }, () => {
                    this.complete(message.id);
                });
            }

            if (message.name === 'observable/unsubscribe') {
                if (!this.observables[message.id]) {
                    throw new Error('No observable registered.');
                }

                if (!this.observables[message.id].subscriber[message.subscribeId]) {
                    throw new Error('Subscriber already unsubscribed.');
                }

                this.observables[message.id].subscriber[message.subscribeId].unsubscribe();
            }
        }
    }

    public async action(controller: string, action: string, args: any[]): Promise<any> {
        const controllerClass = await this.app.getController(controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${controller}`);
        }

        const access = await this.app.hasAccess(this.sessionStack.getSession(), controllerClass, action);
        if (!access) {
            throw new Error(`Access denied.`);
        }

        const controllerIntance = this.injector(controllerClass);

        const methodName = action;

        if ((controllerIntance as any)[methodName]) {
            const actions = Reflect.getMetadata('kamille:actions', controllerClass.prototype) || {};

            if (!actions[methodName]) {
                console.log('Action unknown, but method exists.', methodName);
                throw new Error(`Action unknown ${methodName}`);
            }

            try {
                //todo, convert args via plainToClass

                const result = (controllerIntance as any)[methodName](...args);
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

    public async send(message: ClientMessageAll, exec: (() => Promise<any> | Observable<any>)) {
        try {
            let result = exec();

            if (typeof (result as any)['then'] === 'function') {
                // console.log('its an Promise');
                result = await result;
            }

            if (result instanceof EntitySubject) {
                const item = result.getValue();
                const entityName = getEntityName(item.constructor);

                this.write({
                    type: 'type',
                    id: message.id,
                    returnType: 'entity',
                    entityName: entityName,
                    item: classToPlain(item.constructor, item)
                });

            } else if (result instanceof Collection) {
                const collection: Collection<any> = result;

                this.write({type: 'type', id: message.id, returnType: 'collection', entityName: collection.entityName});
                let nextValue: CollectionStream | undefined;

                if (collection.count() > 0) {
                    nextValue = {
                        type: 'set',
                        total: collection.count(),
                        items: collection.all().map(v => classToPlain(collection.classType, v))
                    };
                    this.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                collection.ready.toPromise().then(() => {
                    nextValue = {type: 'ready'};
                    this.write({type: 'next/collection', id: message.id, next: nextValue});
                });

                if (this.collectionSubscriptions[message.id]) {
                    throw new Error('Collection already subscribed');
                }

                this.collectionSubscriptions[message.id] = new Subscriptions(() => {
                    collection.complete();
                });

                this.collectionSubscriptions[message.id].add = collection.subscribe((next) => {

                }, (error) => {
                    this.sendError(message.id, error);
                    this.collectionSubscriptions[message.id].unsubscribe();
                }, () => {
                    this.complete(message.id);
                    this.collectionSubscriptions[message.id].unsubscribe();
                });

                this.collectionSubscriptions[message.id].add = collection.event.subscribe((event) => {
                    if (event.type === 'add') {
                        nextValue = {type: 'add', item: classToPlain(collection.classType, event.item)};
                        this.write({type: 'next/collection', id: message.id, next: nextValue});
                    }

                    if (event.type === 'remove') {
                        nextValue = {type: 'remove', id: event.id};
                        this.write({type: 'next/collection', id: message.id, next: nextValue});
                    }

                    if (event.type === 'set') {
                        //consider batching the items, so we don't block the connection stack
                        //when we have thousand of items
                        nextValue = {
                            type: 'set',
                            total: event.items.length,
                            items: event.items.map(v => classToPlain(collection.classType, v))
                        };
                        this.write({type: 'next/collection', id: message.id, next: nextValue});
                    }
                });
            } else if (result instanceof Observable) {
                this.write({type: 'type', id: message.id, returnType: 'observable'});
                this.observables[message.id] = {observable: result, subscriber: {}};
            } else {
                let next = result;
                const entityName = getSafeEntityName(next);
                if (entityName && RegisteredEntities[entityName]) {
                    next = classToPlain(RegisteredEntities[entityName], next);
                }
                this.write({type: 'type', id: message.id, returnType: 'json'});
                this.write({type: 'next/json', id: message.id, entityName: entityName, next: next});
                this.complete(message.id);
            }
        } catch (error) {
            console.log('Worker execution error', message, error);
            await this.sendError(message.id, error);
        }
    }

    public write(message: ServerMessageAll) {
        if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    public complete(id: number) {
        this.write({type: 'complete', id: id});
    }

    public sendError(id: number, error: any) {
        this.write({type: 'error', id: id, error: error instanceof Error ? error.message : error});
    }
}
