import {Observable} from "rxjs";
import {AnyType, ClassType, NumberType, StringType} from "@marcj/marshal";

interface RemoteChannelMessage {
    type: 'channel';
    name: string;
    data: any;
}

interface RemoteAnswer {
    type: 'answer';
    id: number;
    next?: any;
    result?: any;
    error?: any;
}

export class SocketClientConfig {
    @StringType()
    host: string = 'localhost';

    @NumberType()
    port: number = 8701;

    @AnyType()
    token: any;
}

export class AuthorizationError extends Error {}

export class SocketClient  {
    public socket?: WebSocket;

    private connected: boolean = false;
    private loggedIn: boolean = false;

    private messageId: number = 0;
    // private maxConnectionTries = 5;
    // private maxConnectionTryDelay = 2;
    private connectionTries = 0;

    private token?: any;

    private replies: {
        [messageId: string]: {
            next?: (data: any) => void,
            success: () => void,
            error: (error: any) => void
        }
    } = {};

    private connectionPromise?: Promise<void>;

    public constructor(public readonly config: SocketClientConfig) {
        // super();
        if (config && !(config instanceof SocketClientConfig)) {
            throw new Error('Config is not from SocketClientConfig');
        }
    }

    public setToken(token?: any) {
        this.token = token;
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public isLoggedIn(): boolean {
        return this.loggedIn;
    }
    //
    // on(event: 'offline' | 'online' | string, listener: (...args: any[]) => void): this {
    //     return super.on(event, listener);
    // }

    /**
     * True when connected and logged in.
     */
    public isReady(): boolean {
        return this.connected && this.loggedIn;
    }

    public api<R, T = any>(implType?: ClassType<T>): R {
        const t = this;
        let impl: T | undefined;

        if (implType) {
            impl = new implType(this.api());
        }

        const o = new Proxy(this, {
            get: (target, name) => {
                return function () {
                    const actionName = String(name);
                    const args = Array.prototype.slice.call(arguments);

                    if (impl && (impl as any)[actionName]) {
                        return (impl as any)[actionName](...args);
                    }

                    return t.stream(actionName, ...args);
                };
            }
        });

        return (o as any) as R;
    }

    protected onMessage(event: MessageEvent) {
        const reply = JSON.parse(event.data) as RemoteChannelMessage | RemoteAnswer;

        if (!reply) {
            throw new Error(`Got invalid message: ` + event.data);
        }

        if (reply.type === 'answer') {
            const callback = this.replies[reply.id];

            if (!callback) {
                throw new Error(`Got message without reply callback (timeout?): ` + event.data);
            }

            if (reply.next) {
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
                    callback.success();
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
        socket.onmessage = (event: MessageEvent) => this.onMessage(event);

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

    public stream(name: string, ...args: any[]): Observable<any> {
        return new Observable((observer) => {
            this.messageId++;
            const messageId = this.messageId;

            const message = {
                id: messageId,
                name: 'action',
                payload: {action: name, args}
            };

            this.replies[messageId] = {
                next: (data) => {
                    observer.next(data);
                }, success: () => {
                    observer.complete();
                }, error: (error) => {
                    observer.error(new Error(error));
                }
            };
            this.connect().then(_ => this.send(JSON.stringify(message)));

            return {
                unsubscribe: () => {
                    const message = {
                        id: messageId,
                        name: 'unsubscribe',
                    };
                    this.connect().then(_ => this.send(JSON.stringify(message)));
                }
            };
        });
    }

    public async action(name: string, ...args: any[]): Promise<any> {
        return this.stream(name, ...args).toPromise();
    }

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
            this.replies[messageId] = {next: next, success: resolve, error: reject};
            await this.send(JSON.stringify(message));

            setTimeout(() => {
                if (this.replies[messageId]) {
                    delete this.replies[messageId];
                    reject();
                }
            }, 60 * 1000);
        });
    }

    // private async hi(): Promise<boolean> {
    //     try {
    //         await this.sendMessage('hi');
    //         this.connected = true;
    //         return true;
    //     } catch (error) {
    //         console.error('hi error', error);
    //         this.connected = false;
    //         throw error;
    //     }
    // }

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
