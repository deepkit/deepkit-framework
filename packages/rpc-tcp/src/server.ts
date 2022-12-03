import { asyncOperation, ParsedHost, parseHost } from '@deepkit/core';
import { RpcKernel } from '@deepkit/rpc';
import { existsSync, unlinkSync } from 'fs';
import { createServer, Server, Socket } from 'net';

/**
 * Uses the node `net` module to create a server. Supports unix sockets.
 */
export class RpcTcpServer {
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

import ws from 'ws';
import type { ServerOptions as WebSocketServerOptions } from 'ws';
import { IncomingMessage } from 'http';

export class RpcWebSocketServer {
    protected server?: ws.Server;
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

    close() {
        this.server?.close();
    }

    start(options: WebSocketServerOptions): void {
        const defaultOptions = { host: this.host.host, port: this.host.port };
        this.server = new ws.Server({ ...defaultOptions, ...options });

        this.server.on('connection', (ws, req: IncomingMessage) => {
            const connection = this.kernel?.createConnection({
                write(b) {
                    ws.send(b);
                },
                close() {
                    ws.close();
                },
                bufferedAmount(): number {
                    return ws.bufferedAmount;
                },
                clientAddress(): string {
                    return req.socket.remoteAddress || '';
                }
            });

            ws.on('message', async (message: Uint8Array) => {
                connection.feed(message);
            });

            ws.on('close', async () => {
                connection.close();
            });
        });
    }
}
