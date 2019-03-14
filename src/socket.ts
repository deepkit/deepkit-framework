import {Observable, Subscriber, Subject} from "rxjs";
import {plainToClass, RegisteredEntities} from "@marcj/marshal";
// import * as WebSocket from "ws";

import {

    ClientMessageAll,
    ClientMessageWithoutId,
    Collection, EntitySubject,
    ServerMessageAll,
    ServerMessageResult, StreamBehaviorSubject
} from "@marcj/glut-core";
import {applyDefaults} from "@marcj/estdlib";
import {EntityState} from "./entity-state";

export class SocketClientConfig {
    host: string = '127.0.0.1';

    port: number = 8080;

    token: any = undefined;
}

export class AuthorizationError extends Error {
}

//todo, add better argument inference for U
export type Promisify<T> = { [P in keyof T]: T[P] extends (...args: infer U) => infer RT ? RT extends Promise<any> ? T[P] : (...args: U) => Promise<RT> : T[P] };

export class SocketClient {
    public socket?: WebSocket;

    private connected: boolean = false;
    private loggedIn: boolean = false;

    private messageId: number = 0;
    private connectionTries = 0;

    private replies: {
        [messageId: string]: (data: ServerMessageResult) => void
    } = {};

    private connectionPromise?: Promise<void>;

    private entityState = new EntityState();
    private config: SocketClientConfig;

    public constructor(
        config: SocketClientConfig | Partial<SocketClientConfig> = {},
    ) {
        this.config = config instanceof SocketClientConfig ? config : applyDefaults(SocketClientConfig, config);
    }

    //todo, add better argument inference for U
    public controller<T>(name: string): Promisify<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream(name, actionName, ...args);
                };
            }
        });

        return (o as any) as Promisify<T>;
    }

    protected onMessage(event: MessageEvent) {
        const message = JSON.parse(event.data.toString()) as ServerMessageAll;
        // console.log('onMessage', message);

        if (!message) {
            throw new Error(`Got invalid message: ` + event.data);
        }

        if (message.type === 'entity/remove' || message.type === 'entity/patch' || message.type === 'entity/update' || message.type === 'entity/removeMany') {
            this.entityState.handleEntityMessage(message);
            return;
        } else if (message.type === 'channel') {
            //not built in yet
        } else {
            if (this.replies[message.id]) {
                this.replies[message.id](message);
            } else {
                console.debug(`No replies callback for message ${message.id}`);
            }
        }
    }

    public async onConnected(): Promise<void> {

    }

    protected async doConnect(): Promise<void> {
        const port = this.config.port;
        this.connectionTries++;
        const url = this.config.host.startsWith('ws+unix') ? this.config.host : 'ws://' + this.config.host + ':' + port;

        console.log('connect', url);

        const socket = this.socket = new WebSocket(url);
        socket.onmessage = (event: MessageEvent) => {
            this.onMessage(event);
        };
        // socket.onmessage = (event: { data: WebSocket.Data; type: string; target: WebSocket }) => this.onMessage(event);

        return new Promise<void>((resolve, reject) => {
            socket.onerror = (error: any) => {
                if (this.connected) {
                    // this.emit('offline');
                }

                this.connected = false;
                if (this.connectionTries === 1) {
                    reject(new Error(`Could not connect to ${this.config.host}:${port}. Reason: ${error.message}`));
                }
            };

            socket.onopen = async () => {
                if (this.config.token) {
                    if (!await this.authenticate()) {
                        reject(new AuthorizationError());
                        return;
                    }
                }

                await this.onConnected();
                this.connected = true;
                this.connectionTries = 0;
                // this.emit('online');
                resolve();
            };
        });
    }

    /**
     * Simply connect with login using the token, without auto re-connect.
     */
    public async connect(): Promise<void> {
        while (this.connectionPromise) {
            await this.connectionPromise;
        }

        if (this.connected) {
            return;
        }

        this.connectionPromise = this.doConnect();

        try {
            await this.connectionPromise;
        } finally {
            delete this.connectionPromise;
        }
    }

    public async stream(controller: string, name: string, ...args: any[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            //todo, handle reject when we sending message fails

            let activeReturnType = 'json';
            let returnValue: any;

            const self = this;
            const subscribers: { [subscriberId: number]: Subscriber<any> } = {};
            let subscriberIdCounter = 0;
            let streamBehaviorSubject: StreamBehaviorSubject<any> | undefined;

            this.sendMessage({
                name: 'action',
                controller: controller,
                action: name,
                args: args
            }, (reply: ServerMessageResult) => {
                if (reply.type === 'type') {
                    activeReturnType = reply.returnType;

                    if (reply.returnType === 'subject') {
                        streamBehaviorSubject = new StreamBehaviorSubject(reply.data);
                        resolve(streamBehaviorSubject);
                    }

                    if (reply.returnType === 'entity') {
                        if (reply.item) {
                            const classType = RegisteredEntities[reply.entityName || ''];

                            if (!classType) {
                                throw new Error(`Entity ${reply.entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
                            }

                            //
                            if (this.entityState.hasEntitySubject(classType, reply.item.id)) {
                                const subject = this.entityState.handleEntity(classType, reply.item);
                                resolve(subject);
                            } else {
                                //it got created, so we subscribe only once to notify server about
                                //unused EntitySubject when completed.
                                const subject = this.entityState.handleEntity(classType, reply.item);
                                subject.addTearDown(() => {
                                    //user unsubscribed the entity subject, so we stop syncing changes
                                    self.send({
                                        id: reply.id,
                                        name: 'entity/unsubscribe'
                                    });
                                });

                                resolve(subject);
                            }
                        } else {
                            resolve(new EntitySubject(undefined));
                        }
                    }

                    if (reply.returnType === 'observable') {
                        returnValue = new Observable((observer) => {
                            const subscriberId = ++subscriberIdCounter;

                            subscribers[subscriberId] = observer;

                            self.send({
                                id: reply.id,
                                name: 'observable/subscribe',
                                subscribeId: subscriberId
                            });

                            return {
                                unsubscribe(): void {
                                    self.send({
                                        id: reply.id,
                                        name: 'observable/unsubscribe',
                                        subscribeId: subscriberId
                                    });
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
                        returnValue = collection;

                        collection.addTeardown(() => {
                            console.log('client: unsubscribe collection');
                            this.entityState.unsubscribeCollection(collection);

                            //collection unsubscribed, so we stop syncing changes
                            self.send({
                                id: reply.id,
                                name: 'collection/unsubscribe'
                            });
                        });
                        resolve(collection);
                    }
                }

                if (reply.type === 'next/json') {
                    if (reply.entityName && RegisteredEntities[reply.entityName]) {
                        reply.next = plainToClass(RegisteredEntities[reply.entityName], reply.next);
                    }
                    resolve(reply.next);
                }

                if (reply.type === 'next/observable') {
                    if (reply.entityName && RegisteredEntities[reply.entityName]) {
                        reply.next = plainToClass(RegisteredEntities[reply.entityName], reply.next);
                    }

                    if (subscribers[reply.subscribeId]) {
                        subscribers[reply.subscribeId].next(reply.next);
                    }
                }

                if (reply.type === 'next/subject') {
                    if (reply.entityName && RegisteredEntities[reply.entityName]) {
                        reply.next = plainToClass(RegisteredEntities[reply.entityName], reply.next);
                    }

                    if (streamBehaviorSubject) {
                        streamBehaviorSubject.next(reply.next);
                    }
                }

                if (reply.type === 'next/collection') {
                    this.entityState.handleCollectionNext(returnValue, reply.next);
                }

                if (reply.type === 'complete') {
                    if (returnValue instanceof Collection) {
                        returnValue.complete();
                    }

                    if (streamBehaviorSubject) {
                        streamBehaviorSubject.complete();
                    }
                }

                if (reply.type === 'error') {
                    if (returnValue instanceof Collection) {
                        returnValue.error(reply.error);
                    } else if (streamBehaviorSubject) {
                        streamBehaviorSubject.error(reply.error);
                    } else {
                        reject(reply.error);
                    }
                }

                if (reply.type === 'error/observable') {
                    if (subscribers[reply.subscribeId]) {
                        subscribers[reply.subscribeId].error(reply.error);
                    }
                }

                if (reply.type === 'complete/observable') {
                    if (subscribers[reply.subscribeId]) {
                        subscribers[reply.subscribeId].complete();
                    }
                }
            });

        });
    }

    public send(message: ClientMessageAll) {
        if (!this.socket) {
            throw new Error('Socket not created yet');
        }

        this.socket.send(JSON.stringify(message));
    }

    private sendMessage(messageWithoutId: ClientMessageWithoutId, answer: (data: ServerMessageResult) => void): void {
        this.messageId++;
        const messageId = this.messageId;

        const message = {
            id: messageId, ...messageWithoutId
        };

        this.replies[messageId] = answer;

        this.connect().then(() => this.send(message), (error) => {
            throw error;
        });
    }

    private async authenticate(): Promise<boolean> {
        this.loggedIn = await new Promise<boolean>((resolve, reject) => {
            this.sendMessage({
                name: 'authenticate',
                token: this.config.token,
            }, (reply: ServerMessageResult) => {
                if (reply.type === 'authenticate/result') {
                    resolve(reply.result);
                }

                if (reply.type === 'error') {
                    reject(reply.error);
                }
            });

        });

        return this.loggedIn;
    }

    public disconnect() {
        this.connected = false;
        this.loggedIn = false;

        if (this.socket) {
            this.socket.close();
            delete this.socket;
        }
    }
}
