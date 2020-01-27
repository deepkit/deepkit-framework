import {App, us_listen_socket, us_listen_socket_close, WebSocket} from "uWebSockets.js";
import {decodeMessage, encodeMessage} from "./exchange-prot";
import {ProcessLock, ProcessLocker} from "./process-locker";
import {Injectable} from "injection-js";
import {Subscriptions} from "@marcj/estdlib-rxjs";
import {Subscription} from "rxjs";

interface StatePerConnection {
    subs: Subscriptions;
    locks: Map<string, ProcessLock>;
    subscribedEntityFields: Map<number, Subscription>;
}

@Injectable()
export class ExchangeServer {
    protected listen?: us_listen_socket;
    protected locker = new ProcessLocker;
    protected locks: { [name: string]: ProcessLock } = {};
    protected storage: { [key: string]: any } = {};
    protected entityFields: { [key: string]: { [field: string]: number } } = {};

    protected statePerConnection = new Map<WebSocket, StatePerConnection>();

    protected version = 0;

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
                this.statePerConnection.set(ws, {
                    subs: new Subscriptions(),
                    locks: new Map(),
                    subscribedEntityFields: new Map(),
                });
            },
            message: async (ws, message: ArrayBuffer, isBinary) => {
                this.onMessage(ws, message, this.statePerConnection.get(ws)!);
            },
            close: (ws, code, message) => {
                const statePerConnection = this.statePerConnection.get(ws)!;

                //clean up stuff that hasn't been freed
                statePerConnection.subs.unsubscribe();
                for (const lock of statePerConnection.locks.values()) {
                    lock.unlock();
                }
                for (const subscribedEntityField of statePerConnection.subscribedEntityFields.values()) {
                    subscribedEntityField.unsubscribe();
                }

                this.statePerConnection.delete(ws);
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

    protected async onMessage(ws: WebSocket, message: ArrayBuffer, state: StatePerConnection) {
        const m = decodeMessage(message);
        // console.log('server message', message.toString(), m);

        if (m.type === 'subscribe') {
            ws.subscribe(m.arg);
            return;
        }

        if (m.type === 'unsubscribe') {
            ws.unsubscribe(m.arg);
            return;
        }

        if (m.type === 'get') {
            ws.send(encodeMessage(m.id, m.type, m.arg, this.storage[m.arg]), true);
            return;
        }

        if (m.type === 'set') {
            this.storage[m.arg] = m.payload;
            return;
        }

        if (m.type === 'increase') {
            const [key, increase] = m.arg;
            this.storage[key] = (this.storage[key] + increase) || increase;
            return;
        }

        if (m.type === 'del') {
            delete this.storage[m.arg];
            return;
        }

        if (m.type === 'entity-subscribe-fields') {
            const [entityName, fields] = m.arg;
            if (!this.entityFields[entityName]) {
                this.entityFields[entityName] = {};
            }

            for (const field of fields) {
                if (!this.entityFields[entityName][field]) {
                    this.entityFields[entityName][field] = 0;
                }
                this.entityFields[entityName][field]++;
            }

            const reset = new Subscription(() => {
                if (!this.entityFields[entityName]) return;

                for (const field of fields) {
                    this.entityFields[entityName][field]--;
                    if (this.entityFields[entityName][field] <= 0) {
                        delete this.entityFields[entityName][field];
                    }
                }
            });
            state.subscribedEntityFields.set(m.id, reset);
            return;
        }

        if (m.type === 'del-entity-subscribe-fields') {
            const forMessageId = m.arg as number;
            if (state.subscribedEntityFields.has(forMessageId)) {
                state.subscribedEntityFields.get(forMessageId)!.unsubscribe();
                state.subscribedEntityFields.delete(forMessageId);
            }
            return;
        }

        if (m.type === 'get-entity-subscribe-fields') {
            const reply = encodeMessage(m.id, m.type, Object.keys(this.entityFields[m.arg] || {}));
            ws.send(reply, true);
            return;
        }

        if (m.type === 'publish') {
            ws.publish(m.arg, message, true);
            return;
        }

        if (m.type === 'lock') {
            const [name, timeout] = m.arg;
            this.locks[name] = await this.locker.acquireLock(name, timeout);
            state.locks.set(m.arg, this.locks[name]);
            ws.send(encodeMessage(m.id, m.type, true), true);
            return;
        }

        if (m.type === 'unlock') {
            if (this.locks[m.arg]) {
                this.locks[m.arg].unlock();
                delete this.locks[m.arg];
                state.locks.delete(m.arg);
            }
            return;
        }

        if (m.type === 'isLocked') {
            const isLocked = !!this.locks[m.arg];
            ws.send(encodeMessage(m.id, m.type, isLocked), true);
            return;
        }

        if (m.type === 'version') {
            // const t = process.hrtime.bigint()
            ws.send(encodeMessage(m.id, m.type, ++this.version), true);
        }
    }
}
