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
import { stringifyUuid } from '@deepkit/type';
import { ControllerDefinition, RpcError, RpcStats, RpcTransportStats } from '../model.js';
import { RpcKernelSecurity, SessionState } from './security.js';
import { InjectorContext, InjectorModule, NormalizedProvider, Setter } from '@deepkit/injector';
import { Logger, LoggerInterface } from '@deepkit/logger';
import { rpcClass } from '../decorators.js';
import { TransportConnection, TransportOptions } from '../transport.js';
import { EventDispatcher, EventDispatcherUnsubscribe, EventListenerCallback, EventToken } from '@deepkit/event';
import { onRpcConnection, onRpcConnectionClose } from '../events.js';
import {
    actionIdSize,
    ContextDispatcher,
    contextIdSize,
    flagSize,
    getBodyOffset,
    getContextId,
    isContextFlag,
    isRouteFlag,
    isTypeFlag,
    MessageFlag,
    routeDirectParamsSize,
} from '../protocol.js';
import { ActionDispatcher, ActionExecutor } from '../action.js';
import { readUint32LE } from '@deepkit/bson';

// const anyType: Type = { kind: ReflectionKind.any };

// export class RpcCompositeMessage {
//     protected messages: RpcCreateMessageDef<any>[] = [];
//
//     public strictSerialization: boolean = false;
//     public logValidationErrors: boolean = false;
//     public errorLabel: string = 'Error in serialization';
//
//     constructor(
//         protected stats: RpcTransportStats,
//         protected logger: Logger,
//         public type: number,
//         protected id: number,
//         protected writer: TransportMessageWriter,
//         protected transportOptions: TransportOptions,
//         protected clientId?: Uint8Array,
//         protected source?: Uint8Array,
//         protected routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client,
//     ) {
//     }
//
//     add<T>(type: number, body?: T, receiveType?: ReceiveType<T>): this {
//         if (!this.strictSerialization) {
//             receiveType = anyType;
//         }
//         this.messages.push({ type, schema: receiveType ? resolveReceiveType(receiveType) : undefined, body });
//         return this;
//     }
//
//     write(message: RpcMessageDefinition): void {
//         try {
//             this.writer(message, this.transportOptions, this.stats);
//         } catch (error) {
//             if (this.logValidationErrors) {
//                 this.logger.warn(this.errorLabel, error);
//             }
//             throw error;
//         }
//     }
//
//     send() {
//         if (this.clientId && this.source) {
//             //we route back accordingly
//             this.write(createRpcCompositeMessageSourceDest(this.id, this.clientId, this.source, this.type, this.messages));
//         } else {
//             this.write(createRpcCompositeMessage(this.id, this.type, this.messages, this.routeType));
//         }
//     }
// }

// export class RpcMessageBuilder {
//     public routeType: RpcMessageRouteType.client | RpcMessageRouteType.server = RpcMessageRouteType.client;
//
//     public strictSerialization: boolean = true;
//     public logValidationErrors: boolean = false;
//
//     public errorLabel: string = 'Error in serialization';
//
//     constructor(
//         protected stats: RpcTransportStats,
//         protected logger: Logger,
//         protected writer: TransportMessageWriter,
//         protected transportOptions: TransportOptions,
//         protected id: number,
//         protected clientId?: Uint8Array,
//         protected source?: Uint8Array,
//     ) {
//     }
//
//     protected messageFactory<T>(type: RpcTypes, schemaOrBody?: ReceiveType<T>, data?: T): RpcMessageDefinition {
//         if (!this.strictSerialization) {
//             schemaOrBody = anyType;
//         }
//
//         if (this.source && this.clientId) {
//             //we route back accordingly
//             return createRpcMessageSourceDest(this.id, type, this.clientId, this.source, data, schemaOrBody);
//         } else {
//             return createRpcMessage(this.id, type, data, this.routeType, schemaOrBody);
//         }
//     }
//
//     write(message: RpcMessageDefinition): void {
//         try {
//             this.writer(message, this.transportOptions, this.stats);
//         } catch (error: any) {
//             if (this.logValidationErrors) {
//                 this.logger.warn(this.errorLabel, error);
//             }
//             throw new RpcError(this.errorLabel + ': ' + error.message, { cause: error });
//         }
//     }
//
//     ack(): void {
//         this.write(this.messageFactory(RpcTypes.Ack));
//     }
//
//     error(error: Error | string): void {
//         const extracted = rpcEncodeError(error);
//
//         this.write(this.messageFactory(RpcTypes.Error, typeOf<rpcError>(), extracted));
//     }
//
//     reply<T>(type: number, body?: T, receiveType?: ReceiveType<T>): void {
//         this.write(this.messageFactory(type, receiveType, body));
//     }
//
//     /**
//      * @deprecated
//      */
//     replyBinary<T>(type: number, body?: Uint8Array): void {
//         throw new RpcError('replyBinary deprecated');
//     }
//
//     composite(type: number): RpcCompositeMessage {
//         const composite = new RpcCompositeMessage(this.stats, this.logger, type, this.id, this.writer, this.transportOptions, this.clientId, this.source);
//         composite.strictSerialization = this.strictSerialization;
//         composite.logValidationErrors = this.logValidationErrors;
//         composite.errorLabel = this.errorLabel;
//         return composite;
//     }
// }

/**
 * This is a reference implementation and only works in a single process.
 * A real-life implementation would use an external message-bus, like Redis & co.
 */
export class RpcPeerExchange {
    protected registeredPeers = new Map<string, TransportConnection>();

    async isRegistered(id: string): Promise<boolean> {
        return this.registeredPeers.has(id);
    }

    async deregister(id: string | Uint8Array): Promise<void> {
        this.registeredPeers.delete('string' === typeof id ? id : stringifyUuid(id));
    }

    register(id: string | Uint8Array, writer: TransportConnection): void {
        this.registeredPeers.set('string' === typeof id ? id : stringifyUuid(id), writer);
    }

    redirect(message: Uint8Array) {
        if (isRouteFlag(message[0], MessageFlag.RouteDirect)) {
            // const peerId = message.getPeerId();
            // const writer = this.registeredPeers.get(peerId);
            // if (!writer) {
            //     //we silently ignore, as a pub/sub would do as well
            //     console.log('NO writer found for peer', peerId);
            //     return;
            // }
            // if (writer.writeBinary) writer.writeBinary(message.getBuffer());
        } else if (isRouteFlag(message[0], MessageFlag.RouteDirect)) {
            // const destination = message.getDestination();
            //
            // //in this implementation we have to stringify it first, since v8 can not index Uint8Arrays
            // const uuid = stringifyUuid(destination);
            // const writer = this.registeredPeers.get(uuid);
            // if (!writer) {
            //     console.log('NO writer found for destination', uuid);
            //     //we silently ignore, as a pub/sub would do as well
            //     return;
            // }
            // if (writer.writeBinary) writer.writeBinary(message.getBuffer());
        }
    }
}
export class RpcKernelConnection {
    public sessionState = new SessionState();

    protected selfContext = new ContextDispatcher();

    public transportOptions: TransportOptions = new TransportOptions();

    protected timeoutTimers: any[] = [];

    public closed: boolean = false;
    public stats: RpcStats = new RpcStats;

    protected fastReply = new Uint8Array(flagSize + routeDirectParamsSize + contextIdSize + actionIdSize);
    protected fastReply1 = new Uint8Array(flagSize);
    protected fastReplySchema = new Uint8Array(0);

    protected actionExecutor: ActionExecutor;

    constructor(
        protected onClose: (connection: RpcKernelConnection) => void,
        protected actionDispatcher: ActionDispatcher,
        protected serverStats: RpcStats,
        protected logger: Logger,
        public transportConnection: TransportConnection,
        protected injector: InjectorContext,
        protected eventDispatcher: EventDispatcher,
    ) {
        if (!injector.scope) throw new Error('RpcKernelConnection requires an injector with scope');
        this.actionExecutor = new ActionExecutor(actionDispatcher, this.selfContext, transportConnection, injector.scope);
    }

    /**
     * Serializes the message (binary) and sends it to the client using
     * a chunk writer (splitting the message into smaller parts if necessary,
     * so they can be tracked).
     */
    clientAddress(): string | undefined {
        return this.transportConnection.clientAddress ? this.transportConnection.clientAddress() : undefined;
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

    public close(reason: string | Error = 'closed'): void {
        if (this.closed) return;
        this.closed = true;

        // todo: close all contexts

        this.serverStats.connections--;

        this.eventDispatcher.dispatch(onRpcConnectionClose, () => ({
            reason,
            context: { connection: this, injector: this.injector },
        }), this.injector);

        for (const timeout of this.timeoutTimers) clearTimeout(timeout);

        this.transportConnection.close();
        this.onClose(this);
    }

    public feed(message: Uint8Array): void {
        this.stats.incomingBytes += message.byteLength;
        this.stats.incoming++;
        this.serverStats.incomingBytes += message.byteLength;
        this.serverStats.incoming++;

        // todo: change these conditions to array lookup

        if (isRouteFlag(message[0], MessageFlag.RouteDirect)) {
            // todo: forward to another connection (e.g. via broker)
            return;
        }

        if (isTypeFlag(message[0], MessageFlag.TypeSchema)) {
            const bodyOffset = getBodyOffset(message);
            const hash = readUint32LE(message, bodyOffset);
            if (!this.actionDispatcher.schemaMessage) {
                this.fastReply1[0] = MessageFlag.RouteClient | MessageFlag.TypeError;
                this.transportConnection.write(this.fastReply1);
                return;
            }
            if (hash === this.actionDispatcher.schemaMessageHash) {
                this.actionDispatcher.schemaMessage = message;
                this.fastReply1[0] = MessageFlag.RouteClient | MessageFlag.TypeAck;
                this.transportConnection.write(this.fastReply1);
            } else {
                if (this.fastReplySchema.byteLength === 0) {
                    this.fastReplySchema = new Uint8Array(this.actionDispatcher.schemaMessage.byteLength + 1);
                    this.fastReplySchema[0] = MessageFlag.RouteClient | MessageFlag.TypeSchema;
                    this.fastReplySchema.set(this.actionDispatcher.schemaMessage, 1);
                }
                this.transportConnection.write(this.fastReplySchema);
            }
            return;
        }

        if (isTypeFlag(message[0], MessageFlag.TypeChunk)) {
            // todo: handle chunks
            // this.replies.get(message.id)?.ack();
            return;
        }

        if (isContextFlag(message[0], MessageFlag.ContextExisting)) {
            console.log('context existing');
            const contextId = getContextId(message);
            this.selfContext.dispatch(contextId, message);
            return;
        }

        // const contextId = getContextId(message);
        // if (isContextFlag(message[0], MessageFlag.ContextNew)) {
        //     this.selfContext.create(() => {
        //         // here all future message for this particular contextId will be dispatched to
        //     })
        // }

        try {
            if (isTypeFlag(message[0], MessageFlag.TypeAction)) {
                this.actionExecutor.execute(message);
                return;
            }
        } catch (error) {
            console.log('RpcKernelConnection.feed error', error);
        }
    }
}

export class RpcKernelConnections {
    public connections: RpcKernelConnection[] = [];

    public stats: RpcTransportStats = new RpcTransportStats;

    broadcast(message: Uint8Array) {
        for (const connection of this.connections) {
            connection.feed(message);
        }
    }
}

export type OnConnectionCallback = (connection: RpcKernelConnection, injector: InjectorContext, logger: LoggerInterface) => void;

/**
 * The kernel is responsible for parsing the message header, redirecting to peer if necessary, loading the body parser,
 * and encode/send outgoing messages.
 *
 * @reflection never
 */
export class RpcKernel {
    public readonly controllers = new Map<string, { name: string, controller: ClassType, module: InjectorModule }>();

    protected actions = new ActionDispatcher();

    protected connections = new RpcKernelConnections;

    protected RpcKernelConnection = RpcKernelConnection;

    protected onConnectionListeners: OnConnectionCallback[] = [];
    protected autoInjector: boolean = false;

    public stats = new RpcStats();

    public injector: InjectorContext;

    protected setConnection: Setter<RpcKernelConnection> = () => undefined;

    constructor(
        injector?: InjectorContext | NormalizedProvider[],
        protected logger: Logger = new Logger(),
    ) {
        if (injector instanceof InjectorContext) {
            this.injector = injector;
        } else {
            this.injector = InjectorContext.forProviders([
                EventDispatcher,
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

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called. Default is 0.
     */
    listen<T extends EventToken<any>>(eventToken: T, callback: EventListenerCallback<T>, order: number = 0): EventDispatcherUnsubscribe {
        return this.getEventDispatcher().listen(eventToken, callback, order);
    }

    public getEventDispatcher(): EventDispatcher {
        const result = this.injector.get(EventDispatcher);
        this.getEventDispatcher = () => result;
        return result;
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
            if (!rpcConfig) throw new RpcError(`Controller ${getClassName(controller)} has no @rpc.controller() decorator and no controller id was provided.`);
            id = rpcConfig.getPath();
        }
        const name = 'string' === typeof id ? id : id.path;

        this.controllers.set('string' === typeof id ? id : id.path, {
            name,
            controller,
            module: module || this.injector.rootModule,
        });
        this.built = false;
    }

    protected built = false;

    createConnection(transport: TransportConnection, injector?: InjectorContext): RpcKernelConnection {
        if (!injector) injector = this.injector.createChildScope('rpc');
        if (!this.built) {
            this.setConnection = this.injector.setter(undefined, RpcKernelConnection);
            this.actions.build(this.injector, this.controllers.values());
            this.built = true;
        }

        this.stats.connections++;
        this.stats.totalConnections++;

        const connection = new this.RpcKernelConnection(
            (connection: RpcKernelConnection) => {
                arrayRemoveItem(this.connections.connections, connection);
            },
            this.actions,
            this.stats,
            this.logger.scoped('rpc:connection'),
            transport,
            injector,
            this.getEventDispatcher(),
        );
        this.connections.connections.push(connection);
        this.setConnection(connection, injector.scope);

        for (const on of this.onConnectionListeners) on(connection, injector, this.logger);
        this.getEventDispatcher().dispatch(onRpcConnection, { context: { connection, injector } });
        return connection;
    }
}
