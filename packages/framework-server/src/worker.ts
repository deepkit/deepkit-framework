import {Provider, ReflectiveInjector} from "injection-js";
import {SessionStack} from "./application";
import {ClientConnection} from "./client-connection";
import {EntityStorage} from "./entity-storage";
import {ServerConnectionMiddleware} from "./connection-middleware";
import {ConnectionMiddleware, ConnectionWriter, ConnectionWriterStream} from "@super-hornet/framework-core";
import {Exchange} from "./exchange";
import * as WebSocket from 'ws';

export class Worker {
    protected server?: WebSocket.Server;
    protected options: WebSocket.ServerOptions;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
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
        const injectorMap = new Map<WebSocket, ReflectiveInjector>();

        await (this.mainInjector.get(Exchange) as Exchange).connect();

        this.server = new WebSocket.Server(this.options);

        this.server.on('connection', (ws, req) => {
            const ipString = req.connection.remoteAddress;

            const provider: Provider[] = [
                {provide: 'socket', useValue: ws},
                {provide: 'remoteAddress', useValue: ipString},
                SessionStack,
                ClientConnection,
                {provide: ConnectionMiddleware, useClass: ServerConnectionMiddleware},
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
            provider.push(...this.connectionProvider);
            injectorMap.set(ws, this.mainInjector.resolveAndCreateChild(provider));

            ws.on('message', async (message: any) => {
                const json = Buffer.from(message).toString();
                await injectorMap.get(ws)!.get(ClientConnection).onMessage(JSON.parse(json));
            });

            ws.on('error', async (error: any) => {
                console.error('Error in WS', error);
            });

            const interval = setInterval(() => {
                ws.ping();
            }, 15_000);

            ws.on('close', async () => {
                clearInterval(interval);
                injectorMap.get(ws)!.get(ClientConnection).destroy();
                injectorMap.get(ws)!.get(EntityStorage).destroy();
                injectorMap.delete(ws);
            });
        });
    }
}
