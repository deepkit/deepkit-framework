/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { RpcInjector } from '../model';
import { RpcKernel } from '../server/kernel';
import { ClientTransportAdapter, RpcClient, TransportConnectionHooks } from './client';

export class DirectClient extends RpcClient {
    constructor(rpcKernel: RpcKernel, injector?: RpcInjector) {
        super(new RpcDirectClientAdapter(rpcKernel, injector));
    }
}

export class RpcDirectClientAdapter implements ClientTransportAdapter {
    constructor(public rpcKernel: RpcKernel, protected injector?: RpcInjector) {
    }

    public async connect(connection: TransportConnectionHooks) {
        const kernelConnection = this.rpcKernel.createConnection({ write: (buffer) => connection.onMessage(buffer) }, this.injector);

        connection.onConnected({
            disconnect() {
                kernelConnection.close();
            },
            send(message) {
                queueMicrotask(() => {
                    kernelConnection.feed(message);
                });
            }
        });
    }
}
