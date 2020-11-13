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

import {ClientConnection} from './client-connection';
import {ClientMessageAll, ConnectionWriter, ConnectionWriterStream} from '@deepkit/framework-shared';
import * as WebSocket from 'ws';
import * as http from 'http';
import {IncomingMessage, ServerResponse} from 'http';
import * as https from 'https';
import {ApplicationConfig} from './application-config';
import {HttpKernel} from './http';
import {RpcControllerContainer, ServiceContainer} from './service-container';
import {Provider} from './injector/provider';
import {Injector} from './injector/injector';

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
    protected rootInjector = this.serviceContainer.getRootContext().getInjector();
    protected rootSessionInjector = this.serviceContainer.getRootContext().getSessionInjector();

    constructor(
        protected serviceContainer: ServiceContainer
    ) {
    }

    createRpcConnection(writer: ConnectionWriterStream, remoteAddress: string = '127.0.0.1'): WorkerConnection {
        let rpcControllerContainer: RpcControllerContainer;

        const providers: Provider[] = [
            ClientConnection,
            {provide: 'remoteAddress', useValue: remoteAddress},
            {
                provide: RpcControllerContainer, useFactory: () => {
                    return rpcControllerContainer;
                }
            },
            {
                provide: ConnectionWriter, deps: [], useFactory: () => {
                    return new ConnectionWriter(writer);
                }
            },
        ];


        //this sessionInjector MUST be used as new root for all controller context session injectors
        const sessionInjector = new Injector(providers, [this.serviceContainer.getRootContext().getSessionInjector().fork()]);
        rpcControllerContainer = new RpcControllerContainer(this.serviceContainer.rpcControllers, sessionInjector);

        const injector = new Injector([], [this.serviceContainer.getRootContext().getInjector(), sessionInjector]);
        const clientConnection = injector.get(ClientConnection);

        return new WorkerConnection(clientConnection, async () => {
            await clientConnection.destroy();
        });
    }
}

export class WebWorker extends BaseWorker {
    protected wsServer?: WebSocket.Server;
    protected server?: http.Server | https.Server;
    protected httpHandler: HttpKernel;
    protected rootRequestInjector = this.serviceContainer.getRootContext().getRequestInjector();

    constructor(
        public readonly id: number,
        protected serviceContainer: ServiceContainer,
        options: ApplicationConfig,
    ) {
        super(serviceContainer);
        this.httpHandler = serviceContainer.getRootContext().getInjector().get(HttpKernel);

        if (options.server) {
            this.server = options.server;
            this.server.on('request', this.onHttpRequest.bind(this));
        } else {
            this.server = new http.Server(this.onHttpRequest.bind(this));
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

    async onHttpRequest(req: IncomingMessage, res: ServerResponse) {
        await this.httpHandler.handleRequest(req, res);
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
