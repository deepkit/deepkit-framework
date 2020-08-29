import {ApplicationServer} from "./application-server";
import {Client, TransportConnectionHooks} from "@super-hornet/framework-client";
import {ClientMessageAll} from "@super-hornet/framework-shared";
import {BaseWorker} from "./worker";

export class InMemoryApplicationServer extends ApplicationServer {
    async start(): Promise<void> {
        await this.bootstrap();
        await this.bootstrapMain();
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
