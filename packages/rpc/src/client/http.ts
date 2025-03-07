import { ClientTransportAdapter, RpcClient } from './client.js';
import { TransportClientConnection } from '../transport.js';
import { RpcMessageDefinition } from '../protocol.js';
import { RpcError, RpcTypes } from '../model.js';
import { HttpRpcMessage } from '../server/http.js';
import { serialize } from '@deepkit/type';

declare const location: { protocol: string, host: string, origin: string };

export interface RpcHttpResponseInterface {
    status: number;
    headers: { [name: string]: string };
    body?: any;
}

export interface RpcHttpInterface {
    fetch(url: string, options: {
        headers: { [name: string]: string },
        method: string,
        body: any
    }): Promise<RpcHttpResponseInterface>;
}

export class RpcHttpFetch implements RpcHttpInterface {
    async fetch(url: string, options: {
        headers: { [name: string]: string },
        method: string,
        body: any
    }): Promise<RpcHttpResponseInterface> {
        const res = await fetch(url, options);

        return {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            body: await res.json(),
        };
    }
}

export function createRpcHttpClientProvider(
    baseUrl: string = typeof location !== 'undefined' ? location.origin : 'http://localhost',
    headers: { [name: string]: string } = {},
    http?: RpcHttpInterface,
) {
    return {
        provide: RpcClient,
        useFactory: () => new RpcClient(new RpcHttpClientAdapter(baseUrl, headers, http)),
    };
}

export class RpcHttpClientAdapter implements ClientTransportAdapter {
    constructor(
        public url: string,
        public headers: { [name: string]: string } = {},
        public http: RpcHttpInterface = new RpcHttpFetch(),
    ) {
        this.url = url.endsWith('/') ? url.slice(0, -1) : url;
    }

    supportsPeers() {
        //no ClientId call
        return false;
    }

    supportsAuthentication() {
        return false;
    }

    async connect(connection: TransportClientConnection): Promise<void> {
        // http transporter does not connect, it waits for the first message to connect
        connection.onConnected({
            write: async (message: RpcMessageDefinition, options) => {
                const qs: string[] = [];
                let path = '';
                let method = 'GET';
                let body: any = undefined;

                if (message.type === RpcTypes.ActionType) {
                    if (!message.body) throw new RpcError('No body given');
                    const body = message.body.body as { controller: string, method: string, };
                    path = body.controller + '/' + encodeURIComponent(body.method) + '.type';
                    method = 'GET';
                } else if (message.type === RpcTypes.Action) {
                    if (!message.body) throw new RpcError('No body given');
                    const messageBody = serialize(message.body.body, undefined, undefined, undefined, message.body.type) as {
                        controller: string,
                        method: string,
                        args: any[]
                    };
                    path = messageBody.controller + '/' + encodeURIComponent(messageBody.method);
                    const allPrimitive = messageBody.args.every(v => ['string', 'number', 'boolean', 'bigint'].includes(typeof v));
                    if (allPrimitive) {
                        for (const a of messageBody.args) {
                            qs.push('arg=' + encodeURIComponent(String(a)));
                        }
                        method = 'GET';
                    } else {
                        body = JSON.stringify(messageBody.args);
                        method = 'POST';
                    }
                } else {
                    throw new RpcError('Unsupported message type ' + message.type + ' for Http adapter');
                }

                const res = await this.http.fetch(this.url + '/' + path + '?' + qs.join('&'), {
                    headers: Object.assign({
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(connection.token != undefined) ? {
                            'Authorization': String(connection.token),
                        } : {},
                    }, this.headers),
                    method,
                    body,
                });

                const type = Number(res.headers['x-message-type']);
                const composite = 'true' === res.headers['x-message-composite'];
                const routeType = Number(res.headers['x-message-routetype']);
                let json = res.body;
                if (type === RpcTypes.ResponseActionSimple) {
                    json = { v: json };
                }
                connection.read(new HttpRpcMessage(message.id, composite, type, routeType, {}, json));
            },
            bufferedAmount(): number {
                return 0;
            },
            close(): void {
            },
            clientAddress(): string {
                return '';
            },
        });
    }
}


export const RpcHttpHeaderNames = ['x-message-type', 'x-message-composite', 'x-message-routetype'];
