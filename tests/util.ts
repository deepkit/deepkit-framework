import {ClassType} from "@marcj/marshal";
import {Application, ApplicationServer} from "@kamille/server";
import {SocketClient} from "@kamille/client";
import {createServer} from "http";
import {Observable} from "rxjs";

export async function subscribeAndWait<T>(observable: Observable<T>, callback: (next: T) => Promise<void>, timeout: number = 5): Promise<void> {
    return new Promise((resolve, reject) => {
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

export async function createServerClientPair(
    controllers: ClassType<any>[]
): Promise<{ server: ApplicationServer, client: SocketClient, close: () => void }> {
    const socketPath = '/tmp/ws_socket_' + new Date().getTime() + '.' + Math.floor(Math.random() * 1000);
    const server = createServer();

    await new Promise((resolve) => {
        server.listen(socketPath, function () {
            resolve();
        });
    });

    const app = new ApplicationServer(Application, {
        server: server
    }, [], [], controllers);

    await app.start();

    const socket = new SocketClient({
        host: 'ws+unix://' + socketPath
    });

    return {
        server: app,
        client: socket,
        close: () => {
            socket.disconnect();
            app.close();
            server.close();
        }
    };
}
