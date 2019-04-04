import 'reflect-metadata';
import 'jest';
import 'jest-extended';
import {Locker} from "../src/locker";

jest.setTimeout(10000);

let locker: Locker;

beforeAll(async () => {
    locker = new Locker();
});

afterAll(async () => {
    await locker!.disconnect();
});

test('test lock competing', async () => {
    const started = +new Date;
    const lock1 = await locker.acquireLock('test-lock1', 2);

    const lock2 = await locker.acquireLock('test-lock1', 1);
    expect(+new Date - started).toBeGreaterThan(2000);
});

test('test lock early release', async () => {
    const started = +new Date;
    const lock1 = await locker.acquireLock('test-early-lock1', 2);
    setTimeout(async () => {
        await lock1.unlock();
    }, 500);

    const lock2 = await locker.acquireLock('test-early-lock1', 1);
    expect(+new Date - started).toBeLessThan(1000);
    expect(+new Date - started).toBeGreaterThan(500);
});

test('test lock timeout accum', async () => {
    const lock1 = await locker.acquireLock('test-timeout-lock1', 2);

    const start = Date.now();
    const lock2 = await locker.acquireLock('test-timeout-lock1', 2);
    expect((Date.now() - start) / 1000).toBeGreaterThan(1.9);
    const lock3 = await locker.acquireLock('test-timeout-lock1', 2);
    expect((Date.now() - start) / 1000).toBeGreaterThan(3.9);
});
