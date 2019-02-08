import * as WebSocket from "ws";
import {ServerOptions} from "ws";
import {Provider, ReflectiveInjector} from "injection-js";
import {Subscription} from "rxjs";
import {Application, Session, SessionStack} from "./application";
import {Connection} from "./connection";
import {EntityStorage} from "./entity-storage";

export class Worker {
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

    run() {
        const log = console.log;
        console.log = (...args: any[]) => {
            log(`[${process.pid}]`, ...args);
        };

        const wss = new WebSocket.Server({host: this.options.host, port: this.options.port});

        console.log('Worker listening on', this.options.host + ':' + this.options.port);
        wss.on('connection', (socket: WebSocket) => {

            let injector: ReflectiveInjector | undefined;
            const app = this.mainInjector.get(Application);

            const sessionStack = new SessionStack;
            const connection = new Connection(app, socket, sessionStack, (name) => {
                return injector!.get(name);
            });

            const provider: Provider[] = [
                {provide: 'WebSocket', useValue: socket},
                EntityStorage,
                {provide: Connection, useValue: connection},
                {provide: SessionStack, useValue: sessionStack},
            ];

            provider.push(...this.connectionProvider);

            injector = this.mainInjector.resolveAndCreateChild(provider);

            socket.on('message', async (raw: string) => {
                connection.onMessage(raw);
            });

            socket.on('close', async (data: object) => {
                connection.destroy();

                console.log('close from server', data);
            });

            socket.on('error', (error: any) => {
                console.log('error from client: ', error);
            });

        });
    }
}
