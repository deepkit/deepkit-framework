import { ClientTransportAdapter } from './client.js';
import { TransportClientConnection } from '../transport.js';
import { RpcMessageDefinition } from '../protocol.js';
import { RpcTypes } from '../model.js';
import { HttpRpcMessage } from '../server/http.js';
import { serialize } from '@deepkit/type';

export class RpcHttpClientAdapter implements ClientTransportAdapter {
    constructor(public url: string, public headers: { [name: string]: string } = {}) {
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
                    if (!message.body) throw new Error('No body given');
                    const body = message.body.body as { controller: string, method: string, };
                    path = body.controller + '/' + encodeURIComponent(body.method);
                    method = 'OPTIONS';
                } else if (message.type === RpcTypes.Action) {
                    if (!message.body) throw new Error('No body given');
                    const messageBody = serialize(message.body.body, undefined, undefined, undefined, message.body.type) as {
                        controller: string,
                        method: string,
                        args: any[]
                    };
                    path = messageBody.controller + '/' + encodeURIComponent(messageBody.method);
                    const allPrimitive = messageBody.args.every(v => ['string', 'number', 'boolean', 'bigint'].includes(typeof v));
                    if (allPrimitive) {
                        for (const a of messageBody.args) {
                            qs.push('arg=' + encodeURIComponent(JSON.stringify(a)));
                        }
                        method = 'GET';
                    } else {
                        body = JSON.stringify(messageBody.args);
                        method = 'POST';
                    }
                } else {
                    throw new Error('Unsupported message type ' + message.type + ' for Http adapter');
                }

                const res = await fetch(this.url + '/' + path + '?' + qs.join('&'), {
                    headers: Object.assign({
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': String(connection.token)
                    }, this.headers),
                    method,
                    body,
                });

                const type = Number(res.headers.get('X-Message-Type'));
                const composite = 'true' === res.headers.get('X-Message-Composite');
                const routeType = Number(res.headers.get('X-Message-RouteType'));
                let json = await res.json();
                if (type === RpcTypes.ResponseActionSimple) {
                    json = {v: json};
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
