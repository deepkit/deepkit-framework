import 'jest-extended';
import 'reflect-metadata';
import {Exchange} from "../src/exchange";
import {GlutFile} from "@marcj/glut-core";
import {ExchangeServer} from "../src/exchange-server";
import { sleep } from '@marcj/estdlib';

test('test basic', async () => {
    const server = new ExchangeServer();
    await server.start();

    const client = new Exchange();
    await client.subscribe('mowla', (m) => {
        console.log('got pub message', m);
    });
    await client.publish('mowla', {test: true});

    await sleep(0.05);
    server.close();
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
