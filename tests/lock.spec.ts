import 'reflect-metadata';
import 'jest';
import 'jest-extended';
import {Locker, Lock} from "../src/locker";

jest.setTimeout(20000);

let locker: Locker;

beforeAll(async () => {
    locker = new Locker();
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
    const start = Date.now();
    const lock1 = await locker.acquireLock('test-timeout-lock1', 1);
    // console.log('took', (Date.now() - start));

    const lock2 = await locker.acquireLock('test-timeout-lock1', 1);
    console.log('took', (Date.now() - start));
    expect((Date.now() - start) / 1000).toBeGreaterThan(0.9);

    const lock3 = await locker.acquireLock('test-timeout-lock1', 1);
    console.log('took', (Date.now() - start));
    expect((Date.now() - start) / 1000).toBeGreaterThan(1.9);
});

test('test performance', async () => {
    const start = performance.now();

    for (let i = 0; i < 2000; i++) {
        const lock1 = await locker.acquireLock('test-perf', 0.01);
        await lock1.unlock();
    }

    console.log('2000 locks took', performance.now() - start);

    // expect(performance.now() - start).toBeLessThan(100);
});

test('test tryLock', async () => {
    const lock1 = await locker.acquireLock('trylock', 1);
    expect(lock1).toBeInstanceOf(Lock);

    const lock2 = await locker.tryLock('trylock', 1);
    expect(lock2).toBeUndefined();
    expect(await locker.isLocked('trylock')).toBeTrue();

    await new Promise((resolve) => {
        setTimeout(async () => {
            expect(await locker.isLocked('trylock')).toBeFalse();
            const lock3 = await locker.tryLock('trylock', 1);
            expect(lock3).toBeInstanceOf(Lock);
            expect(await locker.isLocked('trylock')).toBeTrue();

            setTimeout(async () => {
                expect(await locker.isLocked('trylock')).toBeTrue();
                const lock4 = await locker.tryLock('trylock', 1);
                expect(lock4).toBeUndefined();
                expect(await locker.isLocked('trylock')).toBeTrue();
            }, 200);

            setTimeout(async () => {
                expect(await locker.isLocked('trylock')).toBeFalse();
                const lock5 = await locker.acquireLock('trylock', 1);
                expect(lock5).toBeInstanceOf(Lock);
                expect(await locker.isLocked('trylock')).toBeTrue();
                await lock5.unlock();
                resolve();
            }, 1000);
        }, 1000);
    });
});
