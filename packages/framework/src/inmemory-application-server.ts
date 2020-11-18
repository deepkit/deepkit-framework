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

import {Client, TransportConnectionHooks} from '@deepkit/framework-client';
import {ClientMessageAll} from '@deepkit/framework-shared';
import {BaseWorker} from './worker';
import {ApplicationServer} from './application-server';
import {injectable} from './injector/injector';

@injectable()
export class InMemoryApplicationServer extends ApplicationServer {
    async start(): Promise<void> {
        await this.bootstrap();
    }

    async close(): Promise<void> {
        await this.shutdown();
    }

    public createClient() {
        const factory = this.webWorkerFactory;

        return new Client({
            connect(connectionHooks: TransportConnectionHooks) {
                const worker = factory.createBase();

                const connection = worker.createRpcConnection({
                    async send(json: string): Promise<boolean> {
                        //server-to-client
                        connectionHooks.onMessage(json);
                        return true;
                    },

                    bufferedAmount(): number {
                        return 0;
                    }
                });

                connectionHooks.onConnected({
                    send(message: ClientMessageAll) {
                        //client-to-server
                        connection.write(message).catch(console.error);
                    },
                    disconnect() {
                    }
                });
            }
        });
    }
}
