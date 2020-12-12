import 'jest';
import 'jest-extended';
import {decodeMessage, decodePayloadAsJson, encodeMessage, encodePayloadAsJSONArrayBuffer, str2ab} from '../../src/exchange/exchange-prot';
import {closeCreatedExchange, createExchange} from './utils';
import {performance} from 'perf_hooks';
import {t} from '@deepkit/type';

afterAll(async () => {
    closeCreatedExchange();
});

// test('test basic', async () => {
//     const server = new ExchangeServer('auto');
//     await server.start();
//
//     const client = new Exchange(server.getPath());
//     let gotIt = false;
//     await client.subscribe('mowla', (m) => {
//         console.log('m', m);
//         gotIt = true;
//     });
//     await client.publish('mowla', {test: true});
//
//     await sleep(0.05);
//     expect(gotIt).toBeTrue();
//     server.close();
// });

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

// test('test version', async () => {
//     const client = await createExchange();
//     const start = performance.now();
//
//     const count = 10_000;
//     const all: Promise<any>[] = [];
//     for (let i = 0; i < count; i++) {
//         all.push(client.version());
//     }
//     await Promise.all(all);
//
//     //20000 version took 768.7665319 ms
//     console.log(count, 'version took', performance.now() - start, 'ms', (performance.now() - start) / count);
// });


test('test get/set', async () => {
    const client = await createExchange();
    const type = t.schema({nix: t.string});

    await client.set('myKey', type, {nix: 'data'});

    expect((await client.get('myKey', type))!.nix).toBe('data');

    await client.set('myKey2', type, {nix: 'data2'});
    expect((await client.get('myKey', type))!.nix).toBe('data');
    expect((await client.get('myKey2', type))!.nix).toBe('data2');

    await client.del('myKey2');
    expect((await client.get('myKey', type))!.nix).toBe('data');
    expect((await client.get('myKey2', type))).toBeUndefined();
});

// test('version benchmark', async () => {
//     // this is slower than real-world benchmarks, since we
//     // dont utilize the bandwidth and essentially only measure the tcp latency.
//     const client = await createExchange();
//
//     const bench = new BenchSuite('exchange version');
//     bench.addAsync('version', async () => {
//         await client.version();
//     });
//     await bench.runAsync();
// });
//
// test('test get/set benchmark', async () => {
//     const client = await createExchange();
//     const type = t.schema({nix: t.string});
//
//     const bench = new BenchSuite('exchange set/get');
//     await client.set('peter', type, {nix: 'data'});
//
//     bench.addAsync('get', async () => {
//         await client.get('peter', type);
//     });
//
//     bench.addAsync('set', async () => {
//         await client.set('peter', type, {nix: 'data'});
//     });
//
//     await bench.runAsync();
// });
//
// test('entity fields benchmark', async () => {
//     const client = await createExchange();
//     const type = t.schema({nix: t.string});
//
//     const bench = new BenchSuite('exchange entity-fields');
//     const schema = t.schema({
//         id: t.string,
//         title: t.string,
//         username: t.string,
//         logins: t.number,
//     }, {name: 'test'});
//
//     bench.addAsync('publishUsedEntityFields', async () => {
//         await client.publishUsedEntityFields(schema, ['id', 'title']);
//     });
//
//     await bench.runAsync();
// });


test('test subscribe entity fields', async () => {
    const client = await createExchange();

    const schema = t.schema({
        id: t.string,
        title: t.string,
        username: t.string,
        logins: t.number,
    }, {name: 'test'});

    const subject = client.getUsedEntityFields(schema);

    const usageSub = await client.publishUsedEntityFields(schema, ['id', 'title']);
    expect(subject.value).toEqual(['id', 'title']);

    await usageSub.unsubscribe();
    await subject.nextStateChange;
    expect(subject.value).toEqual([]);

    await client.disconnect();
});

test('test subscribe entity fields multi', async () => {
    const client = await createExchange();

    const schema = t.schema({
        id: t.string,
        title: t.string,
        username: t.string,
        logins: t.number,
    }, {name: 'test'});

    const subject = client.getUsedEntityFields(schema);

    const usageSub1 = await client.publishUsedEntityFields(schema, ['id', 'title']);
    expect(subject.value).toEqual(['id', 'title']);

    const usageSub2 = await client.publishUsedEntityFields(schema, ['id', 'title', 'username']);
    expect(subject.value).toEqual(['id', 'title', 'username']);

    await usageSub1.unsubscribe();
    await subject.nextStateChange;
    expect(subject.value).toEqual(['id', 'title', 'username']);

    const usageSub3 = await client.publishUsedEntityFields(schema, ['logins']);

    await usageSub2.unsubscribe();
    await subject.nextStateChange;
    expect(subject.value).toEqual(['logins']);

    await usageSub3.unsubscribe();
    await subject.nextStateChange;
    expect(subject.value).toEqual([]);

    await client.disconnect();
});
