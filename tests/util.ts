import 'jest';
import {ClassType} from "@marcj/marshal";
import {Application, ApplicationServer} from "@marcj/glut-server";
import {SocketClient} from "@marcj/glut-client";
import {createServer} from "http";
import {Observable} from "rxjs";
import {sleep} from "@marcj/estdlib";

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

export async function createServerClientPair(
    controllers: ClassType<any>[],
    entityChangeFeeds: ClassType<any>[] = [],
): Promise<{ server: ApplicationServer, client: SocketClient, close: () => Promise<void> }> {
    const socketPath = '/tmp/ws_socket_' + new Date().getTime() + '.' + Math.floor(Math.random() * 1000);
    const server = createServer();

    await new Promise((resolve) => {
        server.listen(socketPath, function () {
            resolve();
        });
    });

    const app = new ApplicationServer(Application, {
        server: server
    }, [], [], controllers, entityChangeFeeds);

    await app.start();

    const socket = new SocketClient({
        host: 'ws+unix://' + socketPath
    });

    let closed = false;

    const close = async () => {
        if (closed) {
            return;
        }
        closed = true;

        socket.disconnect();

        await sleep(0.1); //let the server read the disconnect
        server.close();
        await app.close();
    };

    closer.push(close);
    return {
        server: app,
        client: socket,
        close: close,
    };
}
