import {ClientConnection} from './client-connection';
import {ClientMessageAll, ConnectionWriter, ConnectionWriterStream} from '@super-hornet/framework-shared';
import * as WebSocket from 'ws';
import {Injector, Provider, RpcControllerContainer, ServiceContainer} from '@super-hornet/framework-server-common';
import * as http from 'http';
import {IncomingMessage, ServerResponse} from 'http';
import * as https from 'https';
import {ApplicationServerConfig} from './application-server';
import {HttpHandler} from './http';

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
    protected rootSessionInjector?: Injector;
    protected rootRequestInjector?: Injector;

    constructor(
        protected serviceContainer: ServiceContainer,
    ) {
    }

    createRpcConnection(writer: ConnectionWriterStream, remoteAddress: string = '127.0.0.1'): WorkerConnection {
        let rpcControllerContainer: RpcControllerContainer;

        const provider: Provider[] = [
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

        const injector = new Injector(provider, [this.rootSessionInjector!]);
        rpcControllerContainer = new RpcControllerContainer(this.serviceContainer, injector);
        const clientConnection = injector.get(ClientConnection);

        return new WorkerConnection(clientConnection, async () => {
            await clientConnection.destroy();
        });
    }
}

export class WebWorker extends BaseWorker {
    protected wsServer?: WebSocket.Server;
    protected server?: http.Server | https.Server;
    protected httpHandler: HttpHandler;

    constructor(
        public readonly id: number,
        protected serviceContainer: ServiceContainer,
        options: ApplicationServerConfig,
    ) {
        super(serviceContainer);
        this.httpHandler = serviceContainer.getRootContext().getInjector().get(HttpHandler);

        if (options.server) {
            this.server = options.server;
        } else {
            this.server = new http.Server();
        }
        this.server.listen(options.port, options.host, () => {
            console.log(`Worker #${id} listening on ${options.host}:${options.port}.`);
        });
        this.server.on('request', this.onHttpRequest.bind(this));
    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }

    async onHttpRequest(req: IncomingMessage, res: ServerResponse) {
        const injector = new Injector([
            {provide: IncomingMessage, useValue: req}
        ], [this.rootRequestInjector!]);

        const response = await this.httpHandler.handleRequest(injector, req.method || 'GET', req.url || '/', '');

        if (response instanceof ServerResponse) {
        } else {
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            res.write(response);
            res.end();
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

    async run(): Promise<void> {
        this.rootSessionInjector = this.serviceContainer.getRootContext().createSubInjector('session');
        this.rootRequestInjector = this.serviceContainer.getRootContext().createSubInjector('request');

        this.wsServer = new WebSocket.Server({server: this.server});
        this.wsServer.on('connection', this.onWsConnection.bind(this));
    }
}
