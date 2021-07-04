import { asyncOperation, ParsedHost, parseHost } from '@deepkit/core';
import { RpcKernel } from '@deepkit/rpc';
// @ts-ignore
import * as turbo from 'turbo-net';
import { existsSync, unlinkSync } from 'fs';
import { createServer, Server, Socket } from 'net';

/**
 * Uses the `turbo-net` module to create a server.
 */
export class TcpRpcServer {
    protected turbo?: any;
    protected host: ParsedHost;

    public bufferSize: number = 25 * 1024 //25kb per connection;

    constructor(
        protected kernel: RpcKernel,
        host: string
    ) {
        this.host = parseHost(host);
        if (this.host.isUnixSocket && existsSync(this.host.unixSocket)) {
            unlinkSync(this.host.unixSocket);
        }
    }

    start() {
        if (this.turbo) throw new Error('Server already started');

        this.turbo = turbo.createServer((socket: any) => {
            const bufferSize = this.bufferSize;
            const buffer = Buffer.alloc(bufferSize);

            function read() {
                socket.read(buffer, onRead);
            }

            function onRead(err: any, buf: Uint8Array, bytes: number) {
                if (err) {
                    connection.close();
                    return;
                }
                if (bytes) {
                    connection.feed(buf, bytes);
                    read();
                }
            }

            const connection = this.kernel.createConnection({
                write(b: Uint8Array) {
                    socket.write(b);
                },
                bufferedAmount(): number {
                    return socket.bufferedAmount || 0;
                },
                close() {
                    socket.close();
                },
                clientAddress(): string {
                    return socket.remoteAddress + ':' + socket.remotePort;
                }
            });

            socket.on('close', () => {
                connection.close();
            });

            socket.on('error', () => {
                connection.close();
            });

            read();
        });

        if (this.host.isUnixSocket) {
            throw new Error('Turbo doesnt support unix sockets. Use NetTcpRpcServer instead.');
        } else {
            this.turbo.listen(this.host.port || 8811, this.host.host, () => {
            });
        }
    }

    close() {
        this.turbo?.close();
    }
}

/**
 * Uses the node `net` module to create a server. Supports unix sockets.
 */
export class NetTcpRpcServer {
    protected server?: Server;
    protected host: ParsedHost;

    constructor(
        protected kernel: RpcKernel,
        host: string
    ) {
        this.host = parseHost(host);
        if (this.host.isUnixSocket && existsSync(this.host.unixSocket)) {
            unlinkSync(this.host.unixSocket);
        }
    }

    start() {
        return asyncOperation((resolve, reject) => {
            this.server = createServer();

            this.server.on('listening', () => {
                resolve(true);
            });

            this.server.on('error', (err: any) => {
                reject(new Error('Could not start broker server: ' + err));
            });

            this.server.on('connection', (socket: Socket) => {
                const connection = this.kernel?.createConnection({
                    write(b: Uint8Array) {
                        socket.write(b);
                    },
                    clientAddress(): string {
                        return socket.remoteAddress || '';
                    },
                    close() {
                        socket.destroy();
                    },
                    bufferedAmount(): number {
                        return socket.writableLength || 0;
                    }
                });

                socket.on('data', (data: Uint8Array) => {
                    connection!.feed(data);
                });

                socket.on('close', () => {
                    connection!.close();
                });

                socket.on('error', () => {
                    connection!.close();
                });
            });

            if (this.host.isUnixSocket) {
                this.server.listen(this.host.unixSocket);
            } else {
                this.server.listen(this.host.port || 8811, this.host.host);
            }
        });
    }

    close() {
        this.server?.close();
    }
}
