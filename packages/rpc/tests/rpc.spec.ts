import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { RpcTypes } from '../src/model';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { createRpcCompositeMessage, createRpcCompositeMessageSourceDest, createRpcMessage, createRpcMessagePeer, createRpcMessageSourceDest, readRpcMessage, RpcMessageReader, RpcMessageRouteType } from '../src/protocol';
import { RpcKernel } from '../src/server/kernel';

test('protocol basics', () => {
    const schema = t.schema({
        name: t.string
    });

    {
        const message = createRpcMessage(1024, 130, schema, { name: 'foo' });
        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        const body = parsed.parseBody(schema);
        expect(body.name).toBe('foo');
    }

    {
        const message = createRpcMessage(1024, 130, schema, { name: 'foo' }, RpcMessageRouteType.server);
        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.routeType).toBe(RpcMessageRouteType.server);
    }

    {
        const peerSource = Buffer.alloc(16);
        peerSource[0] = 22;
        const message = createRpcMessagePeer(1024, 130, peerSource, 'myPeer', schema, { name: 'foo' });
        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.getPeerId()).toBe('myPeer');

        const body = parsed.parseBody(schema);
        expect(body.name).toBe('foo');
    }

    {
        const source = Buffer.alloc(16);
        source[0] = 16;
        const destination = Buffer.alloc(16);
        destination[0] = 20;
        const message = createRpcMessageSourceDest(1024, 130, source, destination, schema, { name: 'foo' });
        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(130);
        expect(parsed.getSource()[0]).toBe(16);
        expect(parsed.getDestination()[0]).toBe(20);
        const body = parsed.parseBody(schema);
        expect(body.name).toBe('foo');
    }
});

test('protocol composite', () => {
    const schema = t.schema({
        name: t.string
    });

    {
        const message = createRpcCompositeMessage(1024, [{ type: 4, schema, body: { name: 'foo' } }]);

        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(RpcTypes.Composite);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(() => parsed.parseBody(schema)).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(1);
        expect(messages[0].type).toBe(4);
        expect(messages[0].parseBody(schema).name).toBe('foo');
    }

    {
        const message = createRpcCompositeMessage(1024, [{ type: 4, schema, body: { name: 'foo' } }, { type: 12, schema, body: { name: 'bar' } }]);

        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(RpcTypes.Composite);
        expect(parsed.routeType).toBe(RpcMessageRouteType.client);
        expect(() => parsed.parseBody(schema)).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(2);
        expect(messages[0].type).toBe(4);
        expect(messages[0].parseBody(schema).name).toBe('foo');
        expect(messages[1].type).toBe(12);
        expect(messages[1].parseBody(schema).name).toBe('bar');
    }

    {
        const source = Buffer.alloc(16);
        source[0] = 16;
        const destination = Buffer.alloc(16);
        destination[0] = 20;
        const message = createRpcCompositeMessageSourceDest(1024, source, destination, [{ type: 4, schema, body: { name: 'foo' } }, { type: 12, schema, body: { name: 'bar' } }]);

        const parsed = readRpcMessage(message);
        expect(parsed.id).toBe(1024);
        expect(parsed.type).toBe(RpcTypes.Composite);
        expect(parsed.routeType).toBe(RpcMessageRouteType.sourceDest);
        expect(parsed.getSource()[0]).toBe(16);
        expect(parsed.getDestination()[0]).toBe(20);
        expect(() => parsed.parseBody(schema)).toThrow('Composite message can not be read directly');

        const messages = parsed.getBodies();
        expect(messages.length).toBe(2);
        expect(messages[0].type).toBe(4);
        expect(messages[0].parseBody(schema).name).toBe('foo');
        expect(messages[1].type).toBe(12);
        expect(messages[1].parseBody(schema).name).toBe('bar');
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
    kernel.registerController('myController', Controller);

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
    const kernel = new RpcKernel();

    const client1 = new DirectClient(kernel);
    class Controller {
        @rpc.action()
        action(value: string): string {
            return value;
        }
    }

    await client1.registerAsPeer('peer1');
    client1.registerController('foo', Controller);

    const client2 = new DirectClient(kernel);

    const controller = client2.peer('peer1').controller<Controller>('foo');
    const res = await controller.action('bar');
    expect(res).toBe('bar');
});

test('message reader', async () => {
    const messages: Buffer[] = [];
    const reader = new RpcMessageReader(Array.prototype.push.bind(messages));

    let buffer: any;

    {
        messages.length = 0;
        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(500_000);
        buffer.writeUInt32LE(1_000_000);
        reader.feed(buffer);
        buffer = Buffer.alloc(500_000);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(1_000_000);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(0);
        reader.feed(buffer);

        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(18);
        buffer.writeUInt32LE(8);
        buffer.writeUInt32LE(10, 8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(10);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(22);
        buffer.writeUInt32LE(8);
        buffer.writeUInt32LE(10, 8);
        buffer.writeUInt32LE(20, 18);

        reader.feed(buffer);
        buffer = Buffer.alloc(16);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(3);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(10);
        expect(messages[2].readUInt32LE()).toBe(20);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(8);
        expect(messages[1].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        buffer = Buffer.alloc(4);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(1);
        expect(messages[0].readUInt32LE()).toBe(8);
    }

    {
        messages.length = 0;
        let buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(30);
        reader.feed(buffer);

        buffer = Buffer.alloc(26);
        reader.feed(buffer);

        buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(8);
        reader.feed(buffer);

        expect(reader.emptyBuffer()).toBe(true);
        expect(messages.length).toBe(2);
        expect(messages[0].readUInt32LE()).toBe(30);
        expect(messages[1].readUInt32LE()).toBe(8);
    }
});
