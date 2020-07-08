import {ClientConnection} from "./client-connection";
import {ClientMessageAll, ConnectionWriter, ConnectionWriterStream} from "@super-hornet/framework-shared";
import * as WebSocket from 'ws';
import {ControllerContainer, Provider, ServiceContainer} from "@super-hornet/framework-server-common";

export class WorkerConnection {
    constructor(
        protected connectionClient: ClientConnection,
        protected onClose: () => Promise<void>
    ) {
    }

    public async write(message: ClientMessageAll) {
        await this.connectionClient.onMessage(message);
    }

    public async close(){
        await this.onClose();
    }
}

export class BaseWorker {
    constructor(
        protected serviceContainer: ServiceContainer,
    ) {}

    createConnection(writer: ConnectionWriterStream, remoteAddress: string = '127.0.0.1'): WorkerConnection {
        let controllerContainer: ControllerContainer;

        const provider: Provider[] = [
            {provide: 'remoteAddress', useValue: remoteAddress},
            {
                provide: ControllerContainer, useFactory: () => {
                    return controllerContainer;
                }
            },
            {
                provide: ConnectionWriter, deps: [], useFactory: () => {
                    return new ConnectionWriter(writer);
                }
            },
        ];

        const injector = this.serviceContainer.getRootContext().createSubInjector('session', provider);
        controllerContainer = new ControllerContainer(this.serviceContainer, injector);
        const clientConnection = injector.get(ClientConnection);

        return new WorkerConnection(clientConnection, async () => {
            await clientConnection.destroy();
        });
    }
}

export class WebSocketWorker extends BaseWorker {
    protected server?: WebSocket.Server;
    protected options: WebSocket.ServerOptions;

    constructor(
        protected serviceContainer: ServiceContainer,
        options: WebSocket.ServerOptions,
    ) {
        super(serviceContainer);
        this.options = {...options};
        if (this.options.server) {
            delete this.options.host;
            delete this.options.port;
        }
    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }

    async run(): Promise<void> {
        this.server = new WebSocket.Server(this.options);

        this.server.on('connection', (ws, req) => {
            const ipString = req.connection.remoteAddress;

            const connection = this.createConnection(new class implements ConnectionWriterStream {
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
        });
    }
}
