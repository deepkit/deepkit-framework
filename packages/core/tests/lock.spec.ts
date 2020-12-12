import 'jest';
import {jest} from '@jest/globals'
import 'jest-extended';
import {ProcessLock, ProcessLocker} from '../src/process-locker';

jest.setTimeout(20000);

let locker: ProcessLocker;

beforeAll(async () => {
    locker = new ProcessLocker();
});


test('test lock competing', async () => {
    const started = +new Date;
    const lock1 = await locker.acquireLock('test-lock1', 2);

    const lock2 = await locker.acquireLock('test-lock1', 1);
    expect(+new Date - started).toBeGreaterThanOrEqual(2000);
});

test('test lock early release', async () => {
    const started = +new Date;
    const lock1 = await locker.acquireLock('test-early-lock1', 2);
    setTimeout(async () => {
        await lock1.unlock();
    }, 500);

    const lock2 = await locker.acquireLock('test-early-lock1', 1);
    expect(+new Date - started).toBeLessThan(1000);
    expect(+new Date - started).toBeGreaterThan(499);
});

test('test lock timeout', async () => {
    const started = +new Date;
    const lock1 = await locker.acquireLock('test-early-lock2', 2);
    setTimeout(async () => {
        await lock1.unlock();
    }, 500);

    const lock2 = await locker.acquireLock('test-early-lock2', 1);
    expect(+new Date - started).toBeLessThan(1000);
    expect(+new Date - started).toBeGreaterThan(499);
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

// test('test performance', async () => {
//     const start = performance.now();
//
//     const count = 2000;
//     for (let i = 0; i < count; i++) {
//         const lock1 = await locker.acquireLock('test-perf');
//         await lock1.unlock();
//     }
//
//     console.log(count, 'locks took', performance.now() - start, (performance.now() - start) / count);
//
//     // expect(performance.now() - start).toBeLessThan(100);
// });

test('test tryLock', async () => {
    const lock1 = await locker.acquireLock('trylock', 1);
    expect(lock1).toBeInstanceOf(ProcessLock);

    const lock2 = await locker.tryLock('trylock', 1);
    expect(lock2).toBeUndefined();
    expect(await locker.isLocked('trylock')).toBeTrue();

    await new Promise((resolve) => {
        setTimeout(async () => {
            expect(await locker.isLocked('trylock')).toBeFalse();
            const lock3 = await locker.tryLock('trylock', 1);
            expect(lock3).toBeInstanceOf(ProcessLock);
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
                expect(lock5).toBeInstanceOf(ProcessLock);
                expect(await locker.isLocked('trylock')).toBeTrue();
                await lock5.unlock();
                resolve(undefined);
            }, 1000);
        }, 1000);
    });
});
