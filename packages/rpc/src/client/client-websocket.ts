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

export class DeepkitClient extends RpcClient {
    constructor(url: string) {
        super(new RpcWebSocketClientAdapter(url));
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
