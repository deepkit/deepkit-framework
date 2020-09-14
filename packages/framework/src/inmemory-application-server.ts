import {Client, TransportConnectionHooks} from '@deepkit/framework-client';
import {ClientMessageAll} from '@deepkit/framework-shared';
import {BaseWorker} from './worker';
import {ApplicationServer} from './application-server';
import {injectable} from './injector/injector';

@injectable()
export class InMemoryApplicationServer extends ApplicationServer {
    async start(): Promise<void> {
        await this.bootstrap();
    }

    public createClient() {
        const serviceContainer = this.serviceContainer;

        return new Client({
            connect(connectionHooks: TransportConnectionHooks) {
                const worker = new BaseWorker(serviceContainer);

                const connection = worker.createRpcConnection({
                    async send(json: string): Promise<boolean> {
                        //server-to-client
                        connectionHooks.onMessage(json);
                        return true;
                    },

                    bufferedAmount(): number {
                        return 0;
                    }
                });

                connectionHooks.onConnected({
                    send(message: ClientMessageAll) {
                        //client-to-server
                        connection.write(message).catch(console.error);
                    },
                    disconnect() {
                    }
                });
            }
        });
    }
}
