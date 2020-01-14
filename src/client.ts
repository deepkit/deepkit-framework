import {BehaviorSubject, Subject} from "rxjs";
import {propertyClassToPlain, PropertySchema} from "@marcj/marshal";
import {
    Batcher,
    ClientMessageAll,
    ClientMessageWithoutId,
    Collection,
    ConnectionMiddleware,
    executeAction,
    getActionParameters,
    getActions,
    handleActiveSubject,
    MessageSubject,
    Progress,
    RemoteController,
    ServerMessageActionTypes,
    ServerMessageAll,
    ServerMessageAuthorize,
    ServerMessageComplete,
    ServerMessageError,
    ServerMessagePeerChannelMessage,
    ServerMessageResult,
    SimpleConnectionWriter,
    StreamBehaviorSubject,
    EntityState,
} from "@marcj/glut-core";
import {applyDefaults, asyncOperation, ClassType, each, eachKey, sleep} from "@marcj/estdlib";
import {AsyncSubscription} from "@marcj/estdlib-rxjs";

export class SocketClientConfig {
    host: string = '127.0.0.1';

    port: number = 8080;

    ssl: boolean = false;

    token: any = undefined;
}

export class AuthenticationError extends Error {
    constructor(message: string = 'Authentication failed') {
        super(message);
    }
}

export class OfflineError extends Error {
    constructor(message: string = 'Offline') {
        super(message);
    }
}

let _clientId = 0;

export class ClientProgress {
    static downloadProgress: Progress[] = [];
    static uploadProgress: Progress[] = [];

    /**
     * @deprecated not implemented yet
     */
    static trackUpload() {
        const progress = new Progress;
        ClientProgress.uploadProgress.push(progress);
        return progress;
    }

    /**
     * Sets up a new Progress object for the next API request to be made.
     */
    static trackDownload() {
        const progress = new Progress;
        ClientProgress.downloadProgress.push(progress);
        return progress;
    }
}

export class SocketClient {
    public socket?: WebSocket;

    /**
     * True when the connection established (without authentication)
     */
    private connected: boolean = false;
    private loggedIn: boolean = false;

    private messageId: number = 0;
    private connectionTries = 0;

    private currentConnectionId: number = 0;

    private replies: {
        [messageId: string]: (data: any) => void
    } = {};

    private connectionPromise?: Promise<void>;

    public readonly entityState = new EntityState();
    private config: SocketClientConfig;

    public readonly disconnected = new Subject<number>();
    public readonly reconnected = new Subject<number>();

    public readonly clientId = _clientId++;

    protected batcher = new Batcher(this.onDecodedMessage.bind(this));

    /**
     * true when the connection fully established (after authentication)
     */
    public readonly connection = new BehaviorSubject<boolean>(false);

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: { types?: { parameters: PropertySchema[] }, promise?: Promise<void> } }
    } = {};

    public constructor(
        config: SocketClientConfig | Partial<SocketClientConfig> = {},
    ) {
        this.config = config instanceof SocketClientConfig ? config : applyDefaults(SocketClientConfig, config);
    }

    protected registeredControllers: { [name: string]: { controllerInstance: any, sub: AsyncSubscription } } = {};

    public isConnected(): boolean {
        return this.connected;
    }

    public isLoggedIn(): boolean {
        return this.loggedIn;
    }

    public async registerController<T>(name: string, controllerInstance: T): Promise<AsyncSubscription> {
        if (this.registeredControllers[name]) {
            throw new Error(`Controller with name ${name} already registered.`);
        }

        const peerActionTypes: {
            [name: string]: {
                parameters: PropertySchema[],
            }
        } = {};

        const peerConnectionMiddleware: {
            [cientId: string]: ConnectionMiddleware
        } = {};

        return new Promise(async (resolve, reject) => {
            const activeSubject = await this.sendMessage<ServerMessagePeerChannelMessage>({
                name: 'peerController/register',
                controllerName: name,
            });

            const actions = getActions((controllerInstance as any).constructor as ClassType<T>);

            activeSubject.subscribe(async (message) => {
                if (message.type === 'error') {
                    reject(new Error(message.error));
                }

                if (message.type === 'ack') {
                    const sub = new AsyncSubscription(async () => {
                        await activeSubject.sendMessage({
                            name: 'peerController/unregister',
                            controllerName: name,
                        });
                        delete this.registeredControllers[name];
                        await activeSubject.complete();
                    });

                    this.registeredControllers[name] = {controllerInstance, sub};

                    resolve(sub);
                }

                if (message.type === 'peerController/message') {
                    const writer = new class extends SimpleConnectionWriter {
                        write(connectionMessage: ServerMessageAll) {
                            if (connectionMessage.type === 'peerController/message' || connectionMessage.type === 'channel') {
                                return;
                            }

                            if (connectionMessage.type === 'entity/remove' || connectionMessage.type === 'entity/removeMany'
                                || connectionMessage.type === 'entity/update' || connectionMessage.type === 'entity/patch') {
                                return;
                            }

                            activeSubject.sendMessage({
                                name: 'peerController/message',
                                controllerName: name,
                                clientId: message.clientId,
                                data: connectionMessage
                            });
                        }
                    };

                    if (!peerConnectionMiddleware[message.clientId]) {
                        peerConnectionMiddleware[message.clientId] = new ConnectionMiddleware();
                    }

                    const data: ClientMessageAll = message.data;

                    if ((data.name === 'actionTypes' || data.name === 'action') && !actions[data.action]) {
                        activeSubject.sendMessage({
                            name: 'peerController/message',
                            controllerName: name,
                            clientId: message.clientId,
                            data: {type: 'error', id: data.id, stack: undefined, entityName: '@error:default', error: `Peer action ${data.action} does not exist.`}
                        });
                        return;
                    }

                    if (data.name === 'peerUser/end') {
                        if (peerConnectionMiddleware[message.clientId]) {
                            peerConnectionMiddleware[message.clientId].destroy();
                            delete peerConnectionMiddleware[message.clientId];
                        }
                        return;
                    }

                    if (data.name === 'actionTypes') {
                        peerActionTypes[data.action] = {
                            parameters: getActionParameters((controllerInstance as any).constructor as ClassType<T>, data.action),
                        };

                        const result: ServerMessageActionTypes = {
                            type: 'actionTypes/result',
                            id: data.id,
                            parameters: peerActionTypes[data.action].parameters.map(v => v.toJSON()),
                        };

                        activeSubject.sendMessage({
                            name: 'peerController/message',
                            controllerName: name,
                            clientId: message.clientId,
                            data: result
                        });
                        return;
                    }

                    if (data.name === 'action') {
                        if (!peerActionTypes[data.action]) {
                            //when the client cached the parameters, it won't execute 'actionTypes' again
                            peerActionTypes[data.action] = {
                                parameters: getActionParameters((controllerInstance as any).constructor as ClassType<T>, data.action),
                            };
                        }

                        try {
                            const {value, encoding} = await executeAction(peerActionTypes[data.action], name, controllerInstance, data.action, data.args);

                            peerConnectionMiddleware[message.clientId].actionMessageOut(message.data, value, encoding, name, data.action, writer);
                        } catch (error) {
                            writer.sendError(data.id, error);
                        }
                        return;
                    }

                    peerConnectionMiddleware[message.clientId].messageIn(message.data, writer);
                }
            }, (error: any) => {
                delete this.registeredControllers[name];
                activeSubject.error(error);
            });
        });
    }

    public peerController<T>(name: string, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream('_peer/' + name, actionName, args, {timeoutInSeconds: timeoutInSeconds});
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    public controller<T>(name: string, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream(name, actionName, args, {timeoutInSeconds: timeoutInSeconds});
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    protected onMessage(event: MessageEvent) {
        this.batcher.handle(event.data.toString());
    }

    protected onDecodedMessage(decoded: any) {
        if (decoded.type === 'entity/remove' || decoded.type === 'entity/patch' || decoded.type === 'entity/update' || decoded.type === 'entity/removeMany') {
            this.entityState.handleEntityMessage(decoded);
            return;
        } else if (decoded.type === 'push-message') {
            //handle shizzle
        } else if (decoded.type === 'channel') {
            //not built in yet
        } else {
            if (this.replies[decoded.id]) {
                this.replies[decoded.id](decoded);
            }
        }
    }

    public async onConnected(): Promise<void> {

    }

    protected async doConnect(): Promise<void> {
        const port = this.config.port;

        this.connectionTries++;
        if (!this.config.host) {
            throw new Error('No host configured');
        }

        const url = this.config.host.startsWith('ws+unix') ?
            this.config.host :
            ((this.config.ssl ? 'wss://' : 'ws://') + this.config.host + ':' + port);

        this.socket = undefined;

        return new Promise<void>((resolve, reject) => {
            try {
                const socket = this.socket = new WebSocket(url);

                socket.onmessage = (event: MessageEvent) => {
                    this.onMessage(event);
                };

                socket.onclose = () => {
                    this.cachedActionsTypes = {};
                    if (this.connected) {
                        this.connection.next(false);
                        this.onDisconnect();
                    }
                    this.loggedIn = false;

                    if (this.connected) {
                        this.connected = false;
                        this.disconnected.next(this.currentConnectionId);
                    }

                    this.currentConnectionId++;
                };

                socket.onerror = (error: any) => {
                    this.cachedActionsTypes = {};
                    if (this.connected) {
                        this.connection.next(false);
                        this.onDisconnect();
                    }

                    this.loggedIn = false;
                    if (this.connected) {
                        this.connected = false;
                        this.disconnected.next(this.currentConnectionId);
                    }

                    this.currentConnectionId++;

                    reject(new OfflineError(`Could not connect to ${this.config.host}:${port}. Reason: ${error.message || error}`));
                };

                socket.onopen = async () => {
                    //it's important to place it here, since authenticate() sends messages and checks this.connected.
                    this.connected = true;
                    this.connectionTries = 0;

                    if (this.config.token) {
                        if (!await this.authenticate()) {
                            this.connected = false;
                            this.connectionTries = 0;
                            socket.close();
                            reject(new AuthenticationError());
                            return;
                        }
                    }

                    this.connection.next(true);
                    await this.onConnected();

                    resolve();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Simply connect with login using the token, without auto re-connect.
     */
    public async connect(): Promise<void> {
        while (this.connectionPromise) {
            await sleep(0.01);
            await this.connectionPromise;
        }

        if (this.connection.value) {
            return;
        }

        this.connectionPromise = this.doConnect();

        try {
            await this.connectionPromise;
        } finally {
            delete this.connectionPromise;
        }

        if (this.connection.value && this.currentConnectionId > 0) {
            this.reconnected.next(this.currentConnectionId);
        }
    }

    public async getActionTypes(controller: string, actionName: string, timeoutInSeconds = 0): Promise<{
        parameters: PropertySchema[]
    }> {
        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }
        if (!this.cachedActionsTypes[controller][actionName]) {
            this.cachedActionsTypes[controller][actionName] = {};
        }

        if (this.cachedActionsTypes[controller][actionName].promise) {
            await this.cachedActionsTypes[controller][actionName].promise;
        }

        if (!this.cachedActionsTypes[controller][actionName].types) {
            this.cachedActionsTypes[controller][actionName].promise = asyncOperation<void>(async (resolve, reject) => {
                const reply = await this.sendMessage<ServerMessageActionTypes>({
                    name: 'actionTypes',
                    controller: controller,
                    action: actionName,
                    timeout: timeoutInSeconds,
                }, {timeout: timeoutInSeconds}).firstThenClose();

                if (reply.type === 'error') {
                    delete this.cachedActionsTypes[controller][actionName];
                    throw new Error(reply.error);
                } else if (reply.type === 'actionTypes/result') {
                    this.cachedActionsTypes[controller][actionName].types = {
                        parameters: reply.parameters.map(v => PropertySchema.fromJSON(v)),
                    };
                    resolve();
                } else {
                    delete this.cachedActionsTypes[controller][actionName];
                    throw new Error('Invalid message returned: ' + JSON.stringify(reply));
                }
            });
            await this.cachedActionsTypes[controller][actionName].promise;
        }

        return this.cachedActionsTypes[controller][actionName].types!;
    }

    public async stream(controller: string, name: string, args: any[], options?: {
        useThisCollection?: Collection<any>,
        timeoutInSeconds?: number,
        useThisStreamBehaviorSubject?: StreamBehaviorSubject<any>,
    }): Promise<any> {
        return asyncOperation<any>(async (resolve, reject) => {
            const timeoutInSeconds = options && options.timeoutInSeconds ? options.timeoutInSeconds : 0;

            const types = await this.getActionTypes(controller, name, timeoutInSeconds);

            for (const i of eachKey(args)) {
                args[i] = propertyClassToPlain(Object, name, args[i], types.parameters[i]);
            }

            const activeSubject = this.sendMessage<ServerMessageResult>({
                name: 'action',
                controller: controller,
                action: name,
                args: args,
                timeout: timeoutInSeconds,
            }, {timeout: timeoutInSeconds, progressable: true});

            if (controller.startsWith('_peer/')) {
                activeSubject.setSendMessageModifier((m: any) => {
                    return {
                        name: 'peerMessage',
                        controller: controller,
                        message: m,
                        timeout: timeoutInSeconds,
                    };
                });
            }

            handleActiveSubject(activeSubject, resolve, reject, controller, name, this.entityState, options);
        });
    }

    public send(message: ClientMessageAll) {
        if (this.socket === undefined) {
            throw new Error('Socket not created yet');
        }

        try {
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            throw new OfflineError(error);
        }
    }

    public sendMessage<T = { type: '' }, K = T | ServerMessageComplete | ServerMessageError>(
        messageWithoutId: ClientMessageWithoutId,
        options?: {
            dontWaitForConnection?: boolean,
            connectionId?: number,
            timeout?: number,
            progressable?: boolean,
        }
    ): MessageSubject<K> {
        this.messageId++;

        if (options && options.progressable && ClientProgress.downloadProgress.length > 0) {
            this.batcher.registerProgress(this.messageId, ClientProgress.downloadProgress);
            ClientProgress.downloadProgress = [];
        }

        const messageId = this.messageId;
        const dontWaitForConnection = !!(options && options.dontWaitForConnection);
        const timeout = options && options.timeout ? options.timeout : 0;
        const connectionId = options && options.connectionId ? options.connectionId : this.currentConnectionId;

        const message = {
            id: messageId, ...messageWithoutId
        };

        const reply = (message: ClientMessageWithoutId): MessageSubject<any> => {
            if (connectionId === this.currentConnectionId) {
                return this.sendMessage(message, {dontWaitForConnection, connectionId});
            }

            // console.warn('Connection meanwhile dropped.', connectionId, this.currentConnectionId);
            const nextSubject = new MessageSubject(connectionId, reply);
            nextSubject.complete();

            return nextSubject;
        };

        const subject = new MessageSubject<K>(connectionId, reply);

        let timer: any;
        if (timeout) {
            timer = setTimeout(() => {
                if (!subject.isStopped) {
                    subject.error('Server timed out after ' + timeout + 'seconds');
                }
            }, timeout * 1000);
        }

        const sub = this.disconnected.subscribe((disconnectedConnectionId: number) => {
            if (disconnectedConnectionId === connectionId) {
                if (!subject.isStopped) {
                    // console.debug('MessageSubject: connection disconnected before closing', {message: messageWithoutId, isStopped: subject.isStopped});
                    subject.error(new OfflineError);
                }
            }
        });

        subject.subscribe({
            next: () => {
                clearTimeout(timer);
            }, complete: () => {
                clearTimeout(timer);
            }, error: () => {
                clearTimeout(timer);
            }
        }).add(() => {
            delete this.replies[messageId];
            sub.unsubscribe();
        });

        this.replies[messageId] = (reply: K) => {
            if (!subject.isStopped) {
                subject.next(reply);
            }
        };

        if (dontWaitForConnection) {
            this.send(message);
        } else {
            this.connect().then(() => this.send(message), (error) => {
                subject.error(new OfflineError(error));
            });
        }

        return subject;
    }

    private async authenticate(): Promise<boolean> {
        // console.log('authenticate send', this.config.token);

        const reply = await this.sendMessage<ServerMessageAuthorize>({
            name: 'authenticate',
            token: this.config.token,
        }, {dontWaitForConnection: true}).firstThenClose();

        // console.log('authenticate reply', reply);

        if (reply.type === 'authenticate/result') {
            this.loggedIn = reply.result;
        }

        if (reply.type === 'error') {
            throw new Error('Authentication error. ' + reply.error);
        }

        return this.loggedIn;
    }

    protected async onDisconnect() {
        for (const con of each(this.registeredControllers)) {
            await con.sub.unsubscribe();
        }

        this.registeredControllers = {};
        this.cachedActionsTypes = {};
    }

    public async disconnect() {
        await this.onDisconnect();

        this.connected = false;
        this.loggedIn = false;

        this.disconnected.next(this.currentConnectionId);

        this.currentConnectionId++;
        this.connection.next(false);

        if (this.socket) {
            this.socket.close();
            delete this.socket;
        }
    }
}
