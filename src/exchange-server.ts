import {App, us_listen_socket, us_listen_socket_close, WebSocket} from "uWebSockets.js";
import {decodeMessage, decodePayloadAsJson, encodeMessage} from "./exchange-prot";
import {ProcessLock, ProcessLocker} from "./process-locker";
import { Injectable } from "injection-js";

@Injectable()
export class ExchangeServer {
    protected listen?: us_listen_socket;
    protected locker = new ProcessLocker;
    protected locks: { [name: string]: ProcessLock } = {};

    protected storage: { [key: string]: any } = {};
    protected entityFields: { [key: string]: { [field: string]: number } } = {};

    constructor(
        public readonly host = '127.0.0.1',
        public port = 8561,
    ) {

    }

    close() {
        if (this.listen) {
            us_listen_socket_close(this.listen);
            this.listen = undefined;
        }
    }

    async start() {
        const app = App().ws('/*', {
            /* Options */
            compression: 0,
            maxPayloadLength: 50 * 1024 * 1024, //50mb
            idleTimeout: 0,
            /* Handlers */
            open: (ws, req) => {
                console.log('new exchange client');
            },
            message: async (ws, message: ArrayBuffer, isBinary) => {
                this.onMessage(ws, message);
            },
            drain: (ws) => {
                console.log('WebSocket exchange backpressure: ' + ws.getBufferedAmount());
            },
            close: (ws, code, message) => {
            }
        });

        while (!await new Promise((resolve, reject) => {
            app.listen(this.host, this.port, (token) => {
                if (token) {
                    console.log('listen on', this.host, this.port);
                    this.listen = token;
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        })) {
            this.port++;
        }
    }

    protected async onMessage(ws: WebSocket, message: ArrayBuffer) {
        const m = decodeMessage(message);
        // console.log('server message', message.toString(), m);

        if (m.type === 'subscribe') {
            ws.subscribe(m.arg);
        }

        if (m.type === 'unsubscribe') {
            ws.unsubscribe(m.arg);
        }

        if (m.type === 'get') {
            ws.send(encodeMessage(m.id, m.type, m.arg, this.storage[m.arg]));
        }

        if (m.type === 'set') {
            this.storage[m.arg] = m.payload;
        }

        if (m.type === 'del') {
            delete this.storage[m.arg];
        }

        if (m.type === 'entity-subscribe-fields') {
            if (!this.entityFields[m.arg]) {
                this.entityFields[m.arg] = {};
            }
            const fields = decodePayloadAsJson(m.payload);
            for (const field of fields) {
                if (!this.entityFields[m.arg][field]) {
                    this.entityFields[m.arg][field] = 0;
                }
                this.entityFields[m.arg][field]++;
            }
        }

        if (m.type === 'del-entity-subscribe-fields') {
            if (!this.entityFields[m.arg]) {
                this.entityFields[m.arg] = {};
            }
            const fields = decodePayloadAsJson(m.payload);
            for (const field of fields) {
                this.entityFields[m.arg][field]--;
                if (this.entityFields[m.arg][field] <= 0) {
                    delete this.entityFields[m.arg][field];
                }
            }
        }

        if (m.type === 'get-entity-subscribe-fields') {
            const reply = encodeMessage(m.id, m.type, Object.keys(this.entityFields[m.arg] || {}));
            ws.send(reply);
        }

        if (m.type === 'publish') {
            ws.publish(m.arg, message);
        }

        if (m.type === 'lock') {
            const [name, timeout] = m.arg.split('$$');
            this.locks[name] = await this.locker.acquireLock(name, parseInt(timeout, 10));
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
