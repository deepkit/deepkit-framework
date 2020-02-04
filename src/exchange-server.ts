// import {App, us_listen_socket, us_listen_socket_close, WebSocket} from "uWebSockets.js";
import {decodeMessage, encodeMessage} from "./exchange-prot";
import {ProcessLock, ProcessLocker} from "./process-locker";
import {Injectable} from "injection-js";
import {Subscriptions} from "@marcj/estdlib-rxjs";
import {Subscription} from "rxjs";
import * as WebSocket from 'ws';

interface StatePerConnection {
    subs: Subscriptions;
    locks: Map<string, ProcessLock>;
    subscribedEntityFields: Map<number, Subscription>;
}

@Injectable()
export class ExchangeServer {
    protected locker = new ProcessLocker;
    protected locks: { [name: string]: ProcessLock } = {};
    protected storage: { [key: string]: any } = {};
    protected entityFields: { [key: string]: { [field: string]: number } } = {};

    protected statePerConnection = new Map<WebSocket, StatePerConnection>();

    protected version = 0;

    protected server?: WebSocket.Server;

    protected subscriptions = new Map<string, Set<WebSocket>>();

    constructor(
        public readonly host = '127.0.0.1',
        public port = 8561,
    ) {

    }

    close() {
        if (this.server) {
            this.server.close();
        }
    }

    async start() {
        this.server = new WebSocket.Server({
            host: this.host,
            port: this.port,
        });

        this.server.on('connection', (ws, req) => {
            this.statePerConnection.set(ws, {
                subs: new Subscriptions(),
                locks: new Map(),
                subscribedEntityFields: new Map(),
            });

            ws.on('message', (message) => {
                // console.log('message', typeof message, getClassName(message), message instanceof ArrayBuffer);
                if (message instanceof Buffer) {
                    this.onMessage(ws, message, this.statePerConnection.get(ws)!);
                }
            });

            ws.on('close', () => {
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
            });
        });

        await new Promise((resolve, reject) => {
            if (this.server) {
                this.server.on("listening", () => {
                    resolve();
                });
                this.server.on("error", (err) => {
                    reject(err);
                });
            }
        });
    }

    protected async onMessage(ws: WebSocket, message: Buffer, state: StatePerConnection) {
        const m = decodeMessage(message);
        // console.log('server message', message.toString(), m);

        if (m.type === 'subscribe') {
            let store = this.subscriptions.get(m.arg);
            if (!store) {
                store = new Set<WebSocket>();
                this.subscriptions.set(m.arg, store);
            }
            store.add(ws);
            return;
        }

        if (m.type === 'unsubscribe') {
            const store = this.subscriptions.get(m.arg);
            if (store) {
                store.delete(ws);
                if (store.size === 0) {
                    this.subscriptions.delete(m.arg);
                }
            }
            return;
        }

        if (m.type === 'publish') {
            const store = this.subscriptions.get(m.arg);
            if (store) {
                for (const otherWS of store) {
                    otherWS.send(message, {binary: true});
                }
            }
            return;
        }

        if (m.type === 'get') {
            ws.send(encodeMessage(m.id, m.type, m.arg, this.storage[m.arg]), {binary: true});
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
            ws.send(reply, {binary: true});
            return;
        }

        if (m.type === 'lock') {
            const [name, timeout] = m.arg;
            this.locks[name] = await this.locker.acquireLock(name, timeout);
            state.locks.set(m.arg, this.locks[name]);
            ws.send(encodeMessage(m.id, m.type, true), {binary: true});
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
            ws.send(encodeMessage(m.id, m.type, isLocked), {binary: true});
            return;
        }

        if (m.type === 'version') {
            // const t = process.hrtime.bigint()
            ws.send(encodeMessage(m.id, m.type, ++this.version), {binary: true});
        }
    }
}
