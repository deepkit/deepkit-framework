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

import { ClientTransportAdapter, RpcClient, TransportConnectionHooks } from './client';
import { RpcKernel } from '../server/kernel';
import { readRpcMessage } from '../protocol';

export class DirectClient extends RpcClient {
    constructor(rpcKernel: RpcKernel) {
        super(new RpcDirectClientAdapter(rpcKernel));
    }
}

export class RpcDirectClientAdapter implements ClientTransportAdapter {
    constructor(public rpcKernel: RpcKernel) {
    }

    public async connect(connection: TransportConnectionHooks) {
        const kernelConnection = this.rpcKernel.createConnection({ write: (buffer) => connection.onMessage(buffer) });

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
