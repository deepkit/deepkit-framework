/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation, ClassType, sleep } from '@deepkit/core';
import { ClassSchema } from '@deepkit/type';
import { BehaviorSubject, Subject } from 'rxjs';
import { ControllerDefinition, rpcAuthenticate, rpcClientId, rpcPeerDeregister, rpcPeerRegister, rpcResponseAuthenticate, RpcTypes } from '../model';
import { createRpcMessage, createRpcMessagePeer, ErroredRpcMessage, RpcMessage, RpcMessageReader, RpcMessageRouteType } from '../protocol';
import { RpcKernel, RpcKernelConnection } from '../server/kernel';
import { ClientProgress, RpcMessageWriter, SingleProgress } from '../writer';
import { RpcActionClient, RpcControllerState } from './action';
import { RpcMessageSubject } from './message-subject';

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

    bufferedAmount?(): number;

    clientAddress?(): string;

    close(): void;
}

export interface TransportConnectionHooks {
    onConnected(transportConnection: TransportConnection): void;

    onClose(): void;

    onData(buffer: Uint8Array, bytes?: number): void;

    onError(error: any): void;
}

export interface ClientTransportAdapter {
    connect(connection: TransportConnectionHooks): Promise<void> | void;
}

export interface WritableClient {
    sendMessage<T>(
        type: number,
        schema?: ClassSchema<T>,
        body?: T,
        options?: {
            dontWaitForConnection?: boolean,
            connectionId?: number,
            peerId?: string,
            timeout?: number
        }
    ): RpcMessageSubject;
}

export class RpcClientToken {
    constructor(protected token: any) {
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

    bufferedAmount(): number {
        if (!this.transportConnection?.bufferedAmount) return 0;
        return this.transportConnection.bufferedAmount();
    }

    clientAddress(): string {
        if (!this.transportConnection?.clientAddress) return 'unknown';
        return this.transportConnection.clientAddress();
    }

    /**
     * True when fully connected (after successful handshake and authentication)
     */
    public isConnected(): boolean {
        return this.connected;
    }

    protected onError() {
        this.onDisconnect();
    }

    protected onDisconnect() {
        this.id = undefined;
        this.connectionPromise = undefined;

        if (this.connected) {
            this.connection.next(false);
            this.disconnected.next(this.connectionId);
            this.connectionId++;
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

    public async onAuthenticate(): Promise<void> {
    }

    public onMessage(message: RpcMessage) {
    }

    public disconnect() {
        if (this.transportConnection) {
            this.transportConnection.close();
            this.transportConnection = undefined;
        }
        this.onDisconnect();
    }

    protected async doConnect(): Promise<void> {
        this.connectionTries++;

        if (this.transportConnection) {
            this.transportConnection.close();
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
                        this.writer = new RpcMessageWriter({
                            write(v) {
                                transport.send(v);
                            },
                            close() {
                                transport.close();
                            },
                            clientAddress: transport.clientAddress ? () => transport.clientAddress!() : undefined,
                            bufferedAmount: transport.bufferedAmount ? () => transport.bufferedAmount!() : undefined,
                        }, this.reader);

                        this.connected = false;
                        this.connectionTries = 0;

                        try {
                            this.id = await this.onHandshake();
                            await this.onAuthenticate();
                        } catch (error) {
                            this.connected = false;
                            this.connectionTries = 0;
                            reject(error);
                            return;
                        }

                        this.connected = true;
                        this.onConnect();
                        resolve(undefined);
                    },

                    onError: (error: any) => {
                        this.onError();
                        reject(new OfflineError(`Could not connect: ${error.message}`));
                    },

                    onData: (buffer: Uint8Array, bytes?: number) => {
                        this.reader.feed(buffer, bytes);
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
            await this.connectionPromise;
            await sleep(0.01);
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

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, options: { timeout?: number, dontWaitForConnection?: true } = {}): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);
        controller.peerId = this.peerId;

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return this.actionClient.action(controller, propertyName as string, args, options);
                };
            }
        }) as any as RemoteController<T>;
    }

    disconnect() {
        this.onDisconnect(this.peerId);
    }
}

export class RpcBaseClient implements WritableClient {
    protected messageId: number = 1;
    protected replies = new Map<number, ((message: RpcMessage) => void)>();

    protected actionClient = new RpcActionClient(this);
    public readonly token = new RpcClientToken(undefined);
    public readonly transporter: RpcClientTransporter;

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
     * The connection process is only finished when this method resolves and doesn't throw.
     * When an error is thrown, the authentication was unsuccessful.
     *
     * If you use controllers in this callback, make sure to use dontWaitForConnection=true, otherwise you get an endless loop.
     *
     * ```typescript
     * async onAuthenticate(): Promise<void> {
     *     const auth = this.controller<AuthController>('auth', {dontWaitForConnection: true});
     *     const result = auth.login('username', 'password');
     *     if (!result) throw new AuthenticationError('Authentication failed);
     * }
     * ```
     */
    protected async onAuthenticate(): Promise<void> {
        if (!this.token.has()) return;

        const reply = await this.sendMessage(RpcTypes.Authenticate, rpcAuthenticate, { token: this.token.get()! }, {dontWaitForConnection: true})
            .waitNextMessage();

        if (reply.isError()) throw reply.getError();

        if (reply.type === RpcTypes.AuthenticateResponse) {
            const body = reply.parseBody(rpcResponseAuthenticate);
            this.username = body.username;
            return;
        }

        throw new Error('Invalid response');
    }

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
            if (!callback) {
                throw new Error('No callback for ' + message.id);
            }
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
        const dontWaitForConnection = !!options.dontWaitForConnection;
        // const timeout = options && options.timeout ? options.timeout : 0;

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

    /**
     * For server->client (us) communication.
     * This is automatically created when registerController is called.
     * Set this property earlier to work with a custom RpcKernel.
     */
    public clientKernel?: RpcKernel;

    /**
     * Once the server starts actively with first RPC action for the client,
     * a RPC connection is created.
     */
    protected clientKernelConnection?: RpcKernelConnection;

    /**
     * For peer->client(us) communication.
     * This is automatically created when registerAsPeer is called.
     * Set this property earlier to work with a custom RpcKernel.
     */
    public peerKernel?: RpcKernel;

    protected peerConnections = new Map<string, RpcClientPeer>();

    protected async onHandshake(): Promise<Uint8Array> {
        this.clientKernelConnection = undefined;

        const reply = await this.sendMessage(RpcTypes.ClientId, undefined, undefined, {dontWaitForConnection: true})
            .firstThenClose(RpcTypes.ClientIdResponse, rpcClientId);
        return reply.id;
    }

    protected peerKernelConnection = new Map<string, RpcKernelConnection>();

    public async ping(): Promise<void> {
        await this.sendMessage(RpcTypes.Ping).waitNext(RpcTypes.Pong);
    }

    protected onMessage(message: RpcMessage) {
        if (message.routeType === RpcMessageRouteType.peer) {
            if (!this.peerKernel) return;

            const peerId = message.getPeerId();
            if (this.registeredAsPeer !== peerId) return;

            let connection = this.peerKernelConnection.get(peerId);
            if (!connection) {
                //todo: create a connection per message.getSource()
                const writer = {
                    close: () => {
                        if (connection) connection.close();
                        this.peerKernelConnection.delete(peerId);
                    },
                    write: (answer: Uint8Array) => {
                        //should we modify the package?
                        this.transporter.send(answer);
                    }
                };

                //todo: set up timeout for idle detection. Make the timeout configurable

                const c = this.peerKernel.createConnection(writer);
                if (!(c instanceof RpcKernelConnection)) throw new Error('Expected RpcKernelConnection from peerKernel.createConnection');
                connection = c;
                connection.myPeerId = peerId; //necessary so that the kernel does not redirect the package again.
                this.peerKernelConnection.set(peerId, connection);
            }

            connection.handleMessage(message);
        } else {
            if (message.routeType === RpcMessageRouteType.server && this.clientKernel) {
                if (!this.clientKernelConnection) {
                    const c = this.clientKernel.createConnection({
                        write: (answer: Uint8Array) => {
                            this.transporter.send(answer);
                        },
                        close: () => {
                            this.transporter.disconnect();
                        },
                        clientAddress: () => {
                            return this.transporter.clientAddress();
                        },
                        bufferedAmount: () => {
                            return this.transporter.bufferedAmount();
                        }
                    });
                    if (!(c instanceof RpcKernelConnection)) throw new Error('Expected RpcKernelConnection from clientKernel.createConnection');
                    this.clientKernelConnection = c;
                }
                this.clientKernelConnection.routeType = RpcMessageRouteType.server;
                this.clientKernelConnection.handleMessage(message);
                return;
            }
            super.onMessage(message);
        }
    }

    public getId(): Uint8Array {
        if (!this.transporter.id) throw new Error('Not fully connected yet');
        return this.transporter.id;
    }

    /**
     * Registers a new controller for the peer's RPC kernel.
     * Use `registerAsPeer` first.
     */
    public registerPeerController<T>(nameOrDefinition: string | ControllerDefinition<T>, classType: ClassType<T>) {
        if (!this.peerKernel) throw new Error('Not registered as peer. Call registerAsPeer() first');
        this.peerKernel.registerController('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path, classType);
    }

    /**
     * Registers a new controller for the server's RPC kernel.
     * This is when the server wants to communicate actively with the client (us).
     */
    public registerController<T>(nameOrDefinition: string | ControllerDefinition<T>, classType: ClassType<T>) {
        if (!this.clientKernel) this.clientKernel = new RpcKernel();
        this.clientKernel.registerController('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path, classType);
    }

    public async registerAsPeer(id: string) {
        if (this.registeredAsPeer) {
            throw new Error('Already registered as a peer');
        }

        this.peerKernel = new RpcKernel();

        await this.sendMessage(RpcTypes.PeerRegister, rpcPeerRegister, { id }).firstThenClose(RpcTypes.Ack);
        this.registeredAsPeer = id;

        return {
            deregister: async () => {
                await this.sendMessage(RpcTypes.PeerDeregister, rpcPeerDeregister, { id }).firstThenClose(RpcTypes.Ack);
                this.registeredAsPeer = undefined;
            }
        };
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

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, options: { timeout?: number, dontWaitForConnection?: true } = {}): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return this.actionClient.action(controller, propertyName as string, args, options);
                };
            }
        }) as any as RemoteController<T>;
    }

}
