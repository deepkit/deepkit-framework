import {ClientConnection} from "./client-connection";
import {ConnectionWriter, ConnectionWriterStream} from "@super-hornet/framework-shared";
import * as WebSocket from 'ws';
import {Injector, Provider, ServiceContainer} from "@super-hornet/framework-server-common";

export class Worker {
    protected server?: WebSocket.Server;
    protected options: WebSocket.ServerOptions;

    constructor(
        protected serviceContainer: ServiceContainer,
        options: WebSocket.ServerOptions,
    ) {
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


            const provider: Provider[] = [
                {provide: WebSocket, useValue: ws},
                {provide: 'remoteAddress', useValue: ipString},
                {
                    provide: ConnectionWriter, deps: [], useFactory: () => {
                        return new ConnectionWriter(new class implements ConnectionWriterStream {
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
                        });
                    }
                },
            ];

            //todo, this is not yet the correct way to instantiate a session injector, is it?
            // controller classes need their own context injector, otherwise module providers are not available.
            const injector = this.serviceContainer.getRootContext().createInjector('session', provider);

            ws.on('message', async (message: any) => {
                const json = 'string' === typeof message ? message : Buffer.from(message).toString();
                await injector.get(ClientConnection).onMessage(JSON.parse(json));
            });

            ws.on('error', async (error: any) => {
                console.error('Error in WS', error);
            });

            const interval = setInterval(() => {
                ws.ping();
            }, 15_000);

            ws.on('close', async () => {
                clearInterval(interval);
                injector.get(ClientConnection).destroy();
            });
        });
    }
}
