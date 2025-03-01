import { signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { ActionObservableTypes, readBinaryRpcMessage, RpcMessage, RpcTypes } from '@deepkit/rpc';
import { deserializeType, stringifyType } from '@deepkit/type';
import { bufferConcat } from '@deepkit/core';

declare const chrome: any;

export interface WebSocketMessage {
    id?: number;
    idx: number;
    type?: RpcTypes;
    direction: 'received' | 'sent';
    timestamp: number;
    size: number;
    data: Uint8Array;
    deepkit?: {
        message: RpcMessage,
        debug: ReturnType<RpcMessage['debug']>,
    };
}

export interface RpcAction {
    id: number;
    idx: number;
    controller: string;
    method: string;
    action: string;
    status: string;
    loaded?: Date;
    executed?: Date;
    returned?: Date;
    responses: number;
    size: number; //response size, sum of all responses
    took?: number;
    returnType: string;
    timestamp: number;
    subscriptions: number;
    args: any[];
    response?: any;
    errors: number;
}

export interface Summary {
    received: number;
    receivedBytes: number;
    sent: number;
    sentBytes: number;
    actionsTotal: number;
    actions: Record<string, number>;
}

export interface Client {
    id: number;
    url: string;
    closed: boolean;
    createdAt: Date;
    closedAt?: Date;
    type: 'unknown' | 'deepkit' | 'unsupported';
    actionIdx: number;
    actions: WritableSignal<RpcAction[]>;
    actionMap: Record<number, RpcAction>;
    messages: WritableSignal<WebSocketMessage[]>;
    summary: WritableSignal<Summary>;
    messages$: Subject<WebSocketMessage>;
    actionLoadTypes: Record<number, { action: string }>;
    typesCache: Record<string, string>;
    messageReader: (message: RpcMessage) => void;
    timestampMap: Record<number, number>;
    chunks: Record<number, { loaded: number, buffers: Uint8Array[] }>;
}

export const clients: WritableSignal<WritableSignal<Client>[]> = signal([]);
const clientMap: Record<number, WritableSignal<Client>> = {};

let messageIds = 0;
let socketIds = 0;

function base64ToArrayBuffer(base64: string) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function clearMessages() {
    for (const client of clients()) {
        client().messages.update(() => []);
    }
}

export function startCollecting() {
    if (!chrome || !chrome.runtime) return;

    const port = chrome.runtime.connect({
        name: `${chrome.devtools.inspectedWindow.tabId}`,
    });
    clients.update(() => []);

    console.log('start receiving', port);
    let first = true;


    port.onMessage.addListener((message: any) => {
        if (first) {
            first = false;
            clearMessages();
        }

        if (message.type === 'client') {
            const summarySignal = signal({
                received: 0,
                receivedBytes: 0,
                sent: 0,
                sentBytes: 0,
                actionsTotal: 0,
                actions: {},
            });
            const summary: Summary = summarySignal();

            const client: Client = {
                id: socketIds++,
                url: message.url,
                type: 'unknown',
                closed: false,
                messages: signal([]),
                createdAt: new Date(message.timestamp),
                messages$: new Subject<WebSocketMessage>(),
                actions: signal([]),
                actionMap: {},
                typesCache: {},
                actionLoadTypes: {},
                timestampMap: {},
                actionIdx: 0,
                chunks: {},
                summary: summarySignal,
                messageReader: (message) => {
                    const timestamp = client.timestampMap[message.id];
                    // console.log('message', RpcTypes[message.type], message.id, message.type, message.debug());
                    let actionChanged = false;
                    switch (message.type) {
                        case RpcTypes.Action: {
                            actionChanged = true;
                            let action = client.actionMap[message.id];
                            if (action) {
                                if (message.type) {
                                    action.executed = new Date(timestamp);
                                    action.status = 'executing';
                                }
                            } else {
                                summary.actionsTotal += 1;
                                const body = message.debug().body as {
                                    controller: string, method: string, args: any[]
                                };
                                const actionName = `${body.controller}.${body.method}`;
                                summary.actions[actionName] = (summary.actions[actionName] || 0) + 1;
                                action = {
                                    idx: ++client.actionIdx,
                                    id: message.id,
                                    controller: body.controller,
                                    method: body.method,
                                    loaded: new Date(timestamp),
                                    status: 'pending',
                                    action: actionName,
                                    responses: 0,
                                    size: 0,
                                    errors: 0,
                                    returnType: client.typesCache[actionName] || '',
                                    timestamp: timestamp,
                                    subscriptions: 0,
                                    args: body.args,
                                };
                                client.actions.update((v) => [...v, action]);
                                client.actionMap[action.id] = action;
                                client.summary.update((v) => ({ ...v }));
                            }
                            break;
                        }
                        case RpcTypes.ActionType: {
                            const body = message.debug().body as {
                                controller: string, method: string
                            };
                            const actionName = `${body.controller}.${body.method}`;
                            client.actionLoadTypes[message.id] = { action: actionName };
                            break;
                        }
                        case RpcTypes.ResponseActionType: {
                            actionChanged = true;
                            const action = client.actionLoadTypes[message.id];
                            if (!action) break;
                            const body = message.debug().body as {
                                type: any;
                                mode: string;
                            };
                            const returnType = stringifyType(deserializeType(body.type));
                            client.typesCache[action.action] = returnType;
                            break;
                        }
                        case RpcTypes.ActionObservableSubscribe: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.size += message.bodySize;
                                // action.status = `subscription`;
                                action.subscriptions += 1;
                                action.status = `subscribed (${action.subscriptions}x)`;
                            }
                            break;
                        }
                        case RpcTypes.ActionObservableUnsubscribe: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.size += message.bodySize;
                                action.subscriptions -= 1;
                                action.status = `subscribed (${action.subscriptions}x)`;
                            }
                            break;
                        }
                        case RpcTypes.ResponseActionObservableComplete:
                        case RpcTypes.ActionObservableSubjectUnsubscribe: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.size += message.bodySize;
                                action.subscriptions -= 1;
                                action.status = `subscribed (${action.subscriptions}x)`;
                            }
                            break;
                        }
                        case RpcTypes.ResponseActionObservable: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.size += message.bodySize;
                                action.status = 'observableReady';
                                const body = message.debug().body as {
                                    type: ActionObservableTypes;
                                };
                                switch (body.type) {
                                    case ActionObservableTypes.observable: {
                                        action.returnType = `Observable<${action.returnType}>`;
                                        break;
                                    }
                                    case ActionObservableTypes.subject: {
                                        action.returnType = `Subject<${action.returnType}>`;
                                        break;
                                    }
                                    case ActionObservableTypes.behaviorSubject: {
                                        action.returnType = `BehaviorSubject<${action.returnType}>`;
                                        break;
                                    }
                                    case ActionObservableTypes.progressTracker: {
                                        action.returnType = `ProgressTracker<${action.returnType}>`;
                                        break;
                                    }
                                }
                            }
                            break;
                        }
                        case RpcTypes.ResponseActionObservableNext: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.responses += 1;
                                action.size += message.bodySize;
                                action.response = (message.debug().body as any).v;
                            }
                            break;
                        }
                        case RpcTypes.ResponseActionSimple: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.status = 'executed';
                                action.responses += 1;
                                action.size += message.bodySize;
                                action.response = (message.debug().body as any).v;
                                action.took = timestamp - action.timestamp;
                            }
                            break;
                        }
                        case RpcTypes.ResponseActionObservableError:
                        case RpcTypes.Error: {
                            actionChanged = true;
                            const action = client.actionMap[message.id];
                            if (action) {
                                action.size += message.bodySize;
                                action.errors += 1;
                            }
                            break;
                        }
                    }

                    if (actionChanged) {
                        client.actions.update((v) => [...v]);
                    }

                    client.summary.update((v) => ({ ...v }));
                },
            };
            clientMap[message.socket] = signal(client);
            clients.update((v) => [...v, signal(client)]);

        } else if (message.type === 'received' || message.type === 'sent') {
            const client = clientMap[message.socket];
            const binary = base64ToArrayBuffer(message.data);
            if (client) {
                const data: WebSocketMessage = {
                    idx: messageIds++,
                    direction: message.type,
                    timestamp: message.timestamp,
                    size: binary.byteLength,
                    data: binary,
                };
                client().messages.update((v) => [...v, data]);
                client().messages$.next(data);

                const summary = client().summary();
                if (message.type === 'sent') {
                    summary.sent += 1;
                    summary.sentBytes += binary.byteLength;
                } else {
                    summary.received += 1;
                    summary.receivedBytes += binary.byteLength;
                }
                client().summary.update((v) => ({ ...v }));
                if (client().type !== 'unsupported') {
                    // console.log('message', message.socket, message.type, message.timestamp, binary.byteLength);
                    try {
                        let rpcMessage = readBinaryRpcMessage(binary);
                        if (rpcMessage.type === RpcTypes.Chunk) {
                            const body = rpcMessage.debug().body as {
                                id: number;
                                total: number;
                                v: Uint8Array;
                            };

                            const chunks = client().chunks;
                            const c = chunks[body.id] ||= { loaded: 0, buffers: [] };
                            c.buffers.push(body.v);
                            c.loaded += body.v.byteLength;
                            if (c.loaded === body.total) {
                                const newBuffer = bufferConcat(c.buffers, body.total);
                                rpcMessage = readBinaryRpcMessage(newBuffer);
                                delete chunks[body.id];
                            } else {
                                return;
                            }
                        }

                        data.deepkit = {
                            message: rpcMessage,
                            debug: rpcMessage.debug(),
                        };
                        data.id = rpcMessage.id;
                        data.type = rpcMessage.type;
                        client().timestampMap[rpcMessage.id] = message.timestamp;

                        client().messageReader(rpcMessage);
                        client().type = 'deepkit';
                    } catch (error) {
                        client().type = 'unsupported';
                        console.log('readBinaryRpcMessage error', error);
                    }
                }
                client.update((v) => ({ ...v }));
            }
        } else if (message.type === 'close') {
            const client = clientMap[message.socket];
            if (client) {
                client.update((v) => ({ ...v, closed: true, closedAt: new Date(message.timestamp) }));
            }
        }
    });

    console.log('start sending');
    port.postMessage({ type: 'start' });

    port.onDisconnect.addListener(() => {
        console.log('disconnected');
        setTimeout(startCollecting, 1000);
    });
}
