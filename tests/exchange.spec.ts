import 'jest-extended';
import 'reflect-metadata';
import {Exchange} from "../src/exchange";
import {File} from "@marcj/glut-core";

test('test subscribe entity fields', async () => {
    const exchange = new Exchange('localhost', 6379);

    await exchange.clearEntityFields(File);

    {
        const subscription = await exchange.subscribeEntityFields(File, ['iteration', 'batch']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch']);

        await subscription.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual([]);
    }

    {
        const subscription = await exchange.subscribeEntityFields(File, ['iteration', 'batch']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch']);

        await subscription.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual([]);
    }

    {
        const subscription = await exchange.subscribeEntityFields(File, ['iteration', 'batch']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch']);

        const subscription2 = await exchange.subscribeEntityFields(File, ['iteration', 'batch', 'another']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch', 'another']);

        await subscription2.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch']);

        await subscription.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual([]);
    }

    {
        const subscription = await exchange.subscribeEntityFields(File, ['iteration', 'batch']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch']);

        const subscription2 = await exchange.subscribeEntityFields(File, ['another']);
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['iteration', 'batch', 'another']);

        await subscription.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual(['another']);

        await subscription2.unsubscribe();
        expect(await exchange.getSubscribedEntityFields(File)).toEqual([]);
    }



    await exchange.disconnect();
});
