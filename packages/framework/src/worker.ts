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

import {ClientConnection} from './rpc/client-connection';
import {ClientMessageAll, ConnectionWriter, ConnectionWriterStream} from '@deepkit/framework-shared';
import * as WebSocket from 'ws';
import * as http from 'http';
import {IncomingMessage, Server} from 'http';
import * as https from 'https';
import {HttpKernel} from './http';
import {RpcInjectorContext} from './rpc/rpc';
import {InjectorContext} from './injector/injector';
import {Provider} from './injector/provider';
import {injectable, Injector} from './injector/injector';

export class WorkerConnection {
    constructor(
        protected connectionClient: ClientConnection,
        protected onClose: () => Promise<void>
    ) {
    }

    public async write(message: ClientMessageAll) {
        await this.connectionClient.onMessage(message);
    }

    public async close() {
        await this.onClose();
    }
}

export class BaseWorker {
    constructor(
        protected rootScopedContext: InjectorContext
    ) {
    }

    createRpcConnection(writer: ConnectionWriterStream, remoteAddress: string = '127.0.0.1'): WorkerConnection {
        let rpcScopedContext: RpcInjectorContext;

        const providers: Provider[] = [
            ClientConnection,
            {provide: 'remoteAddress', useValue: remoteAddress},
            {provide: RpcInjectorContext, useFactory: () => rpcScopedContext},
            {
                provide: ConnectionWriter, deps: [], useFactory: () => {
                    return new ConnectionWriter(writer);
                }
            },
        ];

        const additionalInjector = new Injector(providers);
        rpcScopedContext = this.rootScopedContext.createChildScope('rpc', additionalInjector);

        const clientConnection = rpcScopedContext.get(ClientConnection);

        return new WorkerConnection(clientConnection, async () => {
            await clientConnection.destroy();
        });
    }
}

@injectable()
export class WebWorkerFactory {
    constructor(protected httpKernel: HttpKernel, protected rootScopedContext: InjectorContext) {
    }

    create(id: number, options: { server?: Server, host: string, port: number }) {
        return new WebWorker(id, this.httpKernel, this.rootScopedContext, options);
    }

    createBase() {
        return new BaseWorker(this.rootScopedContext);
    }
}

@injectable()
export class WebWorker extends BaseWorker {
    protected wsServer?: WebSocket.Server;
    protected server?: http.Server | https.Server;

    constructor(
        public readonly id: number,
        protected httpKernel: HttpKernel,
        protected rootScopedContext: InjectorContext,
        options: { server?: Server, host: string, port: number },
    ) {
        super(rootScopedContext);

        if (options.server) {
            this.server = options.server as Server;
            this.server.on('request', this.httpKernel.handleRequest.bind(this.httpKernel));
        } else {
            this.server = new http.Server(this.httpKernel.handleRequest.bind(this.httpKernel));
            this.server.keepAliveTimeout = 5000;
            this.server.listen(options.port, options.host, () => {
                // console.log(`Worker #${id} listening on ${options.host}:${options.port}.`);
            });
        }

        this.wsServer = new WebSocket.Server({server: this.server});
        this.wsServer.on('connection', this.onWsConnection.bind(this));
    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }

    onWsConnection(ws: WebSocket, req: IncomingMessage) {
        const connection = this.createRpcConnection(new class implements ConnectionWriterStream {
            async send(v: string): Promise<boolean> {
                ws.send(v, (err) => {
                    if (err) {
                        ws.close();
                    }
                });
                return true;
            }

            bufferedAmount(): number {
                return ws.bufferedAmount;
            }
        }, req.connection.remoteAddress);

        ws.on('message', async (message: any) => {
            const json = 'string' === typeof message ? message : Buffer.from(message).toString();
            await connection.write(JSON.parse(json));
        });

        ws.on('error', async (error: any) => {
            console.error('Error in WS', error);
        });

        const interval = setInterval(() => {
            ws.ping();
        }, 15_000);

        ws.on('close', async () => {
            clearInterval(interval);
            await connection.close();
        });
    }
}
