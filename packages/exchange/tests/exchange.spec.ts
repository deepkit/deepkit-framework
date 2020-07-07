import 'jest-extended';
import {Exchange} from "../src/exchange";
import {ExchangeServer} from "../src/exchange-server";
import {sleep} from '@super-hornet/core';
import {
    decodeMessage,
    decodePayloadAsJson,
    encodeMessage,
    encodePayloadAsJSONArrayBuffer,
    str2ab
} from "../src/exchange-prot";
import {closeCreatedExchange, createExchange} from "./utils";

afterAll(async () => {
    closeCreatedExchange();
});

jest.setTimeout(30000);

test('test basic', async () => {
    const server = new ExchangeServer('auto');
    await server.start();

    const client = new Exchange(server.path);
    let gotIt = false;
    await client.subscribe('mowla', (m) => {
        console.log('m', m);
        gotIt = true;
    });
    await client.publish('mowla', {test: true});

    await sleep(0.05);
    expect(gotIt).toBeTrue();
    server.close();
});

test('test lock early release', async () => {
    const locker = await createExchange();
    const started = Date.now();
    const lock1 = await locker.lock('test-early-lock1', 1);
    setTimeout(async () => {
        await lock1.unlock();
    }, 500);

    const lock2 = await locker.lock('test-early-lock1', 1);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(Date.now() - started).toBeGreaterThan(499);
});

test('test lock timeout accum', async () => {
    const locker = await createExchange();
    const start = Date.now();
    const lock1 = await locker.lock('test-timeout-lock1', 1);
    // console.log('took', (Date.now() - start));

    const lock2 = await locker.lock('test-timeout-lock1', 1);
    console.log('took', (Date.now() - start));
    expect((Date.now() - start) / 1000).toBeGreaterThan(0.9);

    const lock3 = await locker.lock('test-timeout-lock1', 1);
    console.log('took', (Date.now() - start));
    expect((Date.now() - start) / 1000).toBeGreaterThan(1.9);
});


test('test encoding/decoding', async () => {
    const payload = encodePayloadAsJSONArrayBuffer({data: true});

    {
        const e = encodeMessage(0, 'publish', 'channel-name');
        const header = 0 + '.' + 'publish' + ':' + JSON.stringify('channel-name') + '\0';
        expect(e.byteLength).toBe(header.length);

        const d = decodeMessage(e);
        expect(d.id).toBe(0);
        expect(d.type).toBe('publish');
        expect(d.arg).toBe('channel-name');
        expect(d.payload.byteLength).toBe(0);
    }

    {
        const e = encodeMessage(5, 'publish', 'channel-name', new ArrayBuffer(0));
        const header = '5.' + 'publish' + ':' + JSON.stringify('channel-name') + '\0';
        expect(e.byteLength).toBe(header.length); //still same length

        const d = decodeMessage(e);
        expect(d.id).toBe(5);
        expect(d.type).toBe('publish');
        expect(d.arg).toBe('channel-name');
        expect(d.payload.byteLength).toBe(0);
    }

    {
        const e = encodeMessage(0, 'publish', 'channel-name', payload);
        const header = 0 + '.' + 'publish' + ':' + JSON.stringify('channel-name') + '\0';
        expect(e.byteLength).toBe(header.length + payload.byteLength);

        const d = decodeMessage(e);
        expect(d.id).toBe(0);
        expect(d.type).toBe('publish');
        expect(d.arg).toBe('channel-name');
        expect(d.payload.byteLength).toBe(payload.byteLength);
        expect(decodePayloadAsJson(d.payload)).toEqual({data: true});
    }
});

test('test encoding perf', async () => {
    const count = 1_000;

    const payload = encodePayloadAsJSONArrayBuffer({data: true});

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            encodeMessage(i, 'publish', 'channel-name', payload);
        }
        console.log(count, 'encodeMessage took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const m = encodeMessage(0, 'publish', 'channel-name', payload);
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            decodeMessage(m);
        }
        console.log(count, 'decodeMessage took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            encodeMessage(i, 'publish', 'channel-name', payload);
        }
        console.log(count, 'encodeMessage no payload took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const m = encodeMessage(0, 'publish', 'channel-name');
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            decodeMessage(m);
        }
        console.log(count, 'decodeMessage no payload took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }
});

test('test lock timeout', async () => {
    const locker = await createExchange();
    const lock = await locker.lock('my-timeout');

    await expect(locker.lock('my-timeout', 0, 1)).rejects.toThrow('Unable to lock my-timeout');
    lock.unlock();
    await locker.lock('my-timeout', 0, 1);
});


test('test str2ab performance', async () => {
    const count = 10_000;
    const header = '0.version.\nNot much';
    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            str2ab(header);
        }
        console.log(count, 'str2ab took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            Buffer.from(header, 'utf8');
        }
        console.log(count, 'buffer.from took', performance.now() - start, 'ms', (performance.now() - start) / count);
    }
});

test('test version', async () => {
    const client = await createExchange();
    const start = performance.now();

    const count = 10_000;
    const all: Promise<any>[] = [];
    for (let i = 0; i < count; i++) {
        all.push(client.version());
    }
    await Promise.all(all);

    //20000 version took 768.7665319 ms
    console.log(count, 'version took', performance.now() - start, 'ms', (performance.now() - start) / count);
});


test('test get/set', async () => {
    const client = await createExchange();

    await client.set('myKey', encodePayloadAsJSONArrayBuffer({nix: 'data'}));

    expect(decodePayloadAsJson(await client.get('myKey')).nix).toBe('data');

    await client.set('myKey2', encodePayloadAsJSONArrayBuffer({nix: 'data2'}));
    expect(decodePayloadAsJson(await client.get('myKey')).nix).toBe('data');
    expect(decodePayloadAsJson(await client.get('myKey2')).nix).toBe('data2');

    await client.del('myKey2');
    expect(decodePayloadAsJson(await client.get('myKey')).nix).toBe('data');
    expect(decodePayloadAsJson(await client.get('myKey2'))).toBeUndefined();
});

test('test get/set benchmark', async () => {
    const client = await createExchange();
    const count = 1_000;

    // {
    //     const start = performance.now();
    //     const payload = encodePayloadAsJSONArrayBuffer({nix: 'data'});
    //     for (let i = 0; i < count; i++) {
    //         await client.set(String(i), payload);
    //     }
    //     console.log(count, 'client.set', performance.now() - start, 'ms', (performance.now() - start) / count);
    // }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            await client.set(String(i), encodePayloadAsJSONArrayBuffer({nix: 'data'}));
        }
        console.log(count, 'client.set & encode', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            await client.get(String(i));
        }
        console.log(count, 'client.get', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            await client.get(String(i));
        }
        console.log(count, 'client.get', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            decodePayloadAsJson(await client.get(String(i)));
        }
        console.log(count, 'client.get & decode', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

    {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            await client.get(String(i));
        }
        console.log(count, 'client.get', performance.now() - start, 'ms', (performance.now() - start) / count);
    }

});


// test('test subscribe entity fields', async () => {
//     const exchange = new Exchange('localhost', 6379);
//
//     await exchange.clearEntityFields(GlutFile);
//
//     {
//         const subscription = await exchange.subscribeEntityFields(GlutFile, ['iteration', 'batch']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch']);
//
//         await subscription.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual([]);
//     }
//
//     {
//         const subscription = await exchange.subscribeEntityFields(GlutFile, ['iteration', 'batch']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch']);
//
//         await subscription.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual([]);
//     }
//
//     {
//         const subscription = await exchange.subscribeEntityFields(GlutFile, ['iteration', 'batch']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch']);
//
//         const subscription2 = await exchange.subscribeEntityFields(GlutFile, ['iteration', 'batch', 'another']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch', 'another']);
//
//         await subscription2.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch']);
//
//         await subscription.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual([]);
//     }
//
//     {
//         const subscription = await exchange.subscribeEntityFields(GlutFile, ['iteration', 'batch']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch']);
//
//         const subscription2 = await exchange.subscribeEntityFields(GlutFile, ['another']);
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['iteration', 'batch', 'another']);
//
//         await subscription.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual(['another']);
//
//         await subscription2.unsubscribe();
//         expect(await exchange.getSubscribedEntityFields(GlutFile)).toEqual([]);
//     }
//
//
//
//     await exchange.disconnect();
// });
