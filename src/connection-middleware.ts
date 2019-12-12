import {EntityStorage} from "./entity-storage";
import {ClientMessageAll, Collection, CollectionStream, EntitySubject, getSerializedErrorPair, JSONError, JSONObjectCollection, StreamBehaviorSubject} from "@marcj/glut-core";
import {classToPlain, getEntityName} from "@marcj/marshal";
import {ClassType, each, getClassName, isObject, isPlainObject} from "@marcj/estdlib";
import {Subscriptions} from "@marcj/estdlib-rxjs";
import {Observable, Subscription} from "rxjs";
import {Injectable} from "injection-js";
import {ConnectionWriter} from "./connection-writer";
import {skip} from "rxjs/operators";


function getSafeEntityName(object: any): string | undefined {
    try {
        return getEntityName(object.constructor);
    } catch (e) {
        return undefined;
    }
}

function encodeValue(v: any): { encoding: string, value: any } {
    const entityName = isObject(v) ? getSafeEntityName(v) : undefined;
    if (entityName) {
        return {encoding: entityName, value: classToPlain(v.constructor, v)};
    }

    if (v instanceof Buffer) {
        return {encoding: '@base64', value: v.toString('base64')};
    }

    return {encoding: '@plain', value: v};
}

@Injectable()
export class ConnectionMiddleware {
    protected collectionSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected collections: { [messageId: string]: Collection<any> } = {};
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
            const sent = this.subjectSubscriptions[message.forId];
            if (!sent) {
                throw new Error(`Subject not subscribed ${message.forId}`);
            }

            await sent.unsubscribe();
            this.writer.ack(message.id);
            return;
        }

        if (message.name === 'collection/unsubscribe') {
            if (this.collectionSubscriptions[message.forId]) {
                this.collectionSubscriptions[message.forId].unsubscribe();
            }
            this.writer.ack(message.id);
            return;
        }

        if (message.name === 'collection/pagination') {
            if (this.collections[message.forId]) {
                //happens when the client sent pagination changes.
                // console.log('client send pagination updates', message);
                this.collections[message.forId].pagination.setSort(message.sort);
                this.collections[message.forId].pagination.setPage(message.page);
                this.collections[message.forId].pagination.setItemsPerPage(message.itemsPerPage);
                this.collections[message.forId].pagination.setParameters(message.parameters);
                this.collections[message.forId].pagination.event.next({type: 'client:apply'});
            }
            this.writer.ack(message.id);
            return;
        }

        if (message.name === 'observable/subscribe') {
            if (!this.observables[message.forId]) {
                throw new Error('No observable registered.');
            }

            if (this.observables[message.forId].subscriber[message.subscribeId]) {
                throw new Error('Subscriber already registered.');
            }

            this.observables[message.forId].subscriber[message.subscribeId] = this.observables[message.forId].observable.subscribe((next) => {
                const {encoding, value} = encodeValue(next);
                this.writer.write({
                    type: 'next/observable',
                    id: message.forId,
                    subscribeId: message.subscribeId,
                    encoding: encoding,
                    next: value
                });
            }, (errorObject) => {
                const [entityName, error, stack] = getSerializedErrorPair(errorObject);

                this.writer.write({
                    type: 'error/observable',
                    id: message.forId,
                    entityName, error, stack,
                    subscribeId: message.subscribeId
                });
            }, () => {
                this.writer.write({
                    type: 'complete/observable',
                    id: message.forId,
                    subscribeId: message.subscribeId
                });
            });
            this.writer.ack(message.id);
        }

        if (message.name === 'observable/unsubscribe') {
            if (!this.observables[message.forId]) {
                throw new Error('No observable registered.');
            }

            if (!this.observables[message.forId].subscriber[message.subscribeId]) {
                throw new Error('Subscriber already unsubscribed.');
            }

            this.observables[message.forId].subscriber[message.subscribeId].unsubscribe();
            this.writer.ack(message.id);
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
            //no further subscribes/messages necessary since the 'entity' channel handles updating.
            //this means, once this entity is registered in entity-storage, we automatically push changes of this entity.

        } else if (result instanceof StreamBehaviorSubject) {
            const item = result.getValue();

            const {encoding, value} = encodeValue(item);

            this.writer.write({
                type: 'type',
                id: message.id,
                returnType: 'subject',
                encoding: encoding,
                data: value,
            });

            this.subjectSubscriptions[message.id] = new Subscriptions(async () => {
                await result.unsubscribe();
                delete this.subjectSubscriptions[message.id];
            });

            this.subjectSubscriptions[message.id].add = result.appendSubject.subscribe((append: any) => {

                const {encoding, value} = encodeValue(append);

                this.writer.write({
                    type: 'append/subject',
                    id: message.id,
                    encoding: encoding,
                    append: value
                });
            });

            //we sent already the first initial value, since its a BehaviorSubject we skip the first
            this.subjectSubscriptions[message.id].add = result.pipe(skip(1)).subscribe((next) => {
                const {encoding, value} = encodeValue(next);
                this.writer.write({
                    type: 'next/subject',
                    id: message.id,
                    encoding: encoding,
                    next: value,
                });
            }, async (error) => {
                this.writer.sendError(message.id, error);
                await this.subjectSubscriptions[message.id].unsubscribe();
            }, async () => {
                this.writer.complete(message.id);
                await this.subjectSubscriptions[message.id].unsubscribe();
            });

        } else if (result instanceof Collection) {
            const collection: Collection<any> = result;

            this.writer.write({
                type: 'type',
                id: message.id,
                returnType: 'collection',
                pagination: {
                    active: collection.pagination.isActive(),
                    itemsPerPage: collection.pagination.getItemsPerPage(),
                    page: collection.pagination.getPage(),
                    total: collection.pagination.getTotal(),
                    sort: collection.pagination.getSort(),
                    parameters: collection.pagination.getParameters(),
                },
                entityName: getEntityName(collection.classType)
            });
            let nextValue: CollectionStream | undefined;

            const items = collection instanceof JSONObjectCollection
                ? collection.all()
                : collection.all().map(v => classToPlain(collection.classType, v));

            nextValue = {
                type: 'set',
                total: collection.count(),
                items: items
            };
            this.writer.write({type: 'next/collection', id: message.id, next: nextValue});

            if (this.collectionSubscriptions[message.id]) {
                throw new Error('Collection already subscribed');
            }

            this.collectionSubscriptions[message.id] = new Subscriptions(() => {
                collection.unsubscribe();
                delete this.collections[message.id];
                delete this.collectionSubscriptions[message.id];
            });

            this.collections[message.id] = collection;

            this.collectionSubscriptions[message.id].add = collection.subscribe(() => {

            }, (error) => {
                this.writer.sendError(message.id, error);
            }, () => {
                this.writer.complete(message.id);
            });

            const sendPagination = () => {
                nextValue = {
                    type: 'pagination',
                    event: {
                        type: 'server:change',
                        order: collection.pagination.getSort(),
                        itemsPerPage: collection.pagination.getItemsPerPage(),
                        page: collection.pagination.getPage(),
                        total: collection.pagination.getTotal(),
                        parameters: collection.pagination.getParameters(),
                    }
                };
                this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
            };

            this.collectionSubscriptions[message.id].add = collection.pagination.event.subscribe((event) => {

                if (event.type.startsWith('server:')) {
                    this.writer.write({type: 'next/collection', id: message.id, next: {type: 'pagination', event: event}});
                }

                //happens when a query change or external (client) pagination change resulted in some pagination parameter changes (like total)
                //so we send again the current state to the client.
                if (event.type === 'internal_server_change') {
                    sendPagination();
                }

                //happens when the controller which created the collection changed the pagination. we then send the current state to the client.
                if (event.type === 'apply') {
                    sendPagination();
                }

            });

            this.collectionSubscriptions[message.id].add = collection.event.subscribe((event) => {
                if (event.type === 'add') {
                    const item = collection instanceof JSONObjectCollection
                        ? event.item
                        : classToPlain(collection.classType, event.item);

                    nextValue = {type: 'add', item: item};
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

                if (event.type === 'batch/start' || event.type === 'batch/end') {
                    this.writer.write({type: 'next/collection', id: message.id, next: event});
                }

                if (event.type === 'sort') {
                    nextValue = {type: 'sort', ids: event.ids};
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'set') {
                    //consider batching the items, so we don't block the connection stack
                    //when we have thousand of items and we get a nice loading bar.
                    const items = collection instanceof JSONObjectCollection
                        ? event.items
                        : event.items.map(v => classToPlain(collection.classType, v));

                    nextValue = {
                        type: 'set',
                        total: event.items.length,
                        items: items
                    };
                    this.writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }
            });
        } else if (result instanceof Observable) {
            this.writer.write({type: 'type', id: message.id, returnType: 'observable'});
            this.observables[message.id] = {observable: result, subscriber: {}};
        } else {
            const {encoding, value} = encodeValue(result);
            this.writer.write({type: 'next/json', id: message.id, encoding, next: value});
        }
    }
}
