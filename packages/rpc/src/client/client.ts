/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation, CustomError, formatError, sleep } from '@deepkit/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ControllerDefinition, RpcError, RpcStats } from '../model.js';
import { ContextDispatcher, getBodyOffset, getContextId, hasContext, isRouteFlag, isTypeFlag, MessageFlag, setRouteFlag } from '../protocol.js';
import { RpcKernel, RpcKernelConnection } from '../server/kernel.js';
import { SingleProgress } from '../progress.js';
import { TransportClientConnection, TransportConnection, TransportOptions } from '../transport.js';
import { RpcActionClient, RpcControllerState } from './action.js';
import { writeUint32LE } from '@deepkit/bson';
import { ParsedSchemaMapping, schemaMapping, SchemaMapping } from '../encoders.js';
import { assertType, deserializeType, ReflectionKind } from '@deepkit/type';

export class OfflineError extends CustomError {
}

type PromisifyFn<T extends ((...args: any[]) => any)> = (...args: Parameters<T>) => ReturnType<T> extends Promise<any> ? ReturnType<T> : Promise<ReturnType<T>>;
export type RemoteController<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any ? PromisifyFn<T[P]> : never
};

export interface ClientTransportAdapter {
    connect(connection: TransportClientConnection): Promise<void> | void;

    /**
     * Whether Authentication call is needed to authenticate the client.
     * This is disabled for http adapter (Authorization header is used).
     */
    supportsAuthentication?(): boolean;
}

export interface WritableClient {
    clientStats: RpcStats;

    write(message: Uint8Array): void;

    getSchemaMapping(): ParsedSchemaMapping | undefined;

    loadSchemaMapping(): Promise<ParsedSchemaMapping>;

    // sendMessage<T>(
    //     type: number,
    //     body?: T,
    //     bodyEncoder?: BodyEncoder<T>,
    //     options?: {
    //         dontWaitForConnection?: boolean,
    //         connectionId?: number,
    //         timeout?: number
    //     },
    // ): RpcMessageSubject;
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
    public writerOptions: TransportOptions = new TransportOptions();

    /**
     * When the connection is established (including handshake and authentication).
     */
    public readonly connection = new BehaviorSubject<boolean>(false);

    /**
     * When the connection was reconnected. This is not called for the very first connection.
     */
    public readonly reconnected = new Subject<number>();

    /**
     * When the connection was disconnected (due to error or close).
     * This increases the connectionId by one.
     */
    public readonly disconnected = new Subject<number>();

    /**
     * Triggered for any onError call from the transporter.
     * Right after this event, onDisconnect is called (and thus connection.next(false) and disconnected.next()).
     */
    public readonly errored = new Subject<{ connectionId: number, error: Error }>();

    // public reader = new RpcBinaryMessageReader(
    //     this.context,
    //     (v) => {
    //         this.stats.increase('incoming', 1);
    //         this.onMessage(v);
    //     },
    //     (message) => {
    //         this.writer!(message, this.writerOptions, this.stats);
    //     },
    // );

    public constructor(
        public transport: ClientTransportAdapter,
        protected stats: RpcStats,
        protected client: RpcClient,
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

    protected onError(error: Error) {
        this.errored.next({ connectionId: this.connectionId, error });
        this.onDisconnect(error);
    }

    protected onDisconnect(error?: Error) {
        this.connectionPromise = undefined;
        if (!this.transportConnection) return;

        this.transportConnection = undefined;
        this.stats.connections--;

        this.connection.next(false);
        this.connected = false;
        this.client.onClose(error);
        const id = this.connectionId;
        this.connectionId++;
        this.disconnected.next(id);
    }

    protected onConnect() {
        this.connection.next(true);
        if (this.connectionId > 0) {
            this.reconnected.next(this.connectionId);
        }
    }

    public async disconnect() {
        // we have to wait for ongoing connection attempts
        while (this.connectionPromise) {
            await this.connectionPromise;
        }

        if (this.transportConnection) {
            this.transportConnection.close();
            this.transportConnection = undefined;
        }
    }

    protected async doConnect(token?: any): Promise<void> {
        this.connectionTries++;

        if (this.transportConnection) {
            this.transportConnection.close();
            this.transportConnection = undefined;
        }

        return asyncOperation<void>(async (resolve, reject) => {
            await this.transport.connect({
                token,

                onClose: () => {
                    this.onDisconnect();
                },

                onConnected: async (transport: TransportConnection) => {
                    this.transportConnection = transport;
                    this.stats.connections++;
                    this.stats.totalConnections++;

                    this.writer = transport.write;
                    // this.writer = createWriter(transport, this.writerOptions, this.reader);

                    this.connected = false;
                    this.connectionTries = 0;

                    try {
                        await this.client.onLoadTypes();
                        await this.client.onHandshake();
                        await this.client.onAuthenticate(token);
                    } catch (error) {
                        this.connected = false;
                        this.connectionTries = 0;
                        this.onError(error instanceof Error ? error : new Error(String(error)));
                        reject(error);
                        return;
                    }

                    this.connected = true;
                    this.onConnect();
                    resolve(undefined);
                },

                onError: (error: Error) => {
                    this.onError(error);
                    reject(new OfflineError(`Could not connect: ${formatError(error)}`, { cause: error }));
                },

                read: (message: Uint8Array) => {
                    this.stats.incoming++;
                    this.client.onMessage(message);
                },
            });
        });
    }

    protected writer(message: Uint8Array): void {
        // this will be overwritten by the transport connection
    }

    /**
     * Simply connect with login using the token, without auto re-connect.
     */
    public async connect(token?: any): Promise<void> {
        while (this.connectionPromise) {
            await this.connectionPromise;
            await sleep(0.01);
        }

        if (this.connected) {
            return;
        }

        this.connectionPromise = this.doConnect(token);

        try {
            await this.connectionPromise;
        } finally {
            this.connectionPromise = undefined;
        }
    }

    public send(message: Uint8Array, progress?: SingleProgress) {
        if (this.writer === undefined) {
            throw new RpcError('Transport connection not created yet');
        }

        // this.writer(message, this.writerOptions, this.stats, progress);
        this.writer(message);
    }
}

// export class RpcClientPeer {
//     // todo this needs its own RpcActionClient
//
//     constructor(
//         protected actionClient: RpcActionClient,
//         protected peerId: string,
//         protected onDisconnect: (peerId: string) => void,
//     ) {
//
//     }
//
//     public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, options: {
//         timeout?: number,
//         dontWaitForConnection?: true
//     } = {}): RemoteController<T> {
//         const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);
//         controller.peerId = this.peerId;
//
//         return new Proxy(this, {
//             //todo: try getOwnPropertyDescriptor to improve performance
//
//             get: (target, propertyName) => {
//                 return this.actionClient.getAction(controller, String(propertyName), options);
//             },
//         }) as any as RemoteController<T>;
//     }
//
//     disconnect() {
//         this.onDisconnect(this.peerId);
//     }
// }

export class RpcClient implements WritableClient {
    public clientStats: RpcStats = new RpcStats;

    public readonly token = new RpcClientToken(undefined);
    public readonly transporter: RpcClientTransporter;

    public username?: string;

    public typeReuseDisabled: boolean = false;

    selfContext = new ContextDispatcher();
    protected remoteContext = new ContextDispatcher();

    protected fastMessage = new Uint8Array(32);

    protected schemaMapping?: SchemaMapping;
    protected schemaMappingParsed?: ParsedSchemaMapping;

    public actionClient = new RpcActionClient(this, this.selfContext);

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

    constructor(
        protected transport: ClientTransportAdapter,
    ) {
        this.transporter = new RpcClientTransporter(this.transport, this.clientStats, this);
    }

    onClose(error?: Error) {
        this.actionClient.disconnect();
        this.schemaMapping = undefined;

        // for (const subject of this.replies.values()) {
        //     subject.disconnect(error);
        // }
        // this.replies.clear();

        if (this.resolveSchema) {
            this.resolveSchema();
            this.resolveSchema = undefined;
        }
    }

    /**
     * Per default entity types with a name (@entity.name()) will be reused. If a entity with a given name
     * was not loaded and error is thrown. This to ensure nominal typing (object instanceof T).
     * Use this method to disable this behavior and construct new nominal types if an entity is not loaded.
     */
    disableTypeReuse(): this {
        this.typeReuseDisabled = true;
        return this;
    }

    /**
     * The connection process is only finished when this method resolves and doesn't throw.
     * When an error is thrown, the authentication was unsuccessful.
     *
     * If you use controllers in this callback, make sure to use dontWaitForConnection=true, otherwise you get an endless loop.
     *
     * ```typescript
     * async onAuthenticate(token?: any): Promise<void> {
     *     const auth = this.controller<AuthController>('auth', {dontWaitForConnection: true});
     *     const result = auth.login('username', 'password');
     *     if (!result) throw new AuthenticationError('Authentication failed);
     * }
     * ```
     */
    async onAuthenticate(token?: any): Promise<void> {
        // if (undefined === token) return;
        // // if (this.transport.supportsPeers && !this.transport.supportsPeers()) return;
        //
        // const id = this.context.create((message: Uint8Array) => {
        //     this.context.release(id);
        // });
        //
        // const authEncoder = createBodyEncoder<rpcAuthenticate>();
        //
        // this.send(RpcAction.Authenticate);
        //
        // const reply: RpcMessage = await this.sendMessage<rpcAuthenticate>(RpcAction.Authenticate, { token }, undefined, { dontWaitForConnection: true })
        //     .waitNextMessage();
        //
        // if (reply.isError()) throw reply.getError();
        //
        // if (reply.type === RpcAction.AuthenticateResponse) {
        //     const body = reply.parseBody<rpcResponseAuthenticate>();
        //     this.username = body.username;
        //     return;
        // }
        //
        // throw new RpcError('Invalid response');
    }

    onLoadTypes(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.resolveSchema = resolve;
            this.fastMessage[0] = MessageFlag.RouteClient | MessageFlag.TypeSchema;
            const bodyOffset = getBodyOffset(this.fastMessage);
            const hash = 0;
            writeUint32LE(this.fastMessage, bodyOffset, hash);
            this.transporter.send(this.fastMessage.subarray(0, bodyOffset + 4));
        });
    }

    protected resolveSchema?: () => void;

    async onHandshake(): Promise<void> {
    }

    public getId(): Uint8Array {
        throw new RpcError('RpcBaseClient does not load its client id, and thus does not support peer message');
    }

    onMessage(message: Uint8Array) {
        // console.log('RpcClient.onMessage', debugMessage(message), !!this.resolveSchema);
        if (this.resolveSchema) {
            if (isTypeFlag(message[0], MessageFlag.TypeSchema)) {
                const bodyOffset = getBodyOffset(message);
                this.schemaMapping = schemaMapping.decode(message, bodyOffset);
                this.schemaMappingParsed = {};
                for (const controllerName in this.schemaMapping) {
                    this.schemaMappingParsed[controllerName] = {};
                    const controller = this.schemaMappingParsed[controllerName];
                    for (const action of this.schemaMapping[controllerName]) {
                        const [actionName, actionId, mode, parameters, type] = action;
                        const parametersParsed = deserializeType(parameters);
                        assertType(parametersParsed, ReflectionKind.tuple);
                        const typeParsed = deserializeType(type);

                        controller[actionName] = {
                            action: actionId,
                            mode,
                            parameters: parametersParsed,
                            type: typeParsed,
                        };
                    }
                }
            }

            this.resolveSchema();
            this.resolveSchema = undefined;
            return;
        }

        if (isRouteFlag(message[0], MessageFlag.RouteDirect)) {
            if (!this.peerKernel) return;

            // const peerId = message.getPeerId();
            // if (this.registeredAsPeer !== peerId) return;
            //
            // let connection = this.peerKernelConnection.get(peerId);
            // if (!connection) {
            //     //todo: create a connection per message.getSource()
            //     const writer = {
            //         close: () => {
            //             if (connection) connection.close();
            //             this.peerKernelConnection.delete(peerId);
            //         },
            //         write: (answer: Uint8Array) => {
            //             replyRoute(answer);
            //             // should we modify the package?
            //             this.transporter.send(answer);
            //         },
            //     };
            //
            //     //todo: set up timeout for idle detection. Make the timeout configurable
            //
            //     const c = this.peerKernel.createConnection(writer);
            //     if (!(c instanceof RpcKernelConnection)) throw new RpcError('Expected RpcKernelConnection from peerKernel.createConnection');
            //     connection = c;
            //     connection.myPeerId = peerId; //necessary so that the kernel does not redirect the package again.
            //     this.peerKernelConnection.set(peerId, connection);
            // }
            // connection.handleMessage(message);
        } else if (isRouteFlag(message[0], MessageFlag.RouteServer)) {
            if (!this.clientKernel) {
                // this.transporter.send(createErrorMessage(message.contextId, 'RpcClient has no controllers registered'));
                return;
            }
            if (!this.clientKernelConnection) {
                const c = this.clientKernel.createConnection({
                    write: (answer: Uint8Array) => {
                        setRouteFlag(answer, MessageFlag.RouteServer);
                        this.transporter.send(answer);
                    },
                    close: () => {
                        this.transporter.disconnect().catch(() => undefined);
                    },
                    clientAddress: () => {
                        return this.transporter.clientAddress();
                    },
                    bufferedAmount: () => {
                        return this.transporter.bufferedAmount();
                    },
                });
                // Important to disable since transporter.send chunks already,
                // otherwise data is chunked twice and protocol breaks.
                c.transportOptions.chunkSize = 0;
                if (!(c instanceof RpcKernelConnection)) throw new RpcError('Expected RpcKernelConnection from clientKernel.createConnection');
                this.clientKernelConnection = c;
            }
            // this.clientKernelConnection.handleMessage(message);
            return;
        }

        try {
            if (hasContext(message[0])) {
                const contextId = getContextId(message);
                this.selfContext.dispatch(contextId, message);
                return;
            }
        } catch (error) {
            console.log('client.onMessage error', error);
        }

        // console.log('client: received message', message.id, message.type, RpcTypes[message.type], message.routeType);

        // if (message.type === RpcAction.Entity) {
        //     this.actionClient.entityState.handle(message);
        // } else {
        //     const subject = this.replies.get(message.contextId,
        //     );
        //     if (subject) subject.next(message);
        // }
    }

    write(message: Uint8Array) {
        this.transporter.send(message);
    }

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, options: {
        timeout?: number,
        dontWaitForConnection?: true,
        typeReuseDisabled?: boolean
    } = {}): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);

        options = options || {};
        if ('undefined' === typeof options.typeReuseDisabled) {
            options.typeReuseDisabled = this.typeReuseDisabled;
        }

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return target.actionClient.action(controller, propertyName as string, args, options);
                };
            },
        }) as any as RemoteController<T>;
    }

    async connect(): Promise<void> {
        await this.transporter.connect(this.token.get());
    }

    isConnected(): boolean {
        return this.transporter.isConnected();
    }

    getSchemaMapping(): ParsedSchemaMapping | undefined {
        return this.schemaMappingParsed;
    }

    async loadSchemaMapping(): Promise<ParsedSchemaMapping> {
        // connect loads schema mapping automatically
        await this.connect();
        if (!this.schemaMappingParsed) {
            throw new RpcError('Schema mapping not loaded yet');
        }
        return this.schemaMappingParsed;
    }

    async disconnect() {
        await this.transporter.disconnect();
    }
}
