/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { RpcKernel } from '../server/kernel.js';
import { ClientTransportAdapter, RpcClient } from './client.js';
import { InjectorContext } from '@deepkit/injector';
import { TransportClientConnection } from '../transport.js';

export class DirectClient extends RpcClient {
    constructor(rpcKernel: RpcKernel, injector?: InjectorContext) {
        super(new RpcDirectClientAdapter(rpcKernel, injector));
    }
}

export class RpcDirectClientAdapter implements ClientTransportAdapter {
    constructor(public rpcKernel: RpcKernel, protected injector?: InjectorContext) {
    }

    public async connect(connection: TransportClientConnection) {
        let closed = false;
        const kernelConnection = this.rpcKernel.createConnection({
            write: (buffer) => {
                if (closed) return;
                connection.read(buffer);
            },
            close: () => {
                closed = true;
                connection.onClose('closed');
            },
        }, this.injector);

        connection.onConnected({
            clientAddress: () => {
                return 'direct';
            },
            bufferedAmount(): number {
                return 0;
            },
            close() {
                closed = true;
                kernelConnection.close();
            },
            write(buffer) {
                kernelConnection.feed(buffer);
            },
        });
    }
}

/**
 * This direct client includes in each outgoing/incoming message an async hop making
 * the communication asynchronous.
 */
export class AsyncDirectClient extends RpcClient {
    constructor(rpcKernel: RpcKernel, injector?: InjectorContext) {
        super(new RpcAsyncDirectClientAdapter(rpcKernel, injector));
    }
}

export class RpcAsyncDirectClientAdapter implements ClientTransportAdapter {
    constructor(public rpcKernel: RpcKernel, protected injector?: InjectorContext) {
    }

    public async connect(connection: TransportClientConnection) {
        const kernelConnection = this.rpcKernel.createConnection({
            write: (buffer) => {
                setTimeout(() => {
                    connection.read(buffer);
                });
            },
            close: () => {
                connection.onClose('closed');
            },
        }, this.injector);

        connection.onConnected({
            clientAddress: () => {
                return 'direct';
            },
            bufferedAmount(): number {
                return 0;
            },
            close() {
                kernelConnection.close();
            },
            write(buffer) {
                setTimeout(() => {
                    kernelConnection.feed(buffer);
                });
            },
        });
    }
}
