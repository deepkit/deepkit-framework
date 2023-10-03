import { parseHost } from '@deepkit/core';
import { ClientTransportAdapter, TransportConnectionHooks } from '@deepkit/rpc';
import { connect } from 'net';

/*
 * Uses the node `net` module to connect. Supports unix sockets.
 */
export class RpcTcpClientAdapter implements ClientTransportAdapter {
    protected host;

    constructor(
        host: string
    ) {
        this.host = parseHost(host);
    }

    public async connect(connection: TransportConnectionHooks) {
        const port = this.host.port || 8811;
        const socket = this.host.isUnixSocket ? connect({ path: this.host.unixSocket }) : connect({
            port: port,
            host: this.host.host
        });

        socket.on('data', (data: Uint8Array) => {
            connection.onData(data);
        });

        socket.on('close', () => {
            connection.onClose();
        });

        socket.on('error', (error: any) => {
            connection.onError(error);
        });

        socket.on('connect', async () => {
            connection.onConnected({
                clientAddress: () => {
                    return this.host.toString();
                },
                bufferedAmount(): number {
                    //implement that to step back when too big
                    return socket.bufferSize;
                },
                close() {
                    socket.end();
                },
                send(message) {
                    socket.write(message);
                }
            });
        });
    }
}
