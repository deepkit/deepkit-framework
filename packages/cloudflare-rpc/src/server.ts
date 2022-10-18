import { createRpcConnection } from '@deepkit/framework';
import { RpcKernel } from '@deepkit/rpc';
import { InjectorContext } from '@deepkit/injector';

import type { FetchRequestHandlerOptions } from './types';

export function webSocketFetchRequestHandler<M>({
                                                    request,
                                                    app,
                                                }: FetchRequestHandlerOptions<M>): Response {
    if (request.headers.get('Upgrade') != 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
    }

    // To accept the WebSocket request, we create a WebSocketPair (which is like a socket pair,
    // i.e. two WebSockets that talk to each other), we return one end of the pair in the
    // response, and we operate on the other end. Note that this API is not part of the
    // Fetch API standard; unfortunately, the Fetch API / Service Workers specs do not define
    // any way to act as a WebSocket server today.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // @ts-ignore
    server.accept();

    const rpcKernel = app.get(RpcKernel);
    const injectorContext = app.get(InjectorContext);

    const connection = createRpcConnection(injectorContext, rpcKernel, {
        close: () => server.close(),
        write: (buffer: Uint8Array) => server.send(buffer),
        clientAddress: () => {
            // Get the client's IP address
            const ip = request.headers.get('CF-Connecting-IP');
            if (!ip) throw new Error('No IP address');
            return ip;
        },
    });

    server.addEventListener('close', () => connection.close());

    server.addEventListener('message', (event: MessageEvent) =>
        connection.feed(new Uint8Array(event.data)),
    );

    // Now we return the other end of the pair to the client.
    return new Response(null, { status: 101, webSocket: client });
}
