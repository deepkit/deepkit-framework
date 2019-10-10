import 'jest-extended';
import 'reflect-metadata';
import {Exchange} from "../src/exchange";
import {GlutFile} from "@marcj/glut-core";
import {ExchangeServer} from "../src/exchange-server";
import {sleep} from '@marcj/estdlib';
import {decodeMessage, encodeMessage} from "../src/exchange-prot";

const closers: Function[] = [];

afterAll(async () => {
    for (const close of closers) {
        close();
    }
});

async function createExchange(): Promise<Exchange> {
    const server = new ExchangeServer();
    await server.start();

    closers.push(() => {
        server.close();
    });
    const client = new Exchange(server.port);
    await client.connect();
    return client;
}

test('test basic', async () => {
    const server = new ExchangeServer();
    await server.start();

    const client = new Exchange(server.port);
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
    const started = +new Date;
    const lock1 = await locker.lock('test-early-lock1', 1);
    setTimeout(async () => {
        await lock1.unlock();
    }, 500);

    const lock2 = await locker.lock('test-early-lock1', 1);
    expect(+new Date - started).toBeLessThan(1000);
    expect(+new Date - started).toBeGreaterThan(499);
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


test('test encoding perf', async () => {
    const start = performance.now();

    const count = 100;
    for (let i = 0; i < count; i++) {
        const m = encodeMessage(i, 'publish', 'channel-name', {data: true});
    }
    console.log(count, 'encodeMessage took', performance.now() - start, (performance.now() - start) / count);

    const m = encodeMessage(0, 'publish', 'channel-name', {data: true});
    console.log('m', typeof m, m);
    const start2 = performance.now();
    for (let i = 0; i < count; i++) {
        decodeMessage(m);
    }
    console.log(count, 'decodeMessage took', performance.now() - start2, (performance.now() - start2) / count);
});

test('test lock performance', async () => {
    const locker = await createExchange();
    const start = performance.now();

    const count = 2000;
    for (let i = 0; i < count; i++) {
        const lock1 = await locker.lock('test-perf-' + i, 0.01);
        await lock1.unlock();
    }

    //0.0035 takes native lock per item
    //this takes 0.203
    console.log(count, 'locks took', performance.now() - start, (performance.now() - start) / count);
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
