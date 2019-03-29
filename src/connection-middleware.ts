import {EntityStorage} from "./entity-storage";
import {ClientMessageAll, Collection, CollectionStream, EntitySubject, StreamBehaviorSubject} from "@marcj/glut-core";
import {classToPlain, getEntityName} from "@marcj/marshal";
import {ClassType, each, getClassName, isObject, isPlainObject} from "@marcj/estdlib";
import {Subscriptions} from "@marcj/estdlib-rxjs";
import {Observable, Subscription} from "rxjs";
import {Injectable} from "injection-js";
import {ConnectionWriter} from "./connection-writer";


function getSafeEntityName(object: any): string | undefined {
    try {
        return getEntityName(object.constructor);
    } catch (e) {
        return undefined;
    }
}

@Injectable()
export class ConnectionMiddleware {
    protected collectionSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected subjectSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected observables: { [messageId: string]: { observable: Observable<any>, subscriber: { [subscriberId: string]: Subscription } } } = {};
    protected entitySent: { [messageId: string]: { classType: ClassType<any>, id: string } } = {};

    constructor(
        protected writer: ConnectionWriter,
        protected entityStorage: EntityStorage,
    ) {
    }

    public destroy() {
        for (const sub of each(this.collectionSubscriptions)) {
            sub.unsubscribe();
        }

        for (const sub of each(this.subjectSubscriptions)) {
            sub.unsubscribe();
        }

        for (const ob of each(this.observables)) {
            for (const sub of each(ob.subscriber)) {
                sub.unsubscribe();
            }
        }

        this.entityStorage.destroy();
    }

    public async messageIn(message: ClientMessageAll) {
        // console.log('messageIn', message);

        if (message.name === 'entity/unsubscribe') {
            const sent = this.entitySent[message.forId];
            if (!sent) {
                throw new Error(`Entity not sent for message ${message.id}`);
            }

            this.entityStorage.decreaseUsage(sent.classType, sent.id);
            this.writer.ack(message.id);
            return;
        }

        if (message.name === 'subject/unsubscribe') {
            const sent = this.subjectSubscriptions[message.id];
            if (!sent) {
                throw new Error(`Subject not subscribed ${message.id}`);
            }

            sent.unsubscribe();
        }

        if (message.name === 'collection/unsubscribe') {
            if (this.collectionSubscriptions[message.forId]) {
                this.collectionSubscriptions[message.forId].unsubscribe();
            }
            this.writer.ack(message.id);
            return;
        }

        if (message.name === 'observable/subscribe') {
            if (!this.observables[message.id]) {
                throw new Error('No observable registered.');
            }

            if (this.observables[message.id].subscriber[message.subscribeId]) {
                throw new Error('Subscriber already registered.');
            }

            this.observables[message.id].subscriber[message.subscribeId] = this.observables[message.id].observable.subscribe((next) => {
                //todo, redo with types.returnType
                // const entityName = getSafeEntityName(next);
                // if (entityName && RegisteredEntities[entityName]) {
                //     next = classToPlain(RegisteredEntities[entityName], next);
                // }

                if (isObject(next) && !isPlainObject(next)) {
                    console.warn(`Warning: you are sending an object (${getClassName(next)}) without serialising it using @Entity.`);
                }

                this.writer.write({
                    type: 'next/observable',
                    id: message.id,
                    subscribeId: message.subscribeId,
                    next: next
                });
            }, (error) => {
                this.writer.write({
                    type: 'error/observable',
                    id: message.id,
                    error: error.message || error,
                    subscribeId: message.subscribeId
                });
            }, () => {
                this.writer.write({
                    type: 'complete/observable',
                    id: message.id,
                    subscribeId: message.subscribeId
                });
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

    public async actionMessageOut(message: ClientMessageAll, result: any) {
        // console.log('messageOut', {
        //     EntitySubject: result instanceof EntitySubject,
        //     StreamBehaviorSubject: result instanceof StreamBehaviorSubject,
        //     Collection: result instanceof Collection,
        //     Observable: result instanceof Observable,
        // }, result);

        if (result instanceof EntitySubject) {
            const item = result.getValue();

            if (undefined === item) {
                this.writer.write({
                    type: 'type',
                    id: message.id,
                    returnType: 'entity',
                    entityName: undefined,
                    item: undefined,
                });
                return;
            }

            const entityName = getEntityName(item.constructor);

            this.entitySent[message.id] = {
                classType: item.constructor,
                id: item.id,
            };

            this.writer.write({
                type: 'type',
                id: message.id,
                returnType: 'entity',
                entityName: entityName,
                item: entityName ? classToPlain(item.constructor, item) : item
            });
            this.writer.complete(message.id);
            //no further subscribes/messages necessary since the 'entity' channel handles updates of it.
            //this means, once this entity is registered in entity-storage, we automatically push changed of this entity.

        } else if (result instanceof StreamBehaviorSubject) {
            const item = result.getValue();

            const entityName = item ? getSafeEntityName(item.constructor) : undefined;

            this.writer.write({
                type: 'type',
                id: message.id,
                returnType: 'subject',
                entityName: entityName,
                data: entityName ? classToPlain(item.constructor, item) : item
            });

            this.subjectSubscriptions[message.id] = new Subscriptions(() => {
                result.unsubscribe();
                delete this.subjectSubscriptions[message.id];
            });

            this.subjectSubscriptions[message.id].add = result.appendSubject.subscribe((append: any) => {
                this.writer.write({
                    type: 'append/subject',
                    id: message.id,
                    append: append
                });
            });

            this.subjectSubscriptions[message.id].add = result.subscribe((next) => {
                const entityName = next ? getSafeEntityName(next.constructor) : undefined;

                this.writer.write({
                    type: 'next/subject',
                    id: message.id,
                    next: entityName ? classToPlain(item.constructor, item) : item
                });
            }, (error) => {
                this.writer.sendError(message.id, error);
                this.subjectSubscriptions[message.id].unsubscribe();
            }, () => {
                this.writer.complete(message.id);
                this.subjectSubscriptions[message.id].unsubscribe();
            });

        } else if (result instanceof Collection) {
            const collection: Collection<any> = result;

            this.writer.write({
                type: 'type',
                id: message.id,
                returnType: 'collection',
                entityName: getEntityName(collection.classType)
            });
            let nextValue: CollectionStream | undefined;

            nextValue = {
                type: 'set',
                total: collection.count(),
                items: collection.all().map(v => classToPlain(collection.classType, v))
            };
            this.writer.write({type: 'next/collection', id: message.id, next: nextValue});

            if (this.collectionSubscriptions[message.id]) {
                throw new Error('Collection already subscribed');
            }

            this.collectionSubscriptions[message.id] = new Subscriptions(() => {
                collection.unsubscribe();
                delete this.collectionSubscriptions[message.id];
            });

            this.collectionSubscriptions[message.id].add = collection.subscribe(() => {

            }, (error) => {
                this.writer.sendError(message.id, error);
            }, () => {
                this.writer.complete(message.id);
            });

            this.collectionSubscriptions[message.id].add = collection.event.subscribe((event) => {
                if (event.type === 'add') {
                    nextValue = {type: 'add', item: classToPlain(collection.classType, event.item)};
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'removeMany') {
                    nextValue = {type: 'removeMany', ids: event.ids};
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'remove') {
                    nextValue = {type: 'remove', id: event.id};
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'set') {
                    //consider batching the items, so we don't block the connection stack
                    //when we have thousand of items
                    nextValue = {
                        type: 'set',
                        total: event.items.length,
                        items: event.items.map(v => classToPlain(collection.classType, v))
                    };
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }
            });
        } else if (result instanceof Observable) {
            this.writer.write({type: 'type', id: message.id, returnType: 'observable'});
            this.observables[message.id] = {observable: result, subscriber: {}};
        } else {
            this.writer.write({type: 'type', id: message.id, returnType: 'json'});
            this.writer.write({type: 'next/json', id: message.id, next: result});
            this.writer.complete(message.id);
        }
    }
}
