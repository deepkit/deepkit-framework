/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, ClassType, getClassName } from '@deepkit/core';
import { ReceiveType, ReflectionKind, resolveReceiveType, stringifyUuid, Type, typeOf, writeUuid } from '@deepkit/type';
import { RpcMessageSubject } from '../client/message-subject.js';
import {
    AuthenticationError,
    ControllerDefinition,
    rpcAuthenticate,
    rpcClientId,
    rpcError,
    rpcPeerRegister,
    rpcResponseAuthenticate,
    RpcTypes,
} from '../model.js';
import {
    createBuffer,
    createRpcCompositeMessage,
    createRpcCompositeMessageSourceDest,
    createRpcMessage,
    createRpcMessageForBody,
    createRpcMessageSourceDest,
    createRpcMessageSourceDestForBody,
    RpcCreateMessageDef,
    rpcEncodeError,
    RpcMessage,
    RpcMessageReader,
    RpcMessageRouteType,
} from '../protocol.js';
import { RpcMessageWriter, RpcMessageWriterOptions } from '../writer.js';
import { RpcServerAction } from './action.js';
import { RpcKernelSecurity, SessionState } from './security.js';
import { RpcActionClient, RpcControllerState } from '../client/action.js';
import { RemoteController } from '../client/client.js';
import { InjectorContext, InjectorModule, NormalizedProvider } from '@deepkit/injector';
import { Logger, LoggerInterface } from '@deepkit/logger';
import { rpcClass } from '../decorators.js';

const anyType: Type = { kind: ReflectionKind.any };

export class RpcCompositeMessage {
    protected messages: RpcCreateMessageDef<any>[] = [];

    public strictSerialization: boolean = false;
    public logValidationErrors: boolean = false;
    public errorLabel: string = 'Error in serialization';

    constructor(
        protected logger: Logger,
        public type: number,
        protected id: number,
        protected writer: RpcConnectionWriter,
        protected clientId?: Uint8Array,
        protected source?: Uint8Array,
        protected routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
    ) {
    }

    add<T>(type: number, body?: T, receiveType?: ReceiveType<T>): this {
        if (!this.strictSerialization) {
            receiveType = anyType;
        }
        try {
            this.messages.push({ type, schema: receiveType ? resolveReceiveType(receiveType) : undefined, body });
            return this;
        } catch (error) {
            if (this.logValidationErrors) {
                this.logger.warn(this.errorLabel, error);
            }
            throw error;
        }
    }

    send() {
        if (this.clientId && this.source) {
            //we route back accordingly
            this.writer.write(createRpcCompositeMessageSourceDest(this.id, this.clientId, this.source, this.type, this.messages));
        } else {
            this.writer.write(createRpcCompositeMessage(this.id, this.type, this.messages, this.routeType));
        }
    }
}

export class RpcMessageBuilder {
    public routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client;

    public strictSerialization: boolean = true;
    public logValidationErrors: boolean = false;

    public errorLabel: string = 'Error in serialization';

    constructor(
        protected logger: Logger,
        protected writer: RpcConnectionWriter,
        protected id: number,
        protected clientId?: Uint8Array,
        protected source?: Uint8Array,
    ) {
    }

    protected messageFactory<T>(type: RpcTypes, schemaOrBody?: ReceiveType<T> | Uint8Array, data?: T): Uint8Array {
        if (schemaOrBody instanceof Uint8Array) {
            if (this.source && this.clientId) {
                //we route back accordingly
                return createRpcMessageSourceDestForBody(this.id, type, this.clientId, this.source, schemaOrBody);
            } else {
                return createRpcMessageForBody(this.id, type, schemaOrBody, this.routeType);
            }
        } else {
            if (!this.strictSerialization && !this.logValidationErrors) {
                schemaOrBody = anyType;
            }

            for (let i = 0; i < 2; i++) {
                try {
                    if (this.source && this.clientId) {
                        //we route back accordingly
                        return createRpcMessageSourceDest(this.id, type, this.clientId, this.source, data, schemaOrBody);
                    } else {
                        return createRpcMessage(this.id, type, data, this.routeType, schemaOrBody);
                    }
                } catch (error) {
                    if (this.logValidationErrors) {
                        this.logger.warn(this.errorLabel, error);
                    }
                    if (!this.strictSerialization) {
                        if (schemaOrBody === anyType) {
                            throw error;
                        }
                        schemaOrBody = anyType;
                    }
                }
            }
            throw new Error('Could not serialize message for unknown reason');
        }
    }

    ack(): void {
        this.writer.write(this.messageFactory(RpcTypes.Ack));
    }

    error(error: Error | string): void {
        const extracted = rpcEncodeError(error);

        this.writer.write(this.messageFactory(RpcTypes.Error, typeOf<rpcError>(), extracted));
    }

    reply<T>(type: number, body?: T, receiveType?: ReceiveType<T>): void {
        this.writer.write(this.messageFactory(type, receiveType, body));
    }

    replyBinary<T>(type: number, body?: Uint8Array): void {
        this.writer.write(this.messageFactory(type, body));
    }

    composite(type: number): RpcCompositeMessage {
        const composite = new RpcCompositeMessage(this.logger, type, this.id, this.writer, this.clientId, this.source);
        composite.strictSerialization = this.strictSerialization;
        composite.logValidationErrors = this.logValidationErrors;
        composite.errorLabel = this.errorLabel;
        return composite;
    }
}

/**
 * This is a reference implementation and only works in a single process.
 * A real-life implementation would use an external message-bus, like Redis & co.
 */
export class RpcPeerExchange {
    protected registeredPeers = new Map<string, RpcConnectionWriter>();

    async isRegistered(id: string): Promise<boolean> {
        return this.registeredPeers.has(id);
    }

    async deregister(id: string | Uint8Array): Promise<void> {
        this.registeredPeers.delete('string' === typeof id ? id : stringifyUuid(id));
    }

    register(id: string | Uint8Array, writer: RpcConnectionWriter): void {
        this.registeredPeers.set('string' === typeof id ? id : stringifyUuid(id), writer);
    }

    redirect(message: RpcMessage) {
        if (message.routeType == RpcMessageRouteType.peer) {
            const peerId = message.getPeerId();
            const writer = this.registeredPeers.get(peerId);
            if (!writer) {
                //we silently ignore, as a pub/sub would do as well
                console.log('NO writer found for peer', peerId);
                return;
            }
            writer.write(message.getBuffer());
        }

        if (message.routeType == RpcMessageRouteType.sourceDest) {
            const destination = message.getDestination();

            //in this implementation we have to stringify it first, since v8 can not index Uint8Arrays
            const uuid = stringifyUuid(destination);
            const writer = this.registeredPeers.get(uuid);
            if (!writer) {
                console.log('NO writer found for destination', uuid);
                //we silently ignore, as a pub/sub would do as well
                return;
            }
            writer.write(message.getBuffer());
        }
    }
}

export interface RpcConnectionWriter {
    write(buffer: Uint8Array): void;

    close(): void;

    bufferedAmount?(): number;

    clientAddress?(): string;
}

export abstract class RpcKernelBaseConnection {
    protected messageId: number = 0;
    public sessionState = new SessionState();

    protected reader = new RpcMessageReader(
        this.handleMessage.bind(this),
        (id: number) => {
            this.writer.write(createRpcMessage(id, RpcTypes.ChunkAck));
        },
    );

    protected actionClient: RpcActionClient = new RpcActionClient(this);

    protected id: Uint8Array = writeUuid(createBuffer(16));

    protected replies = new Map<number, ((message: RpcMessage) => void)>();
    public writerOptions: RpcMessageWriterOptions = new RpcMessageWriterOptions;

    public writer: RpcMessageWriter = new RpcMessageWriter(this.transportWriter, this.reader, this.writerOptions);

    protected timeoutTimers: any[] = [];
    public readonly onClose: Promise<void>;
    protected onCloseResolve?: Function;

    constructor(
        protected logger: Logger,
        protected transportWriter: RpcConnectionWriter,
        protected connections: RpcKernelConnections,
    ) {
        this.connections.connections.push(this);
        this.onClose = new Promise((resolve) => {
            this.onCloseResolve = resolve;
        });
    }

    clientAddress(): string | undefined {
        return this.transportWriter.clientAddress ? this.transportWriter.clientAddress() : undefined;
    }

    createMessageBuilder(): RpcMessageBuilder {
        return new RpcMessageBuilder(this.logger, this.writer, this.messageId++);
    }

    /**
     * Creates a regular timer using setTimeout() and automatically cancel it once the connection breaks or server stops.
     */
    public setTimeout(cb: () => void, timeout: number): any {
        const timer = setTimeout(() => {
            cb();
            arrayRemoveItem(this.timeoutTimers, timer);
        }, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    public close(): void {
        for (const timeout of this.timeoutTimers) clearTimeout(timeout);
        if (this.onCloseResolve) this.onCloseResolve();
        arrayRemoveItem(this.connections.connections, this);
        this.writer.close();
    }

    public feed(buffer: Uint8Array, bytes?: number): void {
        this.reader.feed(buffer, bytes);
    }

    public handleMessage(message: RpcMessage): void {
        if (message.routeType === RpcMessageRouteType.server) {
            //initiated by the server, so we check replies
            const callback = this.replies.get(message.id);
            if (callback) {
                callback(message);
                return;
            }
        }

        const response = new RpcMessageBuilder(this.logger, this.writer, message.id);
        this.onMessage(message, response);
    }

    abstract onMessage(message: RpcMessage, response: RpcMessageBuilder): void | Promise<void>;

    public controller<T>(nameOrDefinition: string | ControllerDefinition<T>, timeoutInSeconds = 60): RemoteController<T> {
        const controller = new RpcControllerState('string' === typeof nameOrDefinition ? nameOrDefinition : nameOrDefinition.path);

        return new Proxy(this, {
            get: (target, propertyName) => {
                return (...args: any[]) => {
                    return this.actionClient.action(controller, propertyName as string, args);
                };
            },
        }) as any as RemoteController<T>;
    }

    public sendMessage<T>(
        type: number,
        body?: T,
        receiveType?: ReceiveType<T>,
    ): RpcMessageSubject {
        const id = this.messageId++;
        const continuation = <T>(type: number, body?: T, receiveType?: ReceiveType<T>) => {
            //send a message with the same id. Don't use sendMessage() again as this would lead to a memory leak
            // and a new id generated. We want to use the same id.
            const message = createRpcMessage(id, type, body, RpcMessageRouteType.server, receiveType);
            this.writer.write(message);
        };

        const subject = new RpcMessageSubject(continuation, () => {
            this.replies.delete(id);
        });

        this.replies.set(id, (v: RpcMessage) => subject.next(v));

        const message = createRpcMessage(id, type, body, RpcMessageRouteType.server, receiveType);
        this.writer.write(message);

        return subject;
    }
}

export class RpcKernelConnections {
    public connections: RpcKernelBaseConnection[] = [];

    broadcast(buffer: Uint8Array) {
        for (const connection of this.connections) {
            connection.writer.write(buffer);
        }
    }
}

export class RpcKernelConnection extends RpcKernelBaseConnection {
    public myPeerId?: string;
    protected actionHandler = new RpcServerAction(this, this.controllers, this.injector, this.security, this.sessionState, this.logger);

    public routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client;

    constructor(
        logger: Logger,
        writer: RpcConnectionWriter,
        connections: RpcKernelConnections,
        protected controllers: Map<string, { controller: ClassType, module?: InjectorModule }>,
        protected security = new RpcKernelSecurity(),
        protected injector: InjectorContext,
        protected peerExchange: RpcPeerExchange,
    ) {
        super(logger, writer, connections);
        this.onClose.then(async () => {
            try {
                await this.peerExchange.deregister(this.id);
                await this.actionHandler.onClose();
            } catch (e) {
                logger.scoped('RPC').error('Could no deregister/action close: ' + e);
            }
        });
        //register the current client so it can receive messages
        this.peerExchange.register(this.id, this.writer);
    }

    async onMessage(message: RpcMessage): Promise<void> {
        if (message.routeType == RpcMessageRouteType.peer && message.getPeerId() !== this.myPeerId) {
            // console.log('Redirect peer message', RpcTypes[message.type]);
            if (!await this.security.isAllowedToSendToPeer(this.sessionState.getSession(), message.getPeerId())) {
                new RpcMessageBuilder(this.logger, this.writer, message.id).error(new Error('Access denied'));
                return;
            }
            this.peerExchange.redirect(message);
            return;
        }

        if (message.routeType == RpcMessageRouteType.sourceDest) {
            // console.log('Redirect sourceDest message', RpcTypes[message.type]);
            this.peerExchange.redirect(message);
            return;
        }

        if (message.type === RpcTypes.Ping) {
            this.writer.write(createRpcMessage(message.id, RpcTypes.Pong));
            return;
        }

        //all outgoing replies need to be routed to the source via sourceDest messages.
        const response = new RpcMessageBuilder(this.logger, this.writer, message.id, this.id, message.routeType === RpcMessageRouteType.peer ? message.getSource() : undefined);
        response.routeType = this.routeType;

        try {
            if (message.routeType === RpcMessageRouteType.client) {
                switch (message.type) {
                    case RpcTypes.ClientId:
                        return response.reply<rpcClientId>(RpcTypes.ClientIdResponse, { id: this.id });
                    case RpcTypes.PeerRegister:
                        return await this.registerAsPeer(message, response);
                    case RpcTypes.PeerDeregister:
                        return this.deregisterAsPeer(message, response);
                }
            }

            switch (message.type) {
                case RpcTypes.Authenticate:
                    return await this.authenticate(message, response);
                case RpcTypes.ActionType:
                    return await this.actionHandler.handleActionTypes(message, response);
                case RpcTypes.Action:
                    return await this.actionHandler.handleAction(message, response);
                default:
                    return await this.actionHandler.handle(message, response);
            }
        } catch (error: any) {
            response.error(error);
        }
    }

    protected async authenticate(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody<rpcAuthenticate>();
        try {
            const session = await this.security.authenticate(body.token, this);
            this.sessionState.setSession(session);
            response.reply<rpcResponseAuthenticate>(RpcTypes.AuthenticateResponse, { username: session.username });
        } catch (error) {
            if (error instanceof AuthenticationError) throw new Error(error.message);
            this.logger.error('authenticate failed', error);
            throw new AuthenticationError();
        }
    }

    protected async deregisterAsPeer(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody<rpcPeerRegister>();

        try {
            if (body.id !== this.myPeerId) {
                return response.error(new Error(`Not registered as that peer`));
            }
            this.myPeerId = undefined;
            await this.peerExchange.deregister(body.id);
            response.ack();
        } catch (error) {
            this.logger.error('deregisterAsPeer failed', error);
            response.error(new Error('Failed'));
        }
    }

    protected async registerAsPeer(message: RpcMessage, response: RpcMessageBuilder) {
        const body = message.parseBody<rpcPeerRegister>();

        try {
            if (await this.peerExchange.isRegistered(body.id)) {
                return response.error(new Error(`Peer ${body.id} already registered`));
            }

            if (!await this.security.isAllowedToRegisterAsPeer(this.sessionState.getSession(), body.id)) {
                response.error(new Error('Access denied'));
                return;
            }

            await this.peerExchange.register(body.id, this.writer);
            this.myPeerId = body.id;
            response.ack();
        } catch (error) {
            this.logger.error('registerAsPeer failed', error);
            response.error(new Error('Failed'));
        }
    }
}

export type OnConnectionCallback = (connection: RpcKernelConnection, injector: InjectorContext, logger: LoggerInterface) => void;

/**
 * The kernel is responsible for parsing the message header, redirecting to peer if necessary, loading the body parser,
 * and encode/send outgoing messages.
 */
export class RpcKernel {
    public readonly controllers = new Map<string, { controller: ClassType, module: InjectorModule }>();

    protected peerExchange = new RpcPeerExchange;
    protected connections = new RpcKernelConnections;

    protected RpcKernelConnection = RpcKernelConnection;

    protected onConnectionListeners: OnConnectionCallback[] = [];
    protected autoInjector: boolean = false;

    public injector: InjectorContext;

    constructor(
        injector?: InjectorContext | NormalizedProvider[],
        protected logger: Logger = new Logger(),
    ) {
        if (injector instanceof InjectorContext) {
            this.injector = injector;
        } else {
            this.injector = InjectorContext.forProviders([
                { provide: SessionState, scope: 'rpc' },
                { provide: RpcKernelSecurity, scope: 'rpc' },

                //will be provided when scope is created
                { provide: RpcKernelConnection, scope: 'rpc', useValue: undefined },

                { provide: Logger, useValue: logger },

                ...(injector || []),
            ]);
            this.autoInjector = true;
        }
    }

    public onConnection(callback: OnConnectionCallback) {
        this.onConnectionListeners.push(callback);
        return () => {
            arrayRemoveItem(this.onConnectionListeners, callback);
        };
    }

    /**
     * This registers the controller and when no custom InjectorContext was given adds it as provider to the injector.
     *
     * Note: Controllers can not be added to the injector when the injector was already built.
     */
    public registerController(controller: ClassType, id?: string | ControllerDefinition<any>, module?: InjectorModule) {
        if (this.autoInjector) {
            if (!this.injector.rootModule.isProvided(controller)) {
                this.injector.rootModule.addProvider({ provide: controller, scope: 'rpc' });
            }
        }
        if (!id) {
            const rpcConfig = rpcClass._fetch(controller);
            if (!rpcConfig) throw new Error(`Controller ${getClassName(controller)} has no @rpc.controller() decorator and no controller id was provided.`);
            id = rpcConfig.getPath();
        }
        this.controllers.set('string' === typeof id ? id : id.path, {
            controller,
            module: module || this.injector.rootModule,
        });
    }

    createConnection(writer: RpcConnectionWriter, injector?: InjectorContext): RpcKernelBaseConnection {
        if (!injector) injector = this.injector.createChildScope('rpc');

        const connection = new this.RpcKernelConnection(this.logger, writer, this.connections, this.controllers, injector.get(RpcKernelSecurity), injector, this.peerExchange);
        injector.set(RpcKernelConnection, connection);
        for (const on of this.onConnectionListeners) on(connection, injector, this.logger);
        return connection;
    }
}
