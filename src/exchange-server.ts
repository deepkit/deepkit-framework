import {App, us_listen_socket, us_listen_socket_close, WebSocket} from "uWebSockets.js";
import {decodeMessage, encodeMessage} from "./exchange-prot";
import {ProcessLock, ProcessLocker} from "./process-locker";

export class ExchangeServer {
    protected listen?: us_listen_socket;
    protected locker = new ProcessLocker;
    protected locks: {[name: string]: ProcessLock} = {};

    constructor(
        public readonly host = '127.0.0.1',
        public readonly port = 8561,
    ) {

    }

    close() {
        if (this.listen) {
            us_listen_socket_close(this.listen);
            this.listen = undefined;
        }
    }

    async start() {
        await new Promise((resolve, reject) => {
            App().ws('/*', {
                /* Options */
                compression: 0,
                maxPayloadLength: 50 * 1024 * 1024, //50mb
                idleTimeout: 10,
                /* Handlers */
                open: (ws, req) => {
                    console.log('new ws');
                },
                message: async (ws, message: ArrayBuffer, isBinary) => {
                    this.onMessage(ws, message);
                },
                drain: (ws) => {
                    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
                },
                close: (ws, code, message) => {
                    console.log('close ws');
                }
            }).listen(this.host, this.port, (token) => {
                if (token) {
                    console.log('listen on', this.host, this.port);
                    this.listen = token;
                    resolve();
                } else {
                    reject('Failed to listen on ' + this.host + ':' + this.port);
                }
            });
        });
    }

    protected async onMessage(ws: WebSocket, message: ArrayBuffer) {
        const m = decodeMessage(message);
        console.log('server message', m);

        if (m.type === 'subscribe') {
            ws.subscribe(m.arg);
        }

        if (m.type === 'unsubscribe') {
            ws.unsubscribe(m.arg);
        }

        if (m.type === 'publish') {
            ws.publish(m.arg, message);
        }

        if (m.type === 'lock') {
            this.locks[m.arg] = await this.locker.acquireLock(m.arg);
            ws.send(encodeMessage(m.id, m.type, true));
        }

        if (m.type === 'unlock') {
            if (this.locks[m.arg]) {
                await this.locks[m.arg].unlock();
                delete this.locks[m.arg];
            }
        }

        if (m.type === 'isLocked') {
            const isLocked = !!this.locks[m.arg];
            ws.send(encodeMessage(m.id, m.type, isLocked));
        }
    }
}
