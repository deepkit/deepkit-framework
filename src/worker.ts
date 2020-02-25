import {Provider, ReflectiveInjector} from "injection-js";
import {SessionStack} from "./application";
import {ClientConnection} from "./client-connection";
import {EntityStorage} from "./entity-storage";
import {ServerConnectionMiddleware} from "./connection-middleware";
import {ConnectionMiddleware, ConnectionWriter, ConnectionWriterStream} from "@marcj/glut-core";
import {Exchange} from "./exchange";
import * as WebSocket from 'ws';
import {Server} from "http";

export class Worker {
    protected server?: WebSocket.Server;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
        protected options: {
            server?: Server,
            host: string,
            port: number
        },
    ) {
    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }

    async run(): Promise<void> {
        const injectorMap = new Map<WebSocket, ReflectiveInjector>();

        await (this.mainInjector.get(Exchange) as Exchange).connect();

        const options = this.options.server ? {server: this.options.server} : {
            host: this.options.host,
            port: this.options.port
        };

        this.server = new WebSocket.Server(options);

        this.server.on('connection', (ws, req) => {
            const ipString = req.connection.remoteAddress;

            const provider: Provider[] = [
                {provide: 'socket', useValue: ws},
                {provide: 'remoteAddress', useValue: ipString},
                EntityStorage,
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
                await injectorMap.get(ws)!.get(ClientConnection).onMessage(json);
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
