import {decodeMessage, encodeMessage} from "./exchange-prot";
import {ParsedHost, parseHost, ProcessLock, ProcessLocker} from "@super-hornet/core";
import {Subscriptions} from "@super-hornet/core-rxjs";
import {Subscription} from "rxjs";
import * as WebSocket from 'ws';
import {createServer, Server} from "http";
import {existsSync, removeSync} from "fs-extra";
import {injectable} from '../injector/injector';

interface StatePerConnection {
    subs: Subscriptions;
    locks: Map<string, ProcessLock>;
    subscribedEntityFields: Map<number, Subscription>;
}

@injectable()
export class ExchangeServerFactory {
    create(hostOrUnix: string) {
        return new ExchangeServer(hostOrUnix);
    }
}

@injectable()
export class ExchangeServer {
    protected locker = new ProcessLocker;
    protected locks: { [name: string]: ProcessLock } = {};
    protected storage: { [key: string]: any } = {};
    protected entityFields: { [key: string]: { [field: string]: number } } = {};
    protected keepChannelRecord = new Map<string, any>();
    protected keepChannelRecordTime = new Map<string, any>();

    protected statePerConnection = new Map<any, StatePerConnection>();

    protected version = 0;

    protected server?: Server;
    protected wsServer?: WebSocket.Server;

    protected autoPath = '';

    protected subscriptions = new Map<string, Set<any>>();

    protected host: ParsedHost = parseHost(this.hostOrUnix);

    constructor(
        protected hostOrUnix: string
    ) {
        if (this.host.isUnixSocket && existsSync(this.host.unixSocket)) {
            removeSync(this.host.unixSocket);
        }
    }

    close() {
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = undefined;
        }

        if (this.server) {
            this.server.close();
            this.server = undefined;
        }

        if (this.autoPath) {
            removeSync(this.autoPath);
        }

        if (this.host.isUnixSocket && existsSync(this.host.unixSocket)) {
            removeSync(this.host.unixSocket);
        }
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = createServer();
            this.wsServer = new WebSocket.Server({
                server: this.server
            });

            this.wsServer.on("listening", () => {
                console.log('exchange listen on', this.host.toString());
                resolve(true);
            });

            this.wsServer.on("error", (err) => {
                reject(new Error('Could not start exchange server: ' + err));
            });

            if (this.host.isUnixSocket) {
                this.server.listen(this.host.unixSocket);
            } else {
                this.server.listen(this.host.port, this.host.host);
            }

            this.wsServer.on('connection', (ws, req) => {
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
        });
    }

    protected async onMessage(ws: any, message: Uint8Array, state: StatePerConnection) {
        const m = decodeMessage(message);
        // console.log('server message', message.toString(), m);

        if (m.type === 'subscribe') {
            let store = this.subscriptions.get(m.arg);
            const ttlMessage = this.keepChannelRecord.get(m.arg);
            if (ttlMessage) {
                ws.send(ttlMessage, {binary: true});
            }
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
            const [channelName, ttl] = m.arg;
            if (ttl > 0) {
                this.keepChannelRecord.set(channelName, message);
                const oldTimer = this.keepChannelRecordTime.get(channelName);
                if (oldTimer) clearTimeout(oldTimer);
                this.keepChannelRecordTime.set(channelName, setTimeout(() => {
                    this.keepChannelRecord.delete(channelName);
                }, ttl * 1000));
            }
            const store = this.subscriptions.get(channelName);
            if (store) {
                for (const otherWS of store) {
                    otherWS.send(message, {binary: true});
                }
            }
            ws.send(encodeMessage(m.id, 'ok', null), {binary: true});
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
            const [name, ttl, timeout] = m.arg;
            try {
                this.locks[name] = await this.locker.acquireLock(name, ttl, timeout);
                state.locks.set(m.arg, this.locks[name]);
                ws.send(encodeMessage(m.id, m.type, true), {binary: true});
            } catch (error) {
                ws.send(encodeMessage(m.id, m.type, false), {binary: true});
            }
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
