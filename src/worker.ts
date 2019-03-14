import * as WebSocket from "ws";
import {ServerOptions} from "ws";
import {Provider, ReflectiveInjector} from "injection-js";
import {SessionStack} from "./application";
import {CientConnection} from "./cient-connection.service";
import {EntityStorage} from "./entity-storage";
import {ConnectionMiddleware} from "./connection-middleware";
import {ConnectionWriter} from "./connection-writer";

export class Worker {
    protected wss?: WebSocket.Server;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
        protected options: ServerOptions,
    ) {
    }

    close() {
        if (this.wss) {
            this.wss.close();
        }
    }

    run() {
        this.wss = new WebSocket.Server(this.options);

        this.wss.on('connection', (socket: WebSocket) => {
            let injector: ReflectiveInjector | undefined;

            const provider: Provider[] = [
                {provide: 'socket', useValue: socket},
                EntityStorage,
                SessionStack,
                CientConnection,
                ConnectionMiddleware,
                ConnectionWriter
            ];

            provider.push(...this.connectionProvider);

            injector = this.mainInjector.resolveAndCreateChild(provider);
            const connection: CientConnection = injector.get(CientConnection);

            socket.on('message', async (raw: string) => {
                try {
                    await connection.onMessage(raw);
                } catch (error) {
                    console.error('Error on connection message');
                    console.error(error);
                    console.error('Got message:');
                    console.error(raw);
                }
            });

            socket.on('close', async (data: object) => {
                connection.destroy();

                console.log('close from server', data);
            });

            socket.on('error', (error: any) => {
                console.log('error');
                console.log('error from client: ', error);
            });

        });
    }
}
