import {Observable, Subscriber} from "rxjs";
import {AnyType, NumberType, plainToClass, RegisteredEntities, StringType} from "@marcj/marshal";
import * as WebSocket from "ws";
import {Collection, MessageResult, MessageType} from "@kamille/core";
import {EntityState} from "./entity-state";

export class SocketClientConfig {
    @StringType()
    host: string = 'localhost';

    @NumberType()
    port: number = 8080;

    @AnyType()
    token: any;
}

export class AuthorizationError extends Error {
}

export class SocketClient {
    public socket?: WebSocket;

    private connected: boolean = false;
    private loggedIn: boolean = false;

    private messageId: number = 0;
    // private maxConnectionTries = 5;
    // private maxConnectionTryDelay = 2;
    private connectionTries = 0;

    private replies: {
        [messageId: string]: {
            returnType?: (type: MessageType) => void,
            next?: (data: any) => void,
            complete: () => void,
            error: (error: any) => void
        }
    } = {};

    private connectionPromise?: Promise<void>;

    private entityState = new EntityState();

    public constructor(public readonly config: SocketClientConfig = new SocketClientConfig) {
        if (config && !(config instanceof SocketClientConfig)) {
            throw new Error('Config is not from SocketClientConfig');
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }

    // public isLoggedIn(): boolean {
    //     return this.loggedIn;
    // }
    //
    // on(event: 'offline' | 'online' | string, listener: (...args: any[]) => void): this {
    //     return super.on(event, listener);
    // }

    // /**
    //  * True when connected and logged in.
    //  */
    // public isReady(): boolean {
    //     return this.connected && this.loggedIn;
    // }

    public controller<T,
        U extends any[] = [],
        R = { [P in keyof T]: T[P] extends (...args: any[]) => any ? (...args: U) => Promise<ReturnType<T[P]>> : T[P] }>(name: string): R {
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

        return (o as any) as R;
    }

    protected onMessage(event: { data: WebSocket.Data; type: string; target: WebSocket }) {
        const reply = JSON.parse(event.data.toString()) as MessageResult;

        if (!reply) {
            throw new Error(`Got invalid message: ` + event.data);
        }

        if (reply.type === 'complete' || reply.type === 'next' || reply.type === 'error' || reply.type === 'type') {
            const callback = this.replies[reply.id];

            if (!callback) {
                throw new Error(`Got message without reply callback (timeout?): ` + event.data);
            }

            if (reply.type === 'type') {
                if (callback.returnType) {
                    callback.returnType(reply);
                }
            } else if (reply.type === 'next') {
                if (callback.next) {
                    //convert if possible
                    if (reply.entityName && RegisteredEntities[reply.entityName]) {
                        reply.next = plainToClass(RegisteredEntities[reply.entityName], reply.next);
                    }
                    callback.next(reply.next);
                }
            } else if (reply.type === 'error') {
                if (callback.error) {
                    callback.error(reply.error);
                }
            } else if (reply.type === 'complete') {
                if (callback.complete) {
                    callback.complete();
                }
            }
        }
    }

    public async onConnected(): Promise<void> {

    }

    protected async doConnect(): Promise<void> {
        const port = this.config.port;
        this.connectionTries++;
        const socket = this.socket = new WebSocket('ws://' + this.config.host + ':' + port);
        socket.onmessage = (event: { data: WebSocket.Data; type: string; target: WebSocket }) => this.onMessage(event);

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
                    if (!await this.authorize()) {
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
            this.messageId++;
            const messageId = this.messageId;

            const message = {
                id: messageId,
                name: 'action',
                payload: {controller: controller, action: name, args}
            };

            let handleType = 'json';
            let returnValue: any;

            //todo, implement collection
            const self = this;
            let subscriber: Subscriber<any> | undefined;

            this.replies[messageId] = {
                returnType: (type: MessageType) => {
                    if (type.returnType === 'observable') {
                        returnValue = new Observable((observer) => {
                            subscriber = observer;

                            return {
                                unsubscribe(): void {
                                    const message = {
                                        id: messageId,
                                        name: 'unsubscribe',
                                    };
                                    self.connect().then(() => self.send(JSON.stringify(message)));
                                }
                            }
                        });
                        resolve(returnValue);
                    }
                    if (type.returnType === 'collection') {
                        const classType = RegisteredEntities[type.entityName];
                        if (!classType) {
                            throw new Error(`Entity ${type.entityName} not known`);
                        }

                        returnValue = new Collection<any>(classType);
                    }
                },
                next: (data) => {
                    if (subscriber && handleType === 'observable') {
                        subscriber.next(data);
                    }
                    if (handleType === 'collection' && returnValue instanceof Collection) {
                        //todo, we need to typecast data to FindResult from state::findAndSubscribe
                        this.entityState.handleCollectionNext(returnValue, data);
                    }
                    if (handleType === 'json') {
                        resolve(data);
                    }
                },
                complete: () => {
                    if (subscriber) {
                        subscriber.complete();
                    }
                },
                error: (error) => {
                    if (subscriber) {
                        subscriber.error(new Error(error));
                    } else {
                        reject(new Error(error));
                    }
                }
            };

            this.connect().then(_ => this.send(JSON.stringify(message)));
        })
    }

    // public async action(controller: string, name: string, ...args: any[]): Promise<any> {
    //     return this.stream(controller, name, ...args);
    // }

    public async send(payload: string) {
        if (!this.socket) {
            throw new Error('Socket not created yet');
        }

        this.socket.send(payload);
    }

    private async sendMessage(name: string, payload: any, next?: (data: any) => void): Promise<any> {
        this.messageId++;
        const messageId = this.messageId;

        const message = {
            id: messageId,
            name: name,
            payload: payload
        };

        // console.time('send ' + channel + ': ' + JSON.stringify(message));
        return new Promise<any>(async (resolve, reject) => {
            this.replies[messageId] = {
                returnType: (type) => {
                }, next: next, complete: resolve, error: reject
            };
            await this.send(JSON.stringify(message));

            setTimeout(() => {
                if (this.replies[messageId]) {
                    delete this.replies[messageId];
                    reject('Message timeout');
                }
            }, 60 * 1000);
        });
    }

    private async authorize(): Promise<boolean> {
        try {
            const success = this.sendMessage('authorize', {
                token: this.config.token,
            });
            if (success) {
                this.loggedIn = true;
                return true;
            }

            return false;
        } catch (error) {
            console.error('login error', error);
            this.loggedIn = false;
            throw error;
        }
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
