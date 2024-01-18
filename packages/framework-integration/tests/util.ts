import { arrayRemoveItem, ClassType, sleep } from '@deepkit/core';
import { ApplicationServer, FrameworkModule } from '@deepkit/framework';
import { App, AppModule, onAppShutdown } from '@deepkit/app';
import { Observable } from 'rxjs';
import { createServer } from 'http';
import { DeepkitClient, RemoteController } from '@deepkit/rpc';
import { Database } from '@deepkit/orm';
import { performance } from 'perf_hooks';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

export async function subscribeAndWait<T>(observable: Observable<T>, callback: (next: T) => Promise<void>, timeout: number = 5): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const sub = observable.subscribe((next) => {
            callback(next);
            sub.unsubscribe();
            resolve();
        }, (error) => {
            reject(error);
        });
        setTimeout(() => {
            sub.unsubscribe();
            reject('Subscribe timeout');
        }, timeout * 1000);
    });
}

const closer: (() => Promise<void>)[] = [];

// doesn't work yet automatically
// afterEach(async () => {
//     for (const close of closer) {
//         await close();
//     }
// });

export async function closeAllCreatedServers() {
    for (const close of closer) {
        await close();
    }
}

export function appModuleForControllers(controllers: ClassType[], entities: ClassType[] = []): AppModule<any> {
    class MyDatabase extends Database {
        constructor() {
            super(new SQLiteDatabaseAdapter(), entities);
        }
    }

    return new AppModule({
        controllers: controllers,
        providers: [
            { provide: Database, useClass: MyDatabase },
        ],
        imports: [
            new FrameworkModule
        ]
    });
}

export async function createServerClientPair(
    name: string,
    appModule: AppModule<any>
): Promise<{
    app: App<any>,
    server: ApplicationServer,
    client: DeepkitClient,
    close: () => Promise<void>,
    createClient: () => DeepkitClient,
    createControllerClient: <T>(controllerName: string) => RemoteController<T>
}> {
    const socketPath = '/tmp/ws_socket_' + performance.now() + '.' + Math.floor(Math.random() * 1000);
    const exchangeSocketPath = socketPath + '_exchange';

    const server = createServer();
    await new Promise((resolve) => {
        server.listen(socketPath, function () {
            resolve(undefined);
        });
    });

    appModule.setup((module) => {
        module.getImportedModuleByClass(FrameworkModule).configure({
            server: server,
            broker: { listen: exchangeSocketPath, host: exchangeSocketPath, startOnBootstrap: true },
        });
    });

    const app = App.fromModule(appModule);

    const appServer = app.get(ApplicationServer);
    await appServer.start();
    const createdClients: DeepkitClient[] = [];
    const socket = new DeepkitClient('ws+unix://' + socketPath);

    createdClients.push(socket);
    let closed = false;

    const close = async () => {
        arrayRemoveItem(closer, close);

        if (closed) {
            return;
        }

        // await db.dropDatabase(dbName);
        closed = true;
        server.close();

        for (const client of createdClients) {
            try {
                client.disconnect();
            } catch (error) {
                console.error('failed disconnecting client');
                throw error;
            }
        }

        await sleep(0.1); //let the server read the disconnect
        const start = performance.now();
        await appServer.close();
        console.log('server closed', performance.now() - start);
    };

    closer.push(close);
    return {
        app,
        server: appServer,
        client: socket,
        createClient: () => {
            const client = new DeepkitClient('ws+unix://' + socketPath);
            createdClients.push(client);
            return client;
        },
        createControllerClient: <T>(controllerName: string): RemoteController<T> => {
            const client = new DeepkitClient('ws+unix://' + socketPath);
            createdClients.push(client);
            return client.controller<T>(controllerName);
        },
        close: close,
    };
}
