/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {BehaviorSubject, Subject} from 'rxjs';
import {jsonSerializer, PropertySchema} from '@deepkit/type';
import {
    Batcher,
    ClientMessageAll,
    ClientMessageWithoutId,
    Collection,
    ConnectionMiddleware,
    EntityState,
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
    ControllerDefinition,
} from '@deepkit/framework-shared';
import {asyncOperation, ClassType, eachKey, sleep} from '@deepkit/core';
import {AsyncSubscription} from '@deepkit/core-rxjs';

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

export class ClientProgressStack {
    downloadProgress: Progress[] = [];
    uploadProgress: Progress[] = [];
}

export class ClientProgress {
    static currentStack = new ClientProgressStack();

    /**
     * Returns the current stack and sets a new one.
     */
    static fork() {
        const old = this.currentStack;
        ClientProgress.currentStack = new ClientProgressStack();
        return old;
    }

    /**
     * @deprecated not implemented yet
     */
    static trackUpload() {
        const progress = new Progress;
        ClientProgress.currentStack.uploadProgress.push(progress);
        return progress;
    }

    /**
     * Sets up a new Progress object for the next API request to be made.
     */
    static trackDownload() {
        const progress = new Progress;
        ClientProgress.currentStack.downloadProgress.push(progress);
        return progress;
    }
}

export interface TransportConnection {
    send(message: ClientMessageAll): void;
    disconnect(): void;
}

export interface TransportConnectionHooks {
    onConnected(transportConnection: TransportConnection): void;

    onClose(): void;

    onMessage(data: string): void;

    onError(error: any): void;
}

export interface ClientTransportAdapter {
    connect(connection: TransportConnectionHooks): Promise<void> | void;
}

export class Client {
    /**
     * True when the connection established (without authentication)
     */
    protected connected: boolean = false;
    protected loggedIn: boolean = false;

    protected messageId: number = 0;
    protected connectionTries = 0;

    protected currentConnectionId: number = 0;

    protected replies: {
        [messageId: string]: (data: any) => void
    } = {};

    protected connectionPromise?: Promise<void>;

    public readonly entityState = new EntityState();

    protected readonly disconnected = new Subject<number>();
    protected readonly reconnected = new Subject<number>();

    public readonly clientId = _clientId++;

    /**
     * Token object used for authentication purposes, when set.
     */
    protected authToken?: any;

    protected batcher = new Batcher(this.onDecodedMessage.bind(this));

    // protected connection?: ClientConnection;

    /**
     * true when the connection fully established (after authentication)
     */
    public readonly connection = new BehaviorSubject<boolean>(false);

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: { types?: { parameters: PropertySchema[] }, promise?: Promise<void> } }
    } = {};

    protected transportConnection?: TransportConnection;

    public constructor(public transport: ClientTransportAdapter) {
    }

    protected registeredControllers: { [name: string]: { controllerInstance: any, sub: AsyncSubscription } } = {};

    public isConnected(): boolean {
        return this.connected;
    }

    public isLoggedIn(): boolean {
        return this.loggedIn;
    }

    public setAuthToken(authToken: any) {
        this.authToken = authToken;
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

                    if ((data.name === 'actionTypes' || data.name === 'action') && !actions.has(data.action)) {
                        activeSubject.sendMessage({
                            name: 'peerController/message',
                            controllerName: name,
                            clientId: message.clientId,
                            data: {
                                type: 'error',
                                id: data.id,
                                stack: undefined,
                                entityName: '@error:default',
                                error: `Peer action ${data.action} does not exist.`
                            }
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

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    const path = 'string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path;
                    return t.stream(path, actionName, args, {timeoutInSeconds: timeoutInSeconds});
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    protected onMessage(data: string) {
        this.batcher.handle(data);
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

    protected async doConnect(): Promise<void> {
        this.connectionTries++;

        if (this.transportConnection) {
            this.transportConnection.disconnect();
            this.transportConnection = undefined;
        }

        return new Promise<void>(async (resolve, reject) => {
            try {
                await this.transport.connect({
                    onClose: () => {
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
                    },

                    onConnected: async (transport: TransportConnection) => {
                        this.transportConnection = transport;
                        //it's important to place it here, since authenticate() sends messages and checks this.connected.
                        this.connected = true;
                        this.connectionTries = 0;

                        if (this.authToken) {
                            if (!await this.authenticate()) {
                                this.connected = false;
                                this.connectionTries = 0;
                                reject(new AuthenticationError());
                                return;
                            }
                        }

                        this.connection.next(true);

                        resolve();
                    },

                    onError: (error: any) => {
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

                        reject(new OfflineError(`Could not connect: ${error.message}`));
                    },

                    onMessage: (data: string) => {
                        this.onMessage(data);
                    },
                });
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

            const clientProgressStack = ClientProgress.fork();

            const types = await this.getActionTypes(controller, name, timeoutInSeconds);

            for (const i of eachKey(args)) {
                args[i] = jsonSerializer.serializeProperty(types.parameters[i], args[i]);
            }

            const activeSubject = this.sendMessage<ServerMessageResult>({
                name: 'action',
                controller: controller,
                action: name,
                args: args,
                timeout: timeoutInSeconds,
            }, {
                timeout: timeoutInSeconds,
                progressable: true,
                clientProgressStack,
            });

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

            options = options || {};
            handleActiveSubject(activeSubject, resolve, reject, controller, name, this.entityState, options);
        });
    }

    protected send(message: ClientMessageAll) {
        if (this.transportConnection === undefined) {
            throw new Error('Transport connection not created yet');
        }

        try {
            this.transportConnection.send(message);
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
            clientProgressStack?: ClientProgressStack
        }
    ): MessageSubject<K> {
        this.messageId++;

        if (options && options.progressable && options.clientProgressStack) {
            if (options.clientProgressStack.downloadProgress.length) {
                this.batcher.registerProgress(this.messageId, options.clientProgressStack.downloadProgress);
            }
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
            token: this.authToken,
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

    protected onDisconnect() {
        this.entityState.clear();
        this.registeredControllers = {};
        this.cachedActionsTypes = {};
    }

    public disconnect() {
        this.onDisconnect();

        this.connected = false;
        this.loggedIn = false;

        this.disconnected.next(this.currentConnectionId);

        this.currentConnectionId++;
        this.connection.next(false);

        if (this.transportConnection) {
            this.transportConnection.disconnect();
        }
    }
}
