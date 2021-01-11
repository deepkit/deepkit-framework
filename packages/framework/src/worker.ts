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

import { ConnectionWriter, RpcConnectionWriter, RpcKernel, RpcKernelBaseConnection, RpcKernelConnection } from '@deepkit/rpc';
import http, { Server } from 'http';
import https from 'https';
import WebSocket from 'ws';
import { HttpKernel } from './http';
import { HttpRequest, HttpResponse } from './http-model';
import { injectable, Injector, InjectorContext } from './injector/injector';
import { Provider } from './injector/provider';
import { DeepkitRpcSecurity, RpcInjectorContext } from './rpc';
import { RpcControllers } from './service-container';

@injectable()
export class WebWorkerFactory {
    constructor(protected httpKernel: HttpKernel, protected rpcControllers: RpcControllers, protected rootScopedContext: InjectorContext) {
    }

    create(id: number, options: { server?: Server, host: string, port: number }): WebWorker {
        return new WebWorker(id, this.httpKernel, this.createRpcKernel(), this.rootScopedContext, options);
    }

    createRpcKernel() {
        const security = this.rootScopedContext.get(DeepkitRpcSecurity);
        const kernel = new RpcKernel(this.rootScopedContext, security);

        for (const [name, controller] of this.rpcControllers.controllers.entries()) {
            kernel.registerController(name, controller);
        }

        return kernel;
    }
}

export class WebMemoryWorkerFactory extends WebWorkerFactory {
    create(id: number, options: { server?: Server, host: string, port: number }): WebMemoryWorker {
        return new WebMemoryWorker(id, this.httpKernel, this.createRpcKernel(), this.rootScopedContext, options);
    }
}

export function createRpcConnection(rootScopedContext: InjectorContext, rpcKernel: RpcKernel, writer: RpcConnectionWriter, request?: HttpRequest) {
    let rpcScopedContext: RpcInjectorContext;
    let connection: RpcKernelConnection;

    const providers: Provider[] = [
        { provide: HttpRequest, useValue: request },
        { provide: RpcInjectorContext, useFactory: () => rpcScopedContext },
        { provide: RpcKernelConnection, useFactory: () => connection },
        { provide: RpcKernelBaseConnection, useFactory: () => connection },
        { provide: ConnectionWriter, useValue: writer },
    ];
    const additionalInjector = new Injector(providers);
    rpcScopedContext = rootScopedContext.createChildScope('rpc', additionalInjector);

    connection = rpcKernel.createConnection(writer, rpcScopedContext);
    return connection;
}

@injectable()
export class WebWorker {
    protected wsServer?: WebSocket.Server;
    protected server?: http.Server | https.Server;

    constructor(
        public readonly id: number,
        public httpKernel: HttpKernel,
        public rpcKernel: RpcKernel,
        protected rootScopedContext: InjectorContext,
        protected options: { server?: Server, host: string, port: number },
    ) {
    }

    start() {
        if (this.options.server) {
            this.server = this.options.server as Server;
            this.server.on('request', this.httpKernel.handleRequest.bind(this.httpKernel));
        } else {
            this.server = new http.Server(
                { IncomingMessage: HttpRequest, ServerResponse: HttpResponse },
                this.httpKernel.handleRequest.bind(this.httpKernel) as any //as any necessary since http.Server is not typed correctly
            );
            this.server.keepAliveTimeout = 5000;
            this.server.listen(this.options.port, this.options.host, () => {
                // console.log(`Worker listening on ${this.options.host}:${this.options.port}.`);
            });
        }

        this.wsServer = new WebSocket.Server({ server: this.server });
        this.wsServer.on('connection', (ws, req: HttpRequest) => {
            const connection = createRpcConnection(this.rootScopedContext, this.rpcKernel, {
                write(b) {
                    ws.send(b);
                },
                bufferedAmount(): number {
                    return ws.bufferedAmount;
                }
            }, req);

            ws.on('message', async (message: any) => {
                connection.feed(message);
            });

            ws.on('close', async () => {
                connection.close();
            });
        });
    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }
}

export class WebMemoryWorker extends WebWorker {
    start() { }
}