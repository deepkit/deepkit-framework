import {Subject} from "rxjs";
import {AnyType, NumberType, StringType} from "@marcj/marshal";
import * as WebSocket from "ws";

interface RemoteChannelMessage {
    type: 'channel';
    name: string;
    data: any;
}

interface RemoteAnswer {
    type: 'answer';
    id: number;
    returnType: 'json' | 'collection' | 'observable';
    next?: any;
    result?: any;
    error?: any;
}

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
            returnType?: (type: 'json' | 'collection' | 'observable') => void,
            next?: (data: any) => void,
            complete: () => void,
            error: (error: any) => void
        }
    } = {};

    private connectionPromise?: Promise<void>;

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
        const reply = JSON.parse(event.data.toString()) as RemoteChannelMessage | RemoteAnswer;

        if (!reply) {
            throw new Error(`Got invalid message: ` + event.data);
        }

        if (reply.type === 'answer') {
            const callback = this.replies[reply.id];

            if (!callback) {
                throw new Error(`Got message without reply callback (timeout?): ` + event.data);
            }

            if (reply.returnType) {
                if (callback.returnType) {
                    callback.returnType(reply.returnType);
                }
            } else if (reply.next) {
                if (callback.next) {
                    callback.next(reply.next);
                }
            } else {
                if (reply.error) {
                    callback.error(reply.error);
                } else {
                    if (reply.result && callback.next) {
                        callback.next(reply.result);
                    }
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

            this.replies[messageId] = {
                returnType: (type) => {
                    handleType = type;
                    if (handleType === 'observable') {
                        returnValue = new Subject();
                        resolve(returnValue);
                    } else if (handleType === 'collection') {
                        // returnValue = new Collection<any>();
                        // resolve(returnValue);
                    }
                },
                next: (data) => {
                    if (returnValue instanceof Subject) {
                        returnValue.next(data);
                    }
                    if (handleType === 'observable') {
                        resolve(data);
                    }
                    if (handleType === 'json') {
                        resolve(data);
                    }
                },
                complete: () => {
                    if (returnValue instanceof Subject) {
                        returnValue.complete();
                    }
                },
                error: (error) => {
                    if (returnValue instanceof Subject) {
                        returnValue.error(new Error(error));
                    } else {
                        reject(new Error(error));
                    }
                }
            };

            this.connect().then(_ => this.send(JSON.stringify(message)));
        })

        //
        // return new Observable((observer) => {
        //     this.messageId++;
        //     const messageId = this.messageId;
        //
        //     const message = {
        //         id: messageId,
        //         name: 'action',
        //         payload: {controller: controller, action: name, args}
        //     };
        //
        //     this.replies[messageId] = {
        //         next: (data) => {
        //             observer.next(data);
        //         }, success: () => {
        //             observer.complete();
        //         }, error: (error) => {
        //             observer.error(new Error(error));
        //         }
        //     };
        //     this.connect().then(_ => this.send(JSON.stringify(message)));
        //
        //     return {
        //         unsubscribe: () => {
        //             const message = {
        //                 id: messageId,
        //                 name: 'unsubscribe',
        //             };
        //             this.connect().then(_ => this.send(JSON.stringify(message)));
        //         }
        //     };
        // });
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
