import { expect, test } from '@jest/globals';
import { RpcKernel } from '../src/server/kernel.js';
import { RpcClient } from '../src/client/client.js';
import { TransportClientConnection } from '../src/transport.js';

test('connect', async () => {
    const kernel = new RpcKernel();

    const connections: TransportClientConnection[] = [];

    const client = new RpcClient({
        connect(connection: TransportClientConnection) {
            const kernelConnection = kernel.createConnection({
                writeBinary: (buffer) => connection.readBinary(buffer),
                close: () => {
                    connection.onClose('');
                },
            });

            connections.push(connection);

            connection.onConnected({
                clientAddress: () => {
                    return 'direct';
                },
                bufferedAmount(): number {
                    return 0;
                },
                close() {
                    kernelConnection.close();
                },
                writeBinary(buffer) {
                    kernelConnection.feed(buffer);
                },
            });
        },
    });

    const errors: Error[] = [];
    client.transporter.errored.subscribe((error) => {
        errors.push(error.error);
    });

    await client.connect();
    expect(client.transporter.isConnected()).toBe(true);
    expect(connections).toHaveLength(1);

    connections[0].onError(new Error('test'));
    expect(errors[0].message).toEqual('test');
    expect(client.transporter.isConnected()).toBe(false);
});
