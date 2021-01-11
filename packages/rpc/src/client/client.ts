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
import { RpcMessageWriter, ClientProgress, Progress, SingleProgress } from '../writer';
import { ControllerDefinition, rpcAuthenticate, rpcClientId, rpcPeerDeregister, rpcPeerRegister, rpcResponseAuthenticate, RpcTypes } from '../model';
import {
    createRpcMessage,
    createRpcMessagePeer,
    ErroredRpcMessage,
    readRpcMessage,
    RpcMessage,
    RpcMessageReader,
    RpcMessageRouteType
} from '../protocol';
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
export type RemoteController<T> = {
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
    protected writer?: RpcMessageWriter;

    public id?: Uint8Array;

    /**
     * true when the connection fully established (after authentication)
     */
    public readonly connection = new BehaviorSubject<boolean>(false);
    public readonly reconnected = new Subject<number>();
    public readonly disconnected = new Subject<number>();

    public reader = new RpcMessageReader(
        (v) => this.onMessage(v),
        (id) => {
            if (this.writer) {
                this.writer.write(createRpcMessage(id, RpcTypes.ChunkAck));
            }
        }
    );

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
        this.connectionPromise = undefined;

        if (this.connected) {
            this.connectionId++;
            this.connection.next(false);
            this.disconnected.next(this.connectionId);
            this.connected = false;
        }
    }

    protected onConnect() {
        this.connection.next(true);
        if (this.connectionId > 0) {
            this.reconnected.next(this.connectionId);
        }
    }

    /**
     * Optional handshake. 
     * When peer messages are allowed, this needs to request the client id and returns id.
     */
    public async onHandshake(): Promise<Uint8Array | undefined> {
        return undefined;
    }

    public async onAuthenticate(): Promise<boolean> {
        return true;
    }

    public onMessage(message: RpcMessage) {
    }

    public disconnect() {
        if (this.transportConnection) {
            this.transportConnection.disconnect();
            this.transportConnection = undefined;
        }
        this.onDisconnect();
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
                        this.writer = new RpcMessageWriter({ write(v) { transport.send(v) } }, this.reader);

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
                        this.reader.feed(buffer);
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

    public send(message: Uint8Array, progress?: SingleProgress) {
        if (this.writer === undefined) {
            throw new Error('Transport connection not created yet');
        }

        try {
            this.writer.write(message, progress);
        } catch (error) {
            throw new OfflineError(error);
        }
    }
}

export class RpcClientPeer {
    constructor(
        protected actionClient: RpcActionClient,
        protected peerId: string,
        protected onDisconnect: (peerId: string) => void,
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
        this.onDisconnect(this.peerId);
    }
}

export class RpcBaseClient {
    protected messageId: number = 1;
    protected replies = new Map<number, ((message: RpcMessage) => void)>();

    protected actionClient = new RpcActionClient(this);
    public readonly token = new RpcClientToken;
    protected transporter: RpcClientTransporter;

    public username?: string;

    constructor(
        protected transport: ClientTransportAdapter
    ) {
        this.transporter = new RpcClientTransporter(this.transport);
        this.transporter.onMessage = this.onMessage.bind(this);
        this.transporter.onHandshake = this.onHandshake.bind(this);
        this.transporter.onAuthenticate = this.onAuthenticate.bind(this);
    }

    /**
     * The connection process is only finished when this method returns a boolean.
     * If false is returned an authentication error is thrown.
     * 
     * Use this.sendMessage(type, schema, body, {dontWaitForConnection: true}) during handshake.
     */
    protected async onAuthenticate(): Promise<boolean> {
        if (!this.token.has()) return true;

        const reply = await this.sendMessage(RpcTypes.Authenticate, rpcAuthenticate, { token: this.token.get()! }, { dontWaitForConnection: true })
            .waitNextMessage();

        if (reply.isError()) return false;

        if (reply.type === RpcTypes.AuthenticateResponse) {
            const body = reply.parseBody(rpcResponseAuthenticate);
            this.username = body.username;
            return true;
        }

        return false;
    }


    /**
     * Use this.sendMessage(type, schema, body, {dontWaitForConnection: true}) during handshake.
     */
    protected async onHandshake(): Promise<Uint8Array | undefined> {
        return undefined;
    }

    public getId(): Uint8Array {
        throw new Error('RpcBaseClient does not load its client id, and thus does not support peer message');
    }

    protected onMessage(message: RpcMessage) {
        // console.log('client: received message', message.id, message.type, RpcTypes[message.type], message.routeType);

        if (message.type === RpcTypes.Entity) {
            this.actionClient.entityState.handle(message);
        } else {
            const callback = this.replies.get(message.id);
            if (callback) callback(message);
        }
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
        };

        const subject = new RpcMessageSubject(continuation, () => {
            this.replies.delete(id);
        });

        this.replies.set(id, (v: RpcMessage) => subject.next(v));

        const progress = ClientProgress.getNext();
        if (progress) {
            this.transporter.reader.registerProgress(id, progress.download);
        }

        if (dontWaitForConnection || this.transporter.isConnected()) {
            const message = options && options.peerId
                ? createRpcMessagePeer(id, type, this.getId(), options.peerId, schema, body)
                : createRpcMessage(id, type, schema, body);
            this.transporter.send(message, progress?.upload);
        } else {
            this.transporter.connect().then(
                () => {
                    //this.getId() only now available
                    const message = options && options.peerId
                        ? createRpcMessagePeer(id, type, this.getId(), options.peerId, schema, body)
                        : createRpcMessage(id, type, schema, body);

                    this.transporter.send(message, progress?.upload);
                },
                (e) => {
                    subject.next(new ErroredRpcMessage(id, e));
                }
            );
        }

        return subject;
    }

    async connect(): Promise<this> {
        await this.transporter.connect();
        return this;
    }

    disconnect() {
        this.transporter.disconnect();
    }
}

export class RpcClient extends RpcBaseClient {
    protected registeredAsPeer?: string;
    protected kernel?: RpcKernel;
    protected peerConnections = new Map<string, RpcClientPeer>();

    protected async onHandshake(): Promise<Uint8Array> {
        const reply = await this.sendMessage(RpcTypes.ClientId, undefined, undefined, { dontWaitForConnection: true })
            .firstThenClose(RpcTypes.ClientIdResponse, rpcClientId);
        return reply.id;
    }

    protected peerKernelConnection = new Map<string, any>();

    protected onMessage(message: RpcMessage) {
        if (message.routeType === RpcMessageRouteType.peer) {
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
                connection.myPeerId = peerId; //necessary so that the kernel does not redirect the package again.
                this.peerKernelConnection.set(peerId, connection);
            }

            connection.feed(message.buffer);
        } else {
            super.onMessage(message);
        }
    }

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

    /**
     * Creates a new peer connection, or re-uses an existing non-disconnected one.
     * 
     * Make sure to call disconnect() on it once you're done using it, otherwise the peer
     * will leak memory. (connection will be dropped if idle for too long automatically tough)
     */
    public peer(peerId: string): RpcClientPeer {
        let peer = this.peerConnections.get(peerId);
        if (peer) return peer;
        peer = new RpcClientPeer(this.actionClient, peerId, () => {
            //todo, send disconnect message so the peer can release its kernel connection
            // also implement a timeout on peer side
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

}
