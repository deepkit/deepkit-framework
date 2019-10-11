import {Provider, ReflectiveInjector} from "injection-js";
import {SessionStack} from "./application";
import {ClientConnection} from "./client-connection";
import {EntityStorage} from "./entity-storage";
import {ConnectionMiddleware} from "./connection-middleware";
import {ConnectionWriter} from "./connection-writer";
import {us_listen_socket, us_listen_socket_close, App, WebSocket} from "uWebSockets.js";
import {Exchange} from "./exchange";

export class Worker {
    protected listen?: us_listen_socket;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
        protected options: { host: string, port: number },
    ) {
    }

    close() {
        if (this.listen) {
            us_listen_socket_close(this.listen);
            this.listen = undefined;
        }
    }

    async run() {
        const injectorMap = new Map<WebSocket, ReflectiveInjector>();

        await (this.mainInjector.get(Exchange) as Exchange).connect();

        await new Promise((resolve, reject) => {
            App().ws('/*', {
                /* Options */
                compression: 0,
                maxPayloadLength: 2 * 100 * 1024 * 1024, //200mb
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
                        ConnectionMiddleware,
                        ConnectionWriter
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
                    injectorMap.delete(ws);
                }
            }).listen(this.options.host, this.options.port, (token) => {
                if (token) {
                    console.log('listen on', this.options.host, this.options.port);
                    this.listen = token;
                    resolve();
                } else {
                    reject('Failed to listen on ' + this.options.host + ':' + this.options.port);
                }
            });
        });
    }
}
