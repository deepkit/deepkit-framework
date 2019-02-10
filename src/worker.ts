import * as WebSocket from "ws";
import {ServerOptions} from "ws";
import {Provider, ReflectiveInjector} from "injection-js";
import {Application, Session, SessionStack} from "./application";
import {Connection} from "./connection";
import {EntityStorage} from "./entity-storage";

export class Worker {
    protected wss?: WebSocket.Server;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected connectionProvider: Provider[],
        protected options: ServerOptions,
    ) {
    }

    protected async authenticate(token: any): Promise<Session> {
        const app: Application = this.mainInjector.get(Application);
        return await app.authenticate(token);
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
                Connection,
                ConnectionMiddleware,
                ConnectionWriter,
                {
                    provide: 'injector', useValue: (name: string) => {
                        return injector!.get(name);
                    }
                },
            ];

            provider.push(...this.connectionProvider);

            injector = this.mainInjector.resolveAndCreateChild(provider);
            const connection: Connection = injector.get(Connection);

            socket.on('message', async (raw: string) => {
                await connection.onMessage(raw);
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
