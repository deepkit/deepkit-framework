import { sleep } from '@deepkit/core';
import { expect, test } from '@jest/globals';
import { Zone } from '../src/zone';


test('zone', async () => {
    Zone.enable();

    expect(Zone.current()).toEqual({});

    const promises: Promise<any>[] = [];

    promises.push(Zone.run({ sub: 1 }, async () => {
        await sleep(0.2);
        expect(Zone.current()?.sub).toBe(1);
    }));

    promises.push(Zone.run({ sub: 3 }, async () => {
        await sleep(0.2);
        expect(Zone.current()?.sub).toBe(3);
    }));

    promises.push(Zone.run({ sub: 2 }, async () => {
        await sleep(0.01);
        expect(Zone.current()?.sub).toBe(2);
        await new Promise<void>(async (resolve) => {
            await sleep(0.01);
            expect(Zone.current()?.sub).toBe(2);
            resolve();
        });
    }));

    await Promise.all(promises);
});
