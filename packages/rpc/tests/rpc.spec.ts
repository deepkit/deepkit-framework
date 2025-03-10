import { expect, test } from '@jest/globals';
import { DirectClient } from '../src/client/client-direct.js';
import { rpc } from '../src/decorators.js';
import {
    createRpcCompositeMessage,
    createRpcCompositeMessageSourceDest,
    createRpcMessage,
    createRpcMessagePeer,
    createRpcMessageSourceDest,
    readBinaryRpcMessage,
    readUint32LE,
    RpcBinaryMessageReader,
    RpcMessage,
    RpcMessageRouteType,
    serializeBinaryRpcMessage,
} from '../src/protocol.js';
import { RpcKernel } from '../src/server/kernel.js';
import { RpcTypes } from '../src/model.js';
import { Writer } from '@deepkit/bson';
import { typeOf } from '@deepkit/type';
import { RpcBinaryWriter, TransportBinaryMessageChunkWriter, TransportOptions } from '../src/transport.js';
import { Progress } from '../src/progress.js';
import { RpcKernelSecurity } from '../src/server/security.js';

test('readUint32LE', () => {
    {
        const writer = new Writer(Buffer.alloc(8));
        writer.writeUint32(545);

        const view = new DataView(writer.buffer.buffer, writer.buffer.byteOffset);
        expect(view.getUint32(0, true)).toBe(545);

        expect(readUint32LE(writer.buffer)).toBe(545);
    }

    {
        const writer = new Writer(Buffer.alloc(8));
        writer.writeUint32(94388585);
        expect(readUint32LE(writer.buffer)).toBe(94388585);
    }
});

test('protocol basics', () => {
    interface schema {
        name: string;
    }

    {
        const message = createRpcMessage(1024, 123);
        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(123);
        expect(parsed.composite).toBe(false);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(parsed.bodySize).toBe(0);
        expect(() => parsed.parseBody<schema>()).toThrowError('no body');
    }

    {
        const message = createRpcMessage<schema>(1024, 130, { name: 'foo' });
        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.composite).toBe(false);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        const body = parsed.parseBody<schema>();
        expect(body.name).toBe('foo');
    }

    {
        const message = createRpcMessage<schema>(1024, 130, { name: 'foo' }, RpcMessageRouteType.server);
        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.composite).toBe(false);
        expect(parsed.routeType).toBe(RpcMessageRouteType.server);
    }

    {
        const peerSource = Buffer.alloc(16);
        peerSource[0] = 22;
        const message = createRpcMessagePeer<schema>(1024, 130, peerSource, 'myPeer', { name: 'foo' });
        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.composite).toBe(false);
        expect(parsed.getPeerId()).toBe('myPeer');

        const body = parsed.parseBody<schema>();
        expect(body.name).toBe('foo');
    }

    {
        const source = Buffer.alloc(16);
        source[0] = 16;
        const destination = Buffer.alloc(16);
        destination[0] = 20;
        const message = createRpcMessageSourceDest<schema>(1024, 130, source, destination, { name: 'foo' });
        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.composite).toBe(false);
        expect(parsed.getSource()[0]).toBe(16);
        expect(parsed.getDestination()[0]).toBe(20);
        const body = parsed.parseBody<schema>();
        expect(body.name).toBe('foo');
    }
});

test('protocol composite', () => {
    interface schema {
        name: string;
    }

    {
        const message = createRpcCompositeMessage(1024, 33, [{ type: 4, schema: typeOf<schema>(), body: { name: 'foo' } }]);

        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(33);
        expect(parsed.composite).toBe(true);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(() => parsed.parseBody<schema>()).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(1);
        expect(messages[0].type).toBe(4);
        expect(messages[0].bodySize).toBeGreaterThan(10);
        expect(messages[0].parseBody<schema>().name).toBe('foo');
    }


    {
        const message = createRpcCompositeMessage(1024, 5, [{ type: 4 }, { type: 5, schema: typeOf<schema>(), body: { name: 'foo' } }]);

        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(5);
        expect(parsed.composite).toBe(true);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(() => parsed.parseBody<schema>()).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(2);
        expect(messages[0].type).toBe(4);
        expect(messages[0].bodySize).toBe(0);
        expect(() => messages[0].parseBody<schema>()).toThrow('no body');

        expect(messages[1].type).toBe(5);
        expect(messages[1].bodySize).toBeGreaterThan(10);
        expect(messages[1].parseBody<schema>().name).toBe('foo');
    }

    {
        const message = createRpcCompositeMessage(1024, 6, [{ type: 4, schema: typeOf<schema>(), body: { name: 'foo' } }, {
            type: 12,
            schema: typeOf<schema>(),
            body: { name: 'bar' },
        }]);

        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(6);
        expect(parsed.composite).toBe(true);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(() => parsed.parseBody<schema>()).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(2);
        expect(messages[0].type).toBe(4);
        expect(messages[0].parseBody<schema>().name).toBe('foo');
        expect(messages[1].type).toBe(12);
        expect(messages[1].parseBody<schema>().name).toBe('bar');
    }

    {
        const source = Buffer.alloc(16);
        source[0] = 16;
        const destination = Buffer.alloc(16);
        destination[0] = 20;
        const message = createRpcCompositeMessageSourceDest(1024, source, destination, 55, [{
            type: 4,
            schema: typeOf<schema>(),
            body: { name: 'foo' },
        }, { type: 12, schema: typeOf<schema>(), body: { name: 'bar' } }]);

        const parsed = readBinaryRpcMessage(serializeBinaryRpcMessage(message));
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(55);
        expect(parsed.composite).toBe(true);
        expect(parsed.routeType).toBe(RpcMessageRouteType.sourceDest);
        expect(parsed.getSource()[0]).toBe(16);
        expect(parsed.getDestination()[0]).toBe(20);
        expect(() => parsed.parseBody<schema>()).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(2);
        expect(messages[0].type).toBe(4);
        expect(messages[0].parseBody<schema>().name).toBe('foo');
        expect(messages[1].type).toBe(12);
        expect(messages[1].parseBody<schema>().name).toBe('bar');
    }
});

test('rpc kernel handshake', async () => {
    const kernel = new RpcKernel();
    const client = new DirectClient(kernel);
    await client.connect();
    expect(client.getId()).toBeInstanceOf(Uint8Array);
    expect(client.getId().byteLength).toBe(16);
});

test('rpc kernel', async () => {
    class Controller {
        @rpc.action()
        action(value: string): string {
            return value;
        }

        @rpc.action()
        sum(a: number, b: number): number {
            return a + b;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');
    expect(await controller.action('foo')).toBe('foo');
    expect(await controller.action('foo2')).toBe('foo2');
    expect(await controller.action('foo3')).toBe('foo3');

    expect(await controller.sum(2, 5)).toBe(7);
    expect(await controller.sum(5, 5)).toBe(10);
    expect(await controller.sum(10_000_000, 10_000_000)).toBe(20_000_000);
});

test('rpc peer', async () => {

    class MyRpcSecurity extends RpcKernelSecurity {
        async isAllowedToSendToPeer() {
            return true;
        }
        async isAllowedToRegisterAsPeer() {
            return true;
        }
    }
    const kernel = new RpcKernel([
        { provide: RpcKernelSecurity, useClass: MyRpcSecurity, scope: 'rpc' },
    ]);

    const client1 = new DirectClient(kernel);

    class Controller {
        @rpc.action()
        action(value: string): string {
            return value;
        }
    }

    await client1.registerAsPeer('peer1');
    client1.registerPeerController(Controller, 'foo');

    const client2 = new DirectClient(kernel);

    const controller = client2.peer('peer1').controller<Controller>('foo');
    const res = await controller.action('bar');
    expect(res).toBe('bar');
});

test('message chunks', async () => {
    const messages: RpcMessage[] = [];
    const reader = new RpcBinaryMessageReader(v => messages.push(v));

    interface schema {
        v: string;
    }

    const bigString = 'x'.repeat(1_000_000); //1mb

    const buffers: Uint8Array[] = [];
    const binaryWriter: RpcBinaryWriter = (b) => {
        buffers.push(b);
        reader.feed(serializeBinaryRpcMessage(createRpcMessage(2, RpcTypes.ChunkAck))); //confirm chunk, this is done automatically in the kernel
        reader.feed(b); //echo back
    };
    const writer = new TransportBinaryMessageChunkWriter(reader, new TransportOptions());

    const message = serializeBinaryRpcMessage(createRpcMessage<schema>(2, RpcTypes.ResponseActionSimple, { v: bigString }));
    await writer.writeFull(binaryWriter, message);
    expect(buffers.length).toBe(11); //total size is 1_000_025, chunk is 100k, so we have 11 packages

    expect(readBinaryRpcMessage(buffers[0]).id).toBe(2);
    expect(readBinaryRpcMessage(buffers[0]).type).toBe(RpcTypes.Chunk);

    expect(readBinaryRpcMessage(buffers[10]).id).toBe(2);
    expect(readBinaryRpcMessage(buffers[10]).type).toBe(RpcTypes.Chunk);

    expect(messages.length).toBe(1);
    const lastReceivedMessage = messages[0];
    expect(lastReceivedMessage.id).toBe(2);
    expect(lastReceivedMessage.type).toBe(RpcTypes.ResponseActionSimple);

    const body = lastReceivedMessage.parseBody<schema>();
    expect(body.v).toBe(bigString);
});

test('message progress', async () => {
    const messages: RpcMessage[] = [];
    const reader = new RpcBinaryMessageReader(v => messages.push(v));

    interface schema {
        v: string;
    }

    const bigString = 'x'.repeat(1_000_000); //1mb

    const binaryWriter: RpcBinaryWriter = (b) => {
        reader.feed(serializeBinaryRpcMessage(createRpcMessage(2, RpcTypes.ChunkAck))); //confirm chunk, this is done automatically in the kernel
        reader.feed(b); //echo
    };
    const writer = new TransportBinaryMessageChunkWriter(reader, new TransportOptions);

    const message = serializeBinaryRpcMessage(createRpcMessage<schema>(2, RpcTypes.ResponseActionSimple, { v: bigString }));
    const progress = new Progress();
    reader.registerProgress(2, progress.download);
    await writer.writeFull(binaryWriter, message, progress.upload);

    await progress.upload.finished;
    expect(progress.upload.done).toBe(true);
    expect(progress.upload.isStopped).toBe(true);
    expect(progress.upload.current).toBe(1_000_025);
    expect(progress.upload.total).toBe(1_000_025);
    expect(progress.upload.stats).toBe(11); //since 11 packages

    await progress.download.finished;
    expect(progress.download.done).toBe(true);
    expect(progress.download.isStopped).toBe(true);
    expect(progress.download.current).toBe(1_000_025);
    expect(progress.download.total).toBe(1_000_025);
    expect(progress.download.stats).toBe(11); //since 11 packages

    const lastReceivedMessage = messages[0];
    const body = lastReceivedMessage.parseBody<schema>();
    expect(body.v).toBe(bigString);
});
