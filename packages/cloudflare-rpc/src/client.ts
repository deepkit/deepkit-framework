import type {
    ClientTransportAdapter,
    TransportConnectionHooks,
} from '@deepkit/rpc';
import { RpcClient } from '@deepkit/rpc';
import type { ClassType } from '@deepkit/core';

export type CloudflareWorkerRpcWebSocketClientOptions = string | Response | Request;

// https://developers.cloudflare.com/workers/learning/using-websockets#writing-a-websocket-client
export class CloudflareWorkerRpcWebSocketClientAdapter
    implements ClientTransportAdapter
{
    constructor(public options: CloudflareWorkerRpcWebSocketClientOptions) {}

    private getURL(): string {
        if (typeof this.options === 'string') return this.options;
        return this.options.url;
    }

    private async getWebSocketClient(): Promise<WebSocket> {
        let response: Response;

        if (!(this.options instanceof Response)) {
            const request: Request = typeof this.options === 'string' ? new Request(this.options) : this.options;
            request.headers.set('Upgrade', 'websocket');
            response = await fetch(request);
        } else {
            response = this.options;
        }

        // If the WebSocket handshake completed successfully, then the
        // response has a `webSocket` property.
        // @ts-expect-error
        const ws = response.webSocket;
        if (!ws) {
            throw new Error("Server didn't accept WebSocket");
        }

        return ws;
    }

    async connect(connection: TransportConnectionHooks): Promise<void> {
        const ws = await this.getWebSocketClient();

        // Call accept() to indicate that you'll be handling the socket here
        // in JavaScript, as opposed to returning it on to a client.
        // @ts-expect-error
        ws.accept();

        ws.addEventListener('close', () => connection.onClose());

        ws.addEventListener('error', (err: any) => connection.onError(err));

        ws.addEventListener('message', (event: MessageEvent) =>
            connection.onData(new Uint8Array(event.data)),
        );

        // TODO: Figure out whether or not "open" event listener is needed
        // ws.addEventListener('open', () => {
        connection.onConnected({
            clientAddress: () => this.getURL(),
            send: (message: Uint8Array) => ws.send(message),
            close: () => ws.close(),
        });
        // });
    }
}

// Cloudflare Worker <-> Cloudflare Worker
export class CloudflareWorkerRpcWebSocketClient extends RpcClient {
    constructor(options: CloudflareWorkerRpcWebSocketClientOptions) {
        super(new CloudflareWorkerRpcWebSocketClientAdapter(options));
    }

    static fromCurrentRequest<T extends ClassType<RpcClient>>(
        this: T,
        request: Request,
        baseUrl: string = '',
    ): InstanceType<T> {
        const url = new URL(request.url);
        const ws = url.protocol.startsWith('https') ? 'wss' : 'ws';
        if (baseUrl.length && baseUrl[0] !== '/') baseUrl = '/' + baseUrl;
        return new (this as any)(`${ws}://${url.host}${baseUrl}`);
    }
}
