import { ParsedHost, parseHost } from '@deepkit/core';
import { ClientTransportAdapter, TransportConnectionHooks } from '@deepkit/rpc';
import { connect } from 'net';

// @ts-ignore
import * as turbo from 'turbo-net';

/**
 * Uses `turbo-net` module to connect to the server.
 */
export class TcpRpcClientAdapter implements ClientTransportAdapter {
    protected host: ParsedHost;
    public bufferSize: number = 100 * 1024 //100kb per connection;

    constructor(
        host: string
    ) {
        this.host = parseHost(host);
    }

    public async connect(connection: TransportConnectionHooks) {
        const port = this.host.port || 8811;
        const socket = turbo.connect(port, this.host.host);
        // socket.setNoDelay(true);

        socket.on('close', () => {
            connection.onClose();
        });

        socket.on('error', (error: any) => {
            connection.onError(error);
        });

        const bufferSize = this.bufferSize;
        const buffer = Buffer.allocUnsafe(bufferSize);

        function read() {
            socket.read(buffer, onRead);
        }

        function onRead(err: any, buf: Uint8Array, bytes: number) {
            if (bytes) {
                connection.onData(buf, bytes);
                read();
            }
        }

        read();

        connection.onConnected({
            clientAddress: () => {
                return this.host.toString();
            },
            bufferedAmount(): number {
                //implement that to step back when too big
                return 0;
            },
            close() {
                socket.end();
            },
            send(message) {
                socket.write(message);
            }
        });
    }
}

/*
 * Uses the node `net` module to connect. Supports unix sockets.
 */
export class NetTcpRpcClientAdapter implements ClientTransportAdapter {
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
