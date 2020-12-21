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
import { ClassSchema, stringifyUuid, writeUuid } from '@deepkit/type';
import { rpcClientId, rpcError, RpcInjector, rpcPeerRegister, RpcTypes, SimpleInjector } from '../model';
import { createBuffer, createRpcMessage, createRpcMessageSourceDest, readRpcMessage, rpcEncodeError, RpcMessage, RpcMessageReader, RpcMessageRouteType } from '../protocol';
import { RpcServerAction } from './action';


export class RpcResponse {
    constructor(
        protected writer: RpcKernelConnectionWriter,
        protected id: number,
        protected messageFactory: <T>(id: number, type: RpcTypes, schema?: ClassSchema<T>, data?: T) => Uint8Array,
    ) {
    }

    ack(): void {
        this.writer.write(this.messageFactory(this.id, RpcTypes.Ack));
    }

    error(error: Error | string): void {
        const extracted = rpcEncodeError(error);

        this.writer.write(this.messageFactory(this.id, RpcTypes.Error, rpcError, extracted));
    }

    reply<T>(type: number, schema?: ClassSchema<T>, body?: T): void {
        this.writer.write(this.messageFactory(this.id, type, schema, body));
    }
}

export class RpcPeerExchange {
    protected registeredPeers = new Map<string, RpcKernelConnectionWriter>();

    isRegistered(id: string): boolean {
        return this.registeredPeers.has(id);
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

    //todo, change to binary representation. Does this change much?
    //v4 string 8b58969c-0640-4b43-a65b-423830117700 = 36 - 4 dashes = 32 byte.
    //one byte stores 0-9a-f => hex => 16states, but we have 255 possible in 8 bits.
    // protected id: string = uuid();
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

    protected createRpcMessage<T>(id: number, type: RpcTypes, schema?: ClassSchema<T>, data?: T): Uint8Array {
        return createRpcMessage(id, type, schema, data);
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

        // if (message.recipient && message.recipient !== this.myPeerId) {
        //     //if the message has a recipient and the recipient is me (myPeerId), then
        //     //just handle it normally.
        //     if (!this.registeredInExchangeForResponse) {
        //         this.peerExchange.register(this.id, this.writer);
        //         this.registeredInExchangeForResponse = true;
        //     }

        //     this.peerExchange.redirect(message);
        //     return;
        // }

        let messageFactory = this.createRpcMessage;
        if (message.routeType == RpcMessageRouteType.peer) {
            // console.log('Handle peer message', RpcTypes[message.type]);
            const source = message.getSource();
            messageFactory = <T>(id: number, type: RpcTypes, schema?: ClassSchema<T>, data?: T) => {
                return createRpcMessageSourceDest(id, type, this.id, source, schema, data);
            }
        } else {
            // console.log('Handle regular message', RpcTypes[message.type]);
        }

        const response = new RpcResponse(this.writer, message.id, messageFactory);

        try {
            if (message.routeType === RpcMessageRouteType.client) {
                switch (message.type) {
                    case RpcTypes.ClientId: return response.reply(RpcTypes.ClientIdResponse, rpcClientId, { id: this.id });
                    case RpcTypes.PeerRegister: return this.registerAsPeer(message, response);
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

    createConnection(writer: RpcKernelConnectionWriter) {
        return new RpcKernelConnection(writer, this.controllers, this.injector, this.peerExchange);
    }
}
