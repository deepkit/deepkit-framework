import {Provider, ReflectiveInjector} from "injection-js";
import {SessionStack} from "./application";
import {ClientConnection} from "./client-connection";
import {EntityStorage} from "./entity-storage";
import {ServerConnectionMiddleware} from "./connection-middleware";
import {ConnectionMiddleware, ConnectionWriter, ConnectionWriterStream} from "@marcj/glut-core";
import {App, us_listen_socket, us_listen_socket_close, WebSocket} from "uWebSockets.js";
import {Exchange} from "./exchange";

export class Worker {
    protected listen?: us_listen_socket;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
        protected options: { host: string, port: number | 'auto' },
    ) {
    }

    close() {
        if (this.listen) {
            us_listen_socket_close(this.listen);
            this.listen = undefined;
        }
    }

    async run(): Promise<number> {
        const injectorMap = new Map<WebSocket, ReflectiveInjector>();

        await (this.mainInjector.get(Exchange) as Exchange).connect();

        const app = App().ws('/*', {
            /* Options */
            compression: 1,
            maxPayloadLength: 2 * 500 * 1024 * 1024, //500mb
            idleTimeout: 0,
            /* Handlers */
            open: (ws, req) => {
                const ip = Buffer.from(ws.getRemoteAddress());
                const ipString = ip[0] + '.' + ip[1] + '.' + ip[2] + '.' + ip[3];

                const provider: Provider[] = [
                    {provide: 'socket', useValue: ws},
                    {provide: 'remoteAddress', useValue: ipString},
                    EntityStorage,
                    SessionStack,
                    ClientConnection,
                    {provide: ConnectionMiddleware, useClass: ServerConnectionMiddleware},
                    {
                        provide: ConnectionWriter, deps: [], useFactory: () => {
                            return new ConnectionWriter(ws);
                        }
                    },
                ];
                provider.push(...this.connectionProvider);
                injectorMap.set(ws, this.mainInjector.resolveAndCreateChild(provider));
            },
            message: async (ws, message: ArrayBuffer, isBinary) => {
                const json = Buffer.from(message).toString();
                await injectorMap.get(ws)!.get(ClientConnection).onMessage(json);
            },
            close: (ws, code, message) => {
                injectorMap.get(ws)!.get(ClientConnection).destroy();
                injectorMap.get(ws)!.get(EntityStorage).destroy();
                injectorMap.delete(ws);
            }
        });

        if ('number' === typeof this.options.port) {
            return await new Promise((resolve, reject) => {
                app.listen(this.options.host, this.options.port as number, (token) => {
                    if (token) {
                        console.log('listen on', this.options.host, this.options.port);
                        this.listen = token;
                        resolve();
                    } else {
                        reject('Failed to listen on ' + this.options.host + ':' + this.options.port);
                    }
                });
            });
        } else {
            let port = 8080;
            while (true) {
                port++;
                const success = await new Promise((resolve, reject) => {
                    app.listen(this.options.host, port, (token) => {
                        if (token) {
                            this.listen = token;
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                });
                if (success) {
                    return port;
                }
            }
        }

    }
}
