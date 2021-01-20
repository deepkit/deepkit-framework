/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { ClientTransportAdapter, RpcClient, TransportConnectionHooks } from './client';

export class DeepkitClient extends RpcClient {
    constructor(url: string) {
        super(new RpcWebSocketClientAdapter(url));
    }

    static fromCurrentHost<T extends ClassType<DeepkitClient>>(this: T, baseUrl: string = ''): InstanceType<T> {
        const ws = location.protocol.startsWith('https') ? 'wss' : 'ws';
        return new (this as any)(`${ws}://${location.host}/${baseUrl}`);
    }
}

export class RpcWebSocketClientAdapter implements ClientTransportAdapter {
    constructor(public url: string) {
    }

    public async connect(connection: TransportConnectionHooks) {
        const socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";

        socket.onmessage = (event: MessageEvent) => {
            connection.onMessage(new Uint8Array(event.data));
        };

        socket.onclose = () => {
            connection.onClose();
        };

        socket.onerror = (error: any) => {
            connection.onError(error);
        };

        socket.onopen = async () => {
            connection.onConnected({
                disconnect() {
                    socket.close();
                },
                send(message) {
                    socket.send(message);
                }
            });
        };
    }
}
