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

import { arrayRemoveItem, ClassType } from '@deepkit/core';
import { ClassSchema, getClassSchema, stringifyUuid, writeUuid } from '@deepkit/type';
import { RpcMessageWriter } from '../writer';
import { RpcMessageSubject } from '../client/message-subject';
import {
    rpcAuthenticate,
    rpcClientId,
    rpcError,
    RpcInjector,
    rpcPeerRegister,
    rpcResponseAuthenticate,
    RpcTypes,
    SimpleInjector
} from '../model';
import {
    createBuffer,
    createRpcCompositeMessage,
    createRpcCompositeMessageSourceDest,
    createRpcMessage,
    createRpcMessageSourceDest,
    readRpcMessage,
    RpcCreateMessageDef,
    rpcEncodeError,
    RpcMessage,
    RpcMessageReader,
    RpcMessageRouteType
} from '../protocol';
import { RpcServerAction } from './action';
import { RpcKernelSecurity, Session, SessionState } from './security';

export class RpcResponseComposite {
    protected messages: RpcCreateMessageDef<any>[] = [];

    constructor(
        public type: number,
        protected id: number,
        protected writer: RpcConnectionWriter,
        protected clientId?: Uint8Array,
        protected source?: Uint8Array,
    ) {
    }

    add<T>(type: number, schema?: ClassSchema<T> | ClassType<T>, body?: T): this {
        this.messages.push({ type, schema: schema ? getClassSchema(schema) : undefined, body });
        return this;
    }

    send() {
        if (!this.messages.length) return;

        if (this.clientId && this.source) {
            //we route back accordingly
            this.writer.write(createRpcCompositeMessageSourceDest(this.id, this.clientId, this.source, this.type, this.messages));
        } else {
            this.writer.write(createRpcCompositeMessage(this.id, this.type, this.messages));
        }
    }
}

export class RpcResponse {
    constructor(
        protected writer: RpcConnectionWriter,
        protected id: number,
        protected clientId?: Uint8Array,
        protected source?: Uint8Array,
    ) {
    }

    protected messageFactory<T>(type: RpcTypes, schema?: ClassSchema<T>, data?: T): Uint8Array {
        if (this.source && this.clientId) {
            //we route back accordingly
            return createRpcMessageSourceDest(this.id, type, this.clientId, this.source, schema, data);
        } else {
            return createRpcMessage(this.id, type, schema, data);
        }
    }

    ack(): void {
        this.writer.write(this.messageFactory(RpcTypes.Ack));
    }

    error(error: Error | string): void {
        const extracted = rpcEncodeError(error);

        this.writer.write(this.messageFactory(RpcTypes.Error, rpcError, extracted));
    }

    reply<T>(type: number, schema?: ClassSchema<T>, body?: T): void {

        this.writer.write(this.messageFactory(type, schema, body));
    }

    composite(type: number): RpcResponseComposite {
        return new RpcResponseComposite(type, this.id, this.writer, this.clientId, this.source);
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

    async register(id: string | Uint8Array, writer: RpcConnectionWriter): Promise<void> {
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

//this will not be responsible for packaging. We pack in the transporter.
export interface RpcConnectionWriter {
    write(buffer: Uint8Array): void;

    bufferedAmount?(): number;
}

export abstract class RpcKernelBaseConnection {
    protected messageId: number = 0;
    protected reader = new RpcMessageReader(
        this.handleMessage.bind(this),
        (id: number) => {
            this.writer.write(createRpcMessage(id, RpcTypes.ChunkAck));
        }
    );

    protected id: Uint8Array = writeUuid(createBuffer(16));

    protected replies = new Map<number, ((message: RpcMessage) => void)>();
    public writer: RpcMessageWriter = new RpcMessageWriter(this.transportWriter, this.reader);

    protected timeoutTimers: any[] = [];
    public readonly onClose: Promise<void>;
    protected onCloseResolve?: Function;

    constructor(
        protected transportWriter: RpcConnectionWriter,
        protected connections: RpcKernelConnections,
    ) {
        this.connections.connections.push(this);
        this.onClose = new Promise((resolve) => {
            this.onCloseResolve = resolve;
        })
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
    }

    public feed(buffer: Uint8Array): void {
        this.reader.feed(buffer);
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

        const response = new RpcResponse(this.writer, message.id);
        this.onMessage(message, response);
    }

    abstract onMessage(message: RpcMessage, response: RpcResponse): void | Promise<void>;

    public sendMessage<T>(
        type: number,
        schema?: ClassSchema<T>,
        body?: T
    ): RpcMessageSubject {
        const id = this.messageId++;
        const continuation = <T>(type: number, schema?: ClassSchema<T>, body?: T) => {
            //send a message with the same id. Don't use sendMessage() again as this would lead to a memory leak
            // and a new id generated. We want to use the same id.
            const message = createRpcMessage(id, type, schema, body, RpcMessageRouteType.server);
            this.writer.write(message);
        };

        const subject = new RpcMessageSubject(continuation, () => {
            this.replies.delete(id);
        });

        this.replies.set(id, (v: RpcMessage) => subject.next(v));

        const message = createRpcMessage(id, type, schema, body, RpcMessageRouteType.server);
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
    protected sessionState = new SessionState<Session>();
    protected actionHandler = new RpcServerAction(this.controllers, this.injector, this.security, this.sessionState);

    constructor(
        writer: RpcConnectionWriter,
        connections: RpcKernelConnections,
        protected controllers: Map<string, ClassType>,
        protected security = new RpcKernelSecurity<Session>(),
        protected injector: RpcInjector,
        protected peerExchange: RpcPeerExchange,
    ) {
        super(writer, connections);
        this.peerExchange.register(this.id, this.writer);
    }

    async onMessage(message: RpcMessage): Promise<void> {
        if (message.routeType == RpcMessageRouteType.peer && message.getPeerId() !== this.myPeerId) {
            // console.log('Redirect peer message', RpcTypes[message.type]);
            if (!await this.security.isAllowedToSendToPeer(this.sessionState.getSession(), message.getPeerId())) {
                new RpcResponse(this.writer, message.id).error(new Error('Access denied'));
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

        //all outgoing replies need to be routed to the source via sourceDest messages.
        const response = new RpcResponse(this.writer, message.id, this.id, message.routeType === RpcMessageRouteType.peer ? message.getSource() : undefined);

        try {
            if (message.routeType === RpcMessageRouteType.client) {
                switch (message.type) {
                    case RpcTypes.ClientId:
                        return response.reply(RpcTypes.ClientIdResponse, rpcClientId, { id: this.id });
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
        } catch (error) {
            response.error(error);
        }
    }

    protected async authenticate(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcAuthenticate);
        const session = await this.security.authenticate(body.token);
        this.sessionState.setSession(session);
        response.reply(RpcTypes.AuthenticateResponse, rpcResponseAuthenticate, { username: session.username });
    }

    protected async deregisterAsPeer(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcPeerRegister);
        if (body.id !== this.myPeerId) {
            return response.error(new Error(`Not registered as that peer`));
        }
        this.myPeerId = undefined;
        await this.peerExchange.deregister(body.id);
        response.ack();
    }

    protected async registerAsPeer(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcPeerRegister);
        if (await this.peerExchange.isRegistered(body.id)) {
            return response.error(new Error(`Peer ${body.id} already registereed`));
        }

        if (!await this.security.isAllowedToRegisterAsPeer(this.sessionState.getSession(), body.id)) {
            response.error(new Error('Access denied'));
            return;
        }

        await this.peerExchange.register(body.id, this.writer);
        this.myPeerId = body.id;
        response.ack();
    }
}


/**
 * The kernel is responsible for parsing the message header, redirecting to peer if necessary, loading the body parser,
 * and encode/send outgoing messages.
 */
export class RpcKernel {
    protected controllers = new Map<string, ClassType>();
    protected peerExchange = new RpcPeerExchange;
    protected connections = new RpcKernelConnections;

    constructor(
        protected injector: RpcInjector = new SimpleInjector,
        protected security = new RpcKernelSecurity<Session>(),
    ) {
    }

    public registerController(id: string, controller: ClassType) {
        this.controllers.set(id, controller);
    }

    createConnection(writer: RpcConnectionWriter, injector?: RpcInjector): RpcKernelConnection {
        return new RpcKernelConnection(writer, this.connections, this.controllers, this.security, injector || this.injector, this.peerExchange);
    }
}
