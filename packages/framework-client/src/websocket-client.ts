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

import {ClassType} from '@deepkit/core';
import {ClientMessageAll,} from '@deepkit/framework-shared';
import {ClientTransportAdapter, TransportConnectionHooks} from './client';

export class WebSocketClientAdapter implements ClientTransportAdapter {
    protected WebSocket: ClassType<WebSocket> | undefined = 'undefined' !== typeof WebSocket ? WebSocket : undefined;

    constructor(public url: string) {
    }

    public async connect(connection: TransportConnectionHooks) {
        if (!this.WebSocket) {
            const ws = await import('ws');
            this.WebSocket = ws.default as any as ClassType<WebSocket>;
            if (!this.WebSocket) {
                console.error('Package ws returned wrong API', ws);
            }
        }

        const socket = new this.WebSocket(this.url);

        socket.onmessage = (event: MessageEvent) => {
            connection.onMessage(event.data.toString());
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
                send(message: ClientMessageAll) {
                    socket.send(JSON.stringify(message));
                }
            });
        };
    }
}
