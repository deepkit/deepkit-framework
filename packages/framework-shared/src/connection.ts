import {Collection, JSONObjectCollection} from './collection';
import {ClientMessageAll, CollectionStream, ServerMessageAll} from './contract';
import {EntitySubject, getSerializedErrorPair, StreamBehaviorSubject} from './core';
import {Subscriptions} from '@deepkit/core-rxjs';
import {Observable, Subscription} from 'rxjs';
import {ClassType, each, getObjectKeysSize, isFunction, sleep} from '@deepkit/core';
import {getEntityName, jsonSerializer, PropertySchema, PropertySchemaSerialized, Types} from '@deepkit/type';
import {skip} from 'rxjs/operators';

export interface ConnectionWriterStream {
    send(json: string): Promise<boolean>;

    bufferedAmount(): number;
}

export class AlreadyEncoded {
    constructor(
        public type: Types,
        public value: any,
    ) {
    }
}

function encodeValue(v: any, p: PropertySchema | undefined, prefixMessage: string): { encoding: PropertySchemaSerialized, value: any } {
    if (v instanceof AlreadyEncoded) {
        p = new PropertySchema('result');
        p.type = v.type;
        return {
            encoding: p.toJSON(),
            value: v.value,
        };
    }

    if (!p) {
        p = new PropertySchema('result');

        if (v !== undefined && v !== null) {
            p.setFromJSValue(v);
        }
    }

    try {
        return {
            encoding: p.toJSON(),
            value: jsonSerializer.serializeProperty(p, v),
        };
    } catch (error) {
        console.log('could not parse value', v, p);
        throw error;
    }
}

export interface ConnectionWriterInterface {
    write(message: ServerMessageAll): void;

    cancelMessage(id: number): void;

    complete(id: number): void;

    ack(id: number): void;

    sendError(id: number, errorObject: any, code?: string): void;
}

export function isObservable(obj: any): obj is Observable<any> {
    return obj && isFunction(obj.pipe) && isFunction(obj.subscribe) && isFunction(obj.toPromise);
}

export class SimpleConnectionWriter implements ConnectionWriterInterface {
    public write(message: ServerMessageAll) {
        throw new Error('Not implemented');
    }

    cancelMessage(messageId: number) {

    }

    public complete(id: number) {
        if (!id) throw new Error('id required');
        this.write({type: 'complete', id: id});
    }

    public ack(id: number) {
        if (!id) throw new Error('id required');
        this.write({type: 'ack', id: id});
    }

    public sendError(id: number, errorObject: any, code?: string) {
        const [entityName, error, stack] = getSerializedErrorPair(errorObject);

        this.write({type: 'error', id: id, entityName, error, stack, code: error.code || code});
    }
}

export class ConnectionWriter extends SimpleConnectionWriter {
    protected chunkIds = 0;
    protected cancelSending: { [messageId: number]: () => void } = {};

    constructor(
        protected socket: ConnectionWriterStream,
    ) {
        super();
    }

    /**
     * This function handles backpressure and waits if necessary
     */
    public async delayedWrite(data: string): Promise<void> {
        while (this.socket.bufferedAmount() > 1024 * 300) {
            await sleep(0.01);
        }

        let sent = await this.socket.send(data);
        let tries = 1;

        while (!sent) {
            console.log('sending failed, wait', data.substr(0, 20));
            await sleep(0.1);
            sent = await this.socket.send(data);
            tries++;
            if (tries > 10) {
                console.log('sending errored after', tries, 'tries', data.substr(0, 20));
                return;
            }
        }

        if (tries > 1) {
            console.log('sending succeeded after', tries, 'tries', data.substr(0, 20));
        }
    }

    /**
     * Queued writes will be canceled.
     * @param messageId
     */
    public cancelMessage(messageId: number) {
        if (this.cancelSending[messageId]) {
            this.cancelSending[messageId]();
        }
    }

    // @stack()
    public async write(message: ServerMessageAll) {
        const json = JSON.stringify(message);

        const chunkSize = 1024 * 100;

        if (json.length > chunkSize) {
            const chunkId = this.chunkIds++;
            let sending = true;
            let id = 0;
            if (message.type === 'channel' || message.type === 'entity/patch' || message.type === 'entity/remove'
                || message.type === 'entity/removeMany' || message.type === 'entity/update' || message.type === 'push-message') {
            } else {
                id = message.id;
            }
            if (id) {
                this.cancelSending[id] = () => {
                    sending = false;
                };
            }

            let position = 0;
            await this.delayedWrite('@batch-start:' + ((message as any)['id'] || 0) + ':' + chunkId + ':' + json.length);
            while (sending && position * chunkSize < json.length) {
                const chunk = json.substr(position * (chunkSize), chunkSize);
                position++;
                //maybe we should add here additional delay after x MB, so other connection/messages get their time as well.
                // console.log('sent chunk', chunkId, position, chunk.substr(0, 20));
                await this.delayedWrite('@batch:' + chunkId + ':' + chunk);
            }
            if (sending) {
                // console.log('chunk done', chunkId, position);
                await this.delayedWrite('@batch-end:' + chunkId);
            }
            if (id) {
                delete this.cancelSending[id];
            }
        } else {
            await this.delayedWrite(json);
        }
    }

    public complete(id: number) {
        if (!id) throw new Error('id required');
        this.write({type: 'complete', id: id});
    }

    public ack(id: number) {
        if (!id) throw new Error('id required');
        this.write({type: 'ack', id: id});
    }

    public sendError(id: number, errorObject: any, code?: string) {
        const [entityName, error, stack] = getSerializedErrorPair(errorObject);

        this.write({type: 'error', id: id, entityName, error, stack, code: error.code || code});
    }
}


export class ConnectionMiddleware {
    protected collectionSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected collections: { [messageId: string]: Collection<any> } = {};
    protected subjectSubscriptions: { [messageId: string]: Subscriptions } = {};
    protected observables: { [messageId: string]: { p?: PropertySchema, prefix: string, observable: Observable<any>, subscriber: { [subscriberId: string]: Subscription } } } = {};
    protected entitySent: { [messageId: string]: { classType: ClassType, id: string } } = {};

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
    }

    public async messageIn(
        message: ClientMessageAll,
        writer: ConnectionWriterInterface
    ) {
        // console.log('messageIn', message);

        if (message.name === 'entity/unsubscribe') {
            const sent = this.entitySent[message.forId];
            if (!sent) {
                throw new Error(`Entity not sent for message ${message.id}`);
            }

            writer.ack(message.id);
            return;
        }

        if (message.name === 'subject/unsubscribe') {
            const sent = this.subjectSubscriptions[message.forId];
            if (!sent) {
                throw new Error(`Subject not subscribed ${message.forId}`);
            }

            await sent.unsubscribe();
            writer.ack(message.id);
            return;
        }

        if (message.name === 'collection/unsubscribe') {
            if (this.collectionSubscriptions[message.forId]) {
                this.collectionSubscriptions[message.forId].unsubscribe();
            }
            writer.ack(message.id);
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
            writer.ack(message.id);
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
                const {encoding, value} = encodeValue(next, this.observables[message.forId].p, `${this.observables[message.forId].prefix} observable next`);
                writer.write({
                    type: 'next/observable',
                    id: message.forId,
                    subscribeId: message.subscribeId,
                    encoding: encoding,
                    next: value
                });
            }, (errorObject) => {
                const [entityName, error, stack] = getSerializedErrorPair(errorObject);

                writer.write({
                    type: 'error/observable',
                    id: message.forId,
                    entityName, error, stack,
                    subscribeId: message.subscribeId
                });
            }, () => {
                writer.write({
                    type: 'complete/observable',
                    id: message.forId,
                    subscribeId: message.subscribeId
                });
            });
            writer.ack(message.forId);
        }

        if (message.name === 'observable/unsubscribe') {
            if (!this.observables[message.forId]) {
                throw new Error('No observable registered.');
            }

            if (!this.observables[message.forId].subscriber[message.subscribeId]) {
                throw new Error('Subscriber already unsubscribed.');
            }

            this.observables[message.forId].subscriber[message.subscribeId].unsubscribe();
            delete this.observables[message.forId].subscriber[message.subscribeId];
            if (getObjectKeysSize(this.observables[message.forId].subscriber) === 0) {
                delete this.observables[message.forId];
            }
            writer.ack(message.forId);
        }
    }

    public async actionMessageOut(
        message: ClientMessageAll,
        result: any,
        propertySchema: PropertySchema, //of the method return type
        controllerName: string,
        actionName: string,
        writer: ConnectionWriterInterface
    ) {
        // console.log('messageOut', {
        //     EntitySubject: result instanceof EntitySubject,
        //     StreamBehaviorSubject: result instanceof StreamBehaviorSubject,
        //     Collection: result instanceof Collection,
        //     Observable: result instanceof Observable,
        //     className: getClassName(result),
        // }, result);

        if (result instanceof Promise) {
            throw new Error('Promise not supported as actionMessageOut');
        }

        const prefix = `${controllerName}::${actionName}`;

        if (result instanceof EntitySubject) {
            const item = result.getValue();

            if (undefined === item) {
                writer.write({
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

            writer.write({
                type: 'type',
                id: message.id,
                returnType: 'entity',
                entityName: entityName,
                item: entityName ? jsonSerializer.for(item.constructor).serialize(item) : item
            });
            writer.complete(message.id);
            //no further subscribes/messages necessary since the 'entity' channel handles updating.
            //this means, once this entity is registered in entity-storage, we automatically push changes of this entity.

        } else if (result instanceof StreamBehaviorSubject) {
            const item = result.getValue();

            const {encoding, value} = encodeValue(item, propertySchema.getTemplateArg(0), `${prefix} subject initial`);

            writer.write({
                type: 'type',
                id: message.id,
                returnType: 'subject',
                encoding: encoding,
                data: value,
            });

            this.subjectSubscriptions[message.id] = new Subscriptions(async () => {
                writer.cancelMessage(message.id);
                await result.unsubscribe();
                delete this.subjectSubscriptions[message.id];
            });

            this.subjectSubscriptions[message.id].add = result.appendSubject.subscribe((append: any) => {
                const {encoding, value} = encodeValue(append, propertySchema.getTemplateArg(0), `${prefix} subject append`);

                writer.write({
                    type: 'append/subject',
                    id: message.id,
                    encoding: encoding,
                    append: value
                });
            });

            //we sent already the first initial value, since its a BehaviorSubject we skip the first
            this.subjectSubscriptions[message.id].add = result.pipe(skip(1)).subscribe((next) => {
                const {encoding, value} = encodeValue(next, propertySchema.getTemplateArg(0), `${prefix} subject next`);
                writer.write({
                    type: 'next/subject',
                    id: message.id,
                    encoding: encoding,
                    next: value,
                });
            }, async (error) => {
                writer.sendError(message.id, error);
                await this.subjectSubscriptions[message.id].unsubscribe();
            }, async () => {
                writer.complete(message.id);
                await this.subjectSubscriptions[message.id].unsubscribe();
            });

        } else if (result instanceof Collection) {
            const collection: Collection<any> = result;

            writer.write({
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
            const serializer = jsonSerializer.for(collection.classType);

            const items = collection instanceof JSONObjectCollection
                ? collection.all()
                : collection.all().map(v => serializer.serialize(v));

            nextValue = {
                type: 'set',
                total: collection.count(),
                items: items
            };
            writer.write({type: 'next/collection', id: message.id, next: nextValue});

            if (this.collectionSubscriptions[message.id]) {
                throw new Error('Collection already subscribed');
            }

            this.collectionSubscriptions[message.id] = new Subscriptions(() => {
                writer.cancelMessage(message.id);
                collection.unsubscribe();
                delete this.collections[message.id];
                delete this.collectionSubscriptions[message.id];
            });

            this.collections[message.id] = collection;

            this.collectionSubscriptions[message.id].add = collection.subscribe(() => {

            }, (error) => {
                writer.sendError(message.id, error);
            }, () => {
                writer.complete(message.id);
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
                writer.write({type: 'next/collection', id: message.id, next: nextValue});
            };

            this.collectionSubscriptions[message.id].add = collection.pagination.event.subscribe((event) => {
                if (event.type.startsWith('server:')) {
                    writer.write({type: 'next/collection', id: message.id, next: {type: 'pagination', event: event}});
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
                        : jsonSerializer.for(collection.classType).serialize(event.item);

                    nextValue = {type: 'add', item: item};
                    writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'removeMany') {
                    nextValue = {type: 'removeMany', ids: event.ids};
                    writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'remove') {
                    nextValue = {type: 'remove', id: event.id};
                    writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'batch/start' || event.type === 'batch/end') {
                    writer.write({type: 'next/collection', id: message.id, next: event});
                }

                if (event.type === 'sort') {
                    nextValue = {type: 'sort', ids: event.ids};
                    writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }

                if (event.type === 'set') {
                    //consider batching the items, so we don't block the connection stack
                    //when we have thousand of items and we get a nice loading bar.
                    const serializer = jsonSerializer.for(collection.classType);

                    const items = collection instanceof JSONObjectCollection
                        ? event.items
                        : event.items.map(v => serializer.serialize(v));

                    nextValue = {
                        type: 'set',
                        total: event.items.length,
                        items: items
                    };
                    writer.write({type: 'next/collection', id: message.id, next: nextValue});
                }
            });
        } else if (isObservable(result)) {
            writer.write({type: 'type', id: message.id, returnType: 'observable'});
            this.observables[message.id] = {observable: result, subscriber: {}, p: propertySchema.getTemplateArg(0), prefix: prefix};
        } else {
            const v = encodeValue(result, propertySchema, `${prefix} result`);
            writer.write({type: 'next/json', id: message.id, encoding: v.encoding, next: v.value});
        }
    }
}
