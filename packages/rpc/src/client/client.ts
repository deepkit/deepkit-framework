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

import { asyncOperation, ClassType, sleep } from '@deepkit/core';
import { ClassSchema } from '@deepkit/type';
import { BehaviorSubject, Subject } from 'rxjs';
import { ControllerDefinition, rpcClientId, rpcPeerDeregister, rpcPeerRegister, RpcTypes } from '../model';
import { createRpcMessage, createRpcMessagePeer, ErroredRpcMessage, readRpcMessage, RpcMessage, RpcMessageRouteType } from '../protocol';
import { RpcKernel } from '../server/kernel';
import { RpcActionClient, RpcControllerState } from './action';
import { RpcMessageSubject } from './message-subject';

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

type PromisifyFn<T extends ((...args: any[]) => any)> = (...args: Parameters<T>) => ReturnType<T> extends Promise<any> ? ReturnType<T> : Promise<ReturnType<T>>;
type RemoteController<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any ? PromisifyFn<T[P]> : never
};

export interface TransportConnection {
    send(message: Uint8Array): void;

    disconnect(): void;
}

export interface TransportConnectionHooks {
    onConnected(transportConnection: TransportConnection): void;

    onClose(): void;

    onMessage(buffer: Uint8Array): void;

    onError(error: any): void;
}

export interface ClientTransportAdapter {
    connect(connection: TransportConnectionHooks): Promise<void> | void;
}

export class RpcClientToken {
    constructor(protected token?: string) {
    }

    get() {
        return this.token;
    }

    set(v: any) {
        this.token = v;
    }

    has() {
        return this.token !== undefined;
    }
}

export class RpcClientTransporter {
    protected connectionTries: number = 0;
    public connectionId: number = 0;
    protected transportConnection?: TransportConnection;
    protected connectionPromise?: Promise<void>;

    protected connected = false;
    protected authenticated = false;

    public id?: Uint8Array;

    /**
     * true when the connection fully established (after authentication)
     */
    public readonly connection = new BehaviorSubject<boolean>(false);
    public readonly reconnect = new Subject<number>();
    public readonly disconnect = new Subject<number>();

    public constructor(
        public transport: ClientTransportAdapter,
    ) {
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public isAuthenticated(): boolean {
        return this.authenticated;
    }

    protected onError() {
        this.onDisconnect();
    }

    protected onDisconnect() {
        this.authenticated = false;
        this.id = undefined;

        if (this.connected) {
            this.connectionId++;
            this.connection.next(false);
            this.disconnect.next(this.connectionId);
            this.connected = false;
        }
    }

    protected onConnect() {
        this.connection.next(true);
        if (this.connectionId > 0) {
            this.reconnect.next(this.connectionId);
        }
    }

    public async onHandshake(): Promise<Uint8Array> {
        throw new Error('No handshake implemented');
    }

    public async onAuthenticate(): Promise<boolean> {
        return false;
    }

    public onMessage(buffer: Uint8Array) {
    }

    protected async doConnect(): Promise<void> {
        this.connectionTries++;

        if (this.transportConnection) {
            this.transportConnection.disconnect();
            this.transportConnection = undefined;
        }

        return asyncOperation<void>(async (resolve, reject) => {
            try {
                await this.transport.connect({
                    onClose: () => {
                        this.onDisconnect();
                    },

                    onConnected: async (transport: TransportConnection) => {
                        this.transportConnection = transport;
                        //it's important to place it here, since authenticate() sends messages and checks this.connected.
                        this.connected = true;
                        this.connectionTries = 0;

                        this.id = await this.onHandshake();

                        if (!await this.onAuthenticate()) {
                            this.connected = false;
                            this.connectionTries = 0;
                            reject(new AuthenticationError());
                            return;
                        }

                        this.onConnect();
                        resolve(undefined);
                    },

                    onError: (error: any) => {
                        this.onError();
                        reject(new OfflineError(`Could not connect: ${error.message}`));
                    },

                    onMessage: (buffer: Uint8Array) => {
                        this.onMessage(buffer);
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

        if (this.connection.value && this.id) {
            return;
        }

        this.connectionPromise = this.doConnect();

        try {
            await this.connectionPromise;
        } finally {
            delete this.connectionPromise;
        }
    }

    public send(message: Uint8Array) {
        if (this.transportConnection === undefined) {
            throw new Error('Transport connection not created yet');
        }

        try {
            this.transportConnection.send(message);
        } catch (error) {
            throw new OfflineError(error);
        }
    }
}

export class RpcClientPeer {
    constructor(
        protected actionClient: RpcActionClient,
        protected peerId: string,
        protected onDisonnect: (peerId: string) => void,
    ) {

    }

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, timeoutInSeconds = 60): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);
        controller.peerId = this.peerId;

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return this.actionClient.action(controller, propertyName as string, args);
                };
            }
        }) as any as RemoteController<T>;
    }

    disconnect() {
        this.onDisonnect(this.peerId);
    }
}

export class RpcClient {
    protected messageId: number = 1;
    protected replies = new Map<number, ((message: RpcMessage) => void)>();

    protected actionClient = new RpcActionClient(this);
    public readonly token = new RpcClientToken;
    protected transporter: RpcClientTransporter;

    constructor(
        protected transport: ClientTransportAdapter
    ) {
        this.transporter = new RpcClientTransporter(this.transport);
        this.transporter.onMessage = this.onMessage.bind(this);
        this.transporter.onAuthenticate = this.onAuthenticate.bind(this);
        this.transporter.onHandshake = this.onHandshake.bind(this);
    }

    protected async onHandshake(): Promise<Uint8Array> {
        const reply = await this.sendMessage(RpcTypes.ClientId, undefined, undefined, { dontWaitForConnection: true })
            .firstThenClose(RpcTypes.ClientIdResponse, rpcClientId);
        return reply.id;
    }

    protected async onAuthenticate(): Promise<boolean> {
        if (!this.token.has()) return true;

        // const reply = await this.sendMessage(RpcTypes.Authenticate, rpcAuthenticate, { token: this.token.get()! }, { dontWaitForConnection: true })
        //     .firstThenClose();

        // console.log('authenticate reply', reply);

        // if (reply.type === 'authenticate/result') {
        //     // this.loggedIn = reply.result;
        // }
        //
        // if (reply.type === 'error') {
        //     throw new Error('Authentication error. ' + reply.error);
        // }

        return false;
    }

    protected peerKernelConnection = new Map<string, any>();

    protected onMessage(buffer: Uint8Array) {
        const message = readRpcMessage(buffer);
        // console.log('client: received message', message.id, RpcTypes[message.type], message.routeType);

        if (message.type === RpcTypes.Chunk) {
            //package, wait until complete. retrieve everything, then unpack, and call onMessage() again
        } else if (message.routeType === RpcMessageRouteType.peer) {
            if (!this.kernel) return;

            const peerId = message.getPeerId();
            if (this.registeredAsPeer !== peerId) return;

            let connection = this.peerKernelConnection.get(peerId);
            if (!connection) {
                //todo: create a connection per message.getSource()
                const writer = {
                    write: (answer: Uint8Array) => {
                        //should we modify the package?
                        this.transporter.send(answer);
                    }
                };

                //todo: set up timeout for idle detection. Make the timeout configurable

                connection = this.kernel.createConnection(writer);
                connection.myPeerId = peerId; //necesary so that the kernel does not redirect the package again.
                this.peerKernelConnection.set(peerId, connection);
            }

            connection.handleMessage(buffer);
        } else {
            const callback = this.replies.get(message.id);
            if (callback) callback(message);
        }
    }

    protected registeredAsPeer?: string;
    protected kernel?: RpcKernel;

    public getId(): Uint8Array {
        if (!this.transporter.id) throw new Error('Not fully connected yet');
        return this.transporter.id;
    }

    public registerController<T>(nameOrDefinition: string | ControllerDefinition<T>, classType: ClassType<T>) {
        if (!this.kernel) throw new Error('Not registered as peer. Call registerAsPeer() first');
        this.kernel.registerController('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path, classType);
    }

    public async registerAsPeer(id: string) {
        if (this.registeredAsPeer) {
            throw new Error('Already registered as a peer');
        }

        this.kernel = new RpcKernel();

        await this.sendMessage(RpcTypes.PeerRegister, rpcPeerRegister, { id }).firstThenClose(RpcTypes.Ack);
        this.registeredAsPeer = id;

        return {
            deregister: async () => {
                await this.sendMessage(RpcTypes.PeerDeregister, rpcPeerDeregister, { id }).firstThenClose(RpcTypes.Ack);
                this.registeredAsPeer = undefined;
            }
        }
    }

    protected peerConnections = new Map<string, RpcClientPeer>();

    /**
     * Creates a new peer connection, or re-uses an existing non-disconnected one.
     * 
     * Make sure to call disconnect() on it once you're done using it, otherwise the peer
     * will leak a memory from you. (connection will be dropped if idle for too long automatically tough)
     */
    public peer(peerId: string): RpcClientPeer {
        let peer = this.peerConnections.get(peerId);
        if (peer) return peer;
        peer = new RpcClientPeer(this.actionClient, peerId, () => {
            //todo, send disconnect message so the peer can release its kernel connection
            this.peerConnections.delete(peerId);
        });
        this.peerConnections.set(peerId, peer);
        return peer;
    }

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, timeoutInSeconds = 60): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return this.actionClient.action(controller, propertyName as string, args);
                };
            }
        }) as any as RemoteController<T>;
    }

    public sendMessage<T>(
        type: number,
        schema?: ClassSchema<T>,
        body?: T,
        options: {
            dontWaitForConnection?: boolean,
            connectionId?: number,
            peerId?: string,
            timeout?: number
        } = {}
    ): RpcMessageSubject {
        const id = this.messageId++;
        const connectionId = options && options.connectionId ? options.connectionId : this.transporter.connectionId;
        const dontWaitForConnection = !!(options && options.dontWaitForConnection);
        const timeout = options && options.timeout ? options.timeout : 0;

        const continuation = <T>(type: number, schema?: ClassSchema<T>, body?: T) => {
            if (connectionId === this.transporter.connectionId) {
                //send a message with the same id. Don't use sendMessage() again as this would lead to a memory leak
                // and a new id generated. We want to use the same id.
                const message = createRpcMessage(id, type, schema, body);
                this.transporter.send(message);
            }

            // const nextSubject: RpcMessageSubject = new RpcMessageSubject(continuation);
            // nextSubject.error(new Error('Connection used in this message subject dropped meanwhile'));

            // return nextSubject;
        };

        // let timer: any;
        // if (timeout) {
        //     timer = setTimeout(() => {
        //         if (!subject.isStopped) {
        //             subject.error('Server timed out after ' + timeout + 'seconds');
        //         }
        //     }, timeout * 1000);
        // }

        // const sub = this.transporter.disconnect.subscribe((disconnectedConnectionId: number) => {
        //     if (disconnectedConnectionId === connectionId) {
        //         if (!subject.isStopped) {
        //             subject.error(new OfflineError);
        //         }
        //     }
        // });

        const subject = new RpcMessageSubject(continuation, () => {
            this.replies.delete(id);
        });

        this.replies.set(id, (v: RpcMessage) => subject.next(v));

        // this.replies.set(id, (message) => {
        // if (!subject.isStopped) {
        //     subject.next(new RpcMessageSubjectReply(message));
        // }
        // });

        // const subjectClosed = () => {
        //     clearTimeout(timer);
        //     this.replies.delete(id);
        //     // if (!sub.closed) sub.unsubscribe();
        // };

        // subject.subscribe({
        //     next: () => clearTimeout(timer),
        //     complete: subjectClosed,
        //     error: subjectClosed
        // }).add(subjectClosed);

        if (dontWaitForConnection || this.transporter.isConnected()) {
            const message = options && options.peerId
                ? createRpcMessagePeer(id, type, this.getId(), options.peerId, schema, body)
                : createRpcMessage(id, type, schema, body);
            this.transporter.send(message);
        } else {
            this.transporter.connect().then(
                () => {
                    //this.getId() only now available
                    const message = options && options.peerId
                        ? createRpcMessagePeer(id, type, this.getId(), options.peerId, schema, body)
                        : createRpcMessage(id, type, schema, body);

                    this.transporter.send(message);
                },
                (e) => subject.next(new ErroredRpcMessage(id, e))
            );
        }

        return subject;
    }

    async connect(): Promise<this> {
        await this.transporter.connect();
        return this;
    }
}
