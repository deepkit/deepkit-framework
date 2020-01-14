import {Subject, Subscriber, Observable} from "rxjs";
import {first} from "rxjs/operators";
import {ClientMessageWithoutId, ServerMessageComplete, ServerMessageError, ServerMessageResult} from "./contract";
import {getUnserializedError, StreamBehaviorSubject} from "./core";
import {Collection, CollectionPaginationEvent} from "./collection";
import {PropertySchemaSerialized, propertyPlainToClass, PropertySchema, RegisteredEntities} from "@marcj/marshal";
import {each} from "@marcj/estdlib";
import {EntityState} from "./entity-state";

export class MessageSubject<T> extends Subject<T> {
    public readonly disconnected = new Subject<number>();
    protected sendModifier?: (message: ClientMessageWithoutId) => ClientMessageWithoutId;

    constructor(
        public readonly connectionId: number,
        private onReply?: (message: ClientMessageWithoutId) => MessageSubject<any>,
    ) {
        super();
    }

    public setSendMessageModifier(modifier: (message: ClientMessageWithoutId) => ClientMessageWithoutId) {
        this.sendModifier = modifier;
    }

    /**
     * Sends a message to the server and returns a new MessageSubject.
     * If the connection meanwhile has been reconnected, and completed MessageSubject.
     */
    public sendMessage<T = { type: '' }, K = T | ServerMessageComplete | ServerMessageError>(
        messageWithoutId: ClientMessageWithoutId
    ): MessageSubject<K> {
        if (!this.onReply) {
            throw new Error('No replier set');
        }

        if (this.sendModifier) {
            messageWithoutId = this.sendModifier(messageWithoutId);
        }

        return this.onReply(messageWithoutId);
    }

    error(err: any): void {
        this.disconnected.complete();
        super.error(err);
    }

    complete(): void {
        this.disconnected.complete();
        super.complete();
    }

    async firstOrUndefinedThenClose(): Promise<T | undefined> {
        if (this.closed) {
            return undefined;
        }

        return new Promise<T>((resolve) => {
            this.pipe(first()).subscribe((next) => {
                resolve(next);
            }, (error) => {
                resolve();
            }, () => {
                //complete
            }).add(() => {
                this.complete();
            });
        });
    }

    async firstThenClose(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pipe(first()).subscribe((next) => {
                resolve(next);
            }, (error) => {
                reject(error);
            }, () => {
                //complete
            }).add(() => {
                this.complete();
            });
        });
    }
}

export type PromisifyFn<T extends ((...args: any[]) => any)> = (...args: Parameters<T>) => ReturnType<T> extends Promise<any> ? ReturnType<T> : Promise<ReturnType<T>>;
export type RemoteController<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any ? PromisifyFn<T[P]> : never
};

export function handleActiveSubject(
    activeSubject: MessageSubject<ServerMessageResult>,
    resolve: (v?: any) => void,
    reject: (error: any) => void,
    controller: string,
    name: string,
    entityState: EntityState,
    options?: {
        useThisStreamBehaviorSubject?: StreamBehaviorSubject<any>,
    }
) {
    let returnValue: any;
    const subscribers: { [subscriberId: number]: Subscriber<any> } = {};
    let subscriberIdCounter = 0;
    let streamBehaviorSubject: StreamBehaviorSubject<any> | undefined;

    function deserializeResult(encoding: PropertySchemaSerialized, next: any): any {
        return propertyPlainToClass(
            Object,
            name,
            next, [], 1, {onFullLoadCallbacks: []},
            PropertySchema.fromJSON(encoding),
        );
    }

    activeSubject.subscribe((reply: ServerMessageResult) => {
        if (reply.type === 'type') {
            if (reply.returnType === 'subject') {
                if (options && options.useThisStreamBehaviorSubject) {
                    streamBehaviorSubject = options.useThisStreamBehaviorSubject;
                    streamBehaviorSubject.next(deserializeResult(reply.encoding, reply.data));
                } else {
                    streamBehaviorSubject = new StreamBehaviorSubject(deserializeResult(reply.encoding, reply.data));
                }

                //this behavior is not consistent, so we commented it out.
                // const reconnectionSub = activeSubject.reconnected.subscribe(() => {
                //     reconnectionSub.unsubscribe();
                //     this.stream(controller, name, args, {useThisStreamBehaviorSubject: streamBehaviorSubject});
                // });

                streamBehaviorSubject.addTearDown(async () => {
                    // reconnectionSub.unsubscribe();
                    //user unsubscribed the entity subject, so we stop syncing changes
                    await activeSubject.sendMessage({
                        name: 'subject/unsubscribe',
                        forId: reply.id,
                    }).firstOrUndefinedThenClose();
                });
                resolve(streamBehaviorSubject);
            }

            if (reply.returnType === 'entity') {
                if (reply.item) {
                    const classType = RegisteredEntities[reply.entityName || ''];

                    if (!classType) {
                        throw new Error(`Entity ${reply.entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
                    }

                    const subject = entityState.handleEntity(classType, reply.item!);
                    subject.addTearDown(async () => {
                        //user unsubscribed the entity subject, so we stop syncing changes
                        await activeSubject.sendMessage({
                            name: 'entity/unsubscribe',
                            forId: reply.id,
                        }).firstOrUndefinedThenClose();
                    });

                    resolve(subject);
                } else {
                    reject(new Error('Item not found'));
                }
            }

            if (reply.returnType === 'observable') {
                returnValue = new Observable((observer) => {
                    const subscriberId = ++subscriberIdCounter;

                    subscribers[subscriberId] = observer;

                    activeSubject.sendMessage({
                        forId: reply.id,
                        name: 'observable/subscribe',
                        subscribeId: subscriberId
                    }).firstOrUndefinedThenClose();

                    return {
                        unsubscribe(): void {
                            activeSubject.sendMessage({
                                forId: reply.id,
                                name: 'observable/unsubscribe',
                                subscribeId: subscriberId
                            }).firstOrUndefinedThenClose();
                        }
                    };
                });
                resolve(returnValue);
            }

            if (reply.returnType === 'collection') {
                const classType = RegisteredEntities[reply.entityName];
                if (!classType) {
                    throw new Error(`Entity ${reply.entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
                }

                const collection = new Collection<any>(classType);

                if (reply.pagination.active) {
                    collection.pagination._activate();
                    collection.pagination.setItemsPerPage(reply.pagination.itemsPerPage);
                    collection.pagination.setTotal(reply.pagination.total);
                    collection.pagination.setPage(reply.pagination.page);
                    collection.pagination.setSort(reply.pagination.sort);
                    collection.pagination.setParameters(reply.pagination.parameters);

                    collection.pagination.event.subscribe((event: CollectionPaginationEvent) => {
                        if (event.type === 'apply') {
                            activeSubject.sendMessage({
                                forId: reply.id,
                                name: 'collection/pagination',
                                sort: collection.pagination.getSort(),
                                parameters: collection.pagination.getParameters(),
                                page: collection.pagination.getPage(),
                                itemsPerPage: collection.pagination.getItemsPerPage(),
                            }).firstOrUndefinedThenClose();
                        }
                    });
                }

                returnValue = collection;

                collection.addTeardown(async () => {
                    for (const entitySubject of each(collection.entitySubjects)) {
                        entitySubject.unsubscribe();
                    }

                    //collection unsubscribed, so we stop syncing changes
                    await activeSubject.sendMessage({
                        forId: reply.id,
                        name: 'collection/unsubscribe'
                    }).firstOrUndefinedThenClose();
                    //activeSubject.complete();
                });
                //do not resolve yet, since we want to wait until the collection has bee populated.
            }
        }

        if (reply.type === 'next/json') {
            resolve(deserializeResult(reply.encoding, reply.next));
            //activeSubject.complete();
        }

        if (reply.type === 'next/observable') {
            if (subscribers[reply.subscribeId]) {
                subscribers[reply.subscribeId].next(deserializeResult(reply.encoding, reply.next));
            }
        }

        if (reply.type === 'next/subject') {
            if (streamBehaviorSubject) {
                if (streamBehaviorSubject.isUnsubscribed()) {
                    throw new Error('Next StreamBehaviorSubject failed due to already unsubscribed.');
                }
                streamBehaviorSubject.next(deserializeResult(reply.encoding, reply.next));
            }
        }

        if (reply.type === 'append/subject') {
            if (streamBehaviorSubject) {
                if (streamBehaviorSubject.isUnsubscribed()) {
                    throw new Error('Next StreamBehaviorSubject failed due to already unsubscribed.');
                }
                const append = deserializeResult(reply.encoding, reply.append);
                streamBehaviorSubject.append(append);
            }
        }

        if (reply.type === 'next/collection') {
            entityState.handleCollectionNext(returnValue, reply.next);
            resolve(returnValue);
        }

        if (reply.type === 'complete') {
            if (returnValue instanceof Collection) {
                returnValue.complete();
            }

            if (streamBehaviorSubject) {
                streamBehaviorSubject.complete();
            }

            //activeSubject.complete();
        }

        if (reply.type === 'error') {
            const error = getUnserializedError(reply.entityName, reply.error, reply.stack, `action ${controller}.${name}`);

            if (returnValue instanceof Collection) {
                returnValue.error(error);
            } else if (streamBehaviorSubject) {
                streamBehaviorSubject.error(error);
            } else {
                reject(error);
            }

            //activeSubject.complete();
        }

        if (reply.type === 'error/observable') {
            const error = getUnserializedError(reply.entityName, reply.error, reply.stack, `action ${controller}.${name}`);

            if (subscribers[reply.subscribeId]) {
                subscribers[reply.subscribeId].error(error);
            }

            delete subscribers[reply.subscribeId];
            //activeSubject.complete();
        }

        if (reply.type === 'complete/observable') {
            if (subscribers[reply.subscribeId]) {
                subscribers[reply.subscribeId].complete();
            }

            delete subscribers[reply.subscribeId];
            //activeSubject.complete();
        }
    }, (error: any) => {
        reject(error);
    }, () => {

    });
}
