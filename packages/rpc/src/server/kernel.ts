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

import { ClassType } from '@deepkit/core';
import { ClassSchema, getClassSchema, stringifyUuid, writeUuid } from '@deepkit/type';
import { rpcClientId, rpcError, RpcInjector, rpcPeerRegister, RpcTypes, SimpleInjector } from '../model';
import { createBuffer, createRpcCompositeMessage, createRpcCompositeMessageSourceDest, createRpcMessage, createRpcMessageSourceDest, readRpcMessage, RpcCreateMessageDef, rpcEncodeError, RpcMessage, RpcMessageReader, RpcMessageRouteType } from '../protocol';
import { RpcServerAction } from './action';

export class RpcResponseComposite {
    protected messages: RpcCreateMessageDef<any>[] = [];

    constructor(
        public type: number,
        protected id: number,
        protected clientId: Uint8Array,
        protected writer: RpcKernelConnectionWriter,
        protected source?: Uint8Array,
    ) {
    }

    add<T>(type: number, schema?: ClassSchema<T> | ClassType<T>, body?: T): this {
        this.messages.push({type, schema: schema ? getClassSchema(schema) : undefined, body});
        return this;
    }

    send() {
        if (!this.messages.length) return;

        if (this.source) {
            //we route back accordingly
            this.writer.write(createRpcCompositeMessageSourceDest(this.id, this.clientId, this.source, this.type, this.messages));
        } else {
            this.writer.write(createRpcCompositeMessage(this.id, this.type, this.messages));
        }
    }
}

export class RpcResponse {
    constructor(
        protected writer: RpcKernelConnectionWriter,
        protected id: number,
        protected clientId: Uint8Array,
        protected source?: Uint8Array,
    ) {
    }

    protected messageFactory<T>(type: RpcTypes, schema?: ClassSchema<T>, data?: T): Uint8Array {
        if (this.source) {
            //we route pack accordingly
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
        return new RpcResponseComposite(type, this.id, this.clientId, this.writer, this.source);
    }
}

/**
 * This is a reference implementation and only works in a single process. 
 * A real-life implementation would use an external message-bus, like Redis & co.
 */
export class RpcPeerExchange {
    protected registeredPeers = new Map<string, RpcKernelConnectionWriter>();

    isRegistered(id: string): boolean {
        return this.registeredPeers.has(id);
    }

    deregister(id: string | Uint8Array) {
        this.registeredPeers.delete('string' === typeof id ? id : stringifyUuid(id));
    }

    register(id: string | Uint8Array, writer: RpcKernelConnectionWriter) {
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
export interface RpcKernelConnectionWriter {
    write(buffer: Uint8Array): void;
}

export class RpcKernelConnection {
    protected reader = new RpcMessageReader(this.handleMessage.bind(this));
    protected actionHandler = new RpcServerAction(this.controllers, this.injector);
    public myPeerId?: string;

    protected messageId: number = 0;

    protected id: Uint8Array = writeUuid(createBuffer(16));

    constructor(
        protected writer: RpcKernelConnectionWriter,
        protected controllers: Map<string, ClassType>,
        protected injector: RpcInjector,
        protected peerExchange: RpcPeerExchange,
    ) {
        this.peerExchange.register(this.id, this.writer);
    }

    public close(): void {

    }

    public feed(buffer: Uint8Array): void {
        this.reader.feed(buffer);
    }

    async handleMessage(buffer: Uint8Array): Promise<void> {
        const message = readRpcMessage(buffer);

        if (message.routeType == RpcMessageRouteType.peer && message.getPeerId() !== this.myPeerId) {
            // console.log('Redirect peer message', RpcTypes[message.type]);
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
                    case RpcTypes.ClientId: return response.reply(RpcTypes.ClientIdResponse, rpcClientId, { id: this.id });
                    case RpcTypes.PeerRegister: return this.registerAsPeer(message, response);
                    case RpcTypes.PeerDeregister: return this.deregisterAsPeer(message, response);
                }
            }

            switch (message.type) {
                case RpcTypes.ActionType: return await this.actionHandler.handleActionTypes(message, response);
                case RpcTypes.Action: return await this.actionHandler.handleAction(message, response);
                default: return await this.actionHandler.handle(message, response);
            }
        } catch (error) {
            response.error(error);
        }
    }

    protected deregisterAsPeer(message: RpcMessage, response: RpcResponse): void {
        const body = message.parseBody(rpcPeerRegister);
        if (this.peerExchange.isRegistered(body.id)) {
            return response.error(new Error(`Peer ${body.id} already registereed`));
        }
        this.myPeerId = undefined;
        this.peerExchange.deregister(body.id);
        response.ack();
    }

    protected registerAsPeer(message: RpcMessage, response: RpcResponse): void {
        const body = message.parseBody(rpcPeerRegister);
        if (this.peerExchange.isRegistered(body.id)) {
            return response.error(new Error(`Peer ${body.id} already registereed`));
        }

        this.myPeerId = body.id;
        this.peerExchange.register(body.id, this.writer);
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

    constructor(
        protected injector: RpcInjector = new SimpleInjector
    ) {
    }

    public registerController(id: string, controller: ClassType) {
        this.controllers.set(id, controller);
    }

    createConnection(writer: RpcKernelConnectionWriter, injector?: RpcInjector) {
        return new RpcKernelConnection(writer, this.controllers, injector || this.injector, this.peerExchange);
    }
}
