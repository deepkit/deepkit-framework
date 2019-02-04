import * as WebSocket from "ws";
import {ServerOptions} from "ws";
import {Provider, ReflectiveInjector} from "injection-js";
import {Subscription} from "rxjs";
import {Application, Session} from "./application-server";
import {Connection} from "./connection";

export class Worker {
    protected subscriptions = new Map<WebSocket, { [messageId: string]: Subscription }>();

    protected session?: Session;

    constructor(
        protected mainInjector: ReflectiveInjector,
        protected provider: Provider[],
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

        wss.on('connection', (socket: WebSocket) => {

            const provider: Provider[] = [
                {provide: 'WebSocket', useValue: socket},
                {provide: Session, useValue: this.session},
            ];

            provider.push(...this.provider);

            const injector = this.mainInjector.resolveAndCreateChild(provider);
            const connection = new Connection(socket, injector);

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
