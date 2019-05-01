import 'reflect-metadata';
import 'jest';
import 'jest-extended';
import {Locker, Lock} from "../src/locker";
import {AsyncSubscription} from '@marcj/estdlib-rxjs';

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

test('test auto extending', async () => {
    const lock1 = await locker.acquireLockWithAutoExtending('autoextend', 1);
    expect(lock1).toBeInstanceOf(AsyncSubscription);

    const lock2 = await locker.tryLock('autoextend', 1);
    expect(lock2).toBeUndefined();
    expect(await locker.isLocked('autoextend')).toBeTrue();

    await new Promise((resolve) => {
        setTimeout(async () => {
            const lock3 = await locker.tryLock('autoextend', 1);
            expect(lock3).toBeUndefined();
            expect(await locker.isLocked('autoextend')).toBeTrue();

            setTimeout(async () => {
                const lock4 = await locker.tryLock('autoextend', 1);
                expect(lock4).toBeUndefined();
                expect(await locker.isLocked('autoextend')).toBeTrue();

                await lock1.unsubscribe();

                expect(await locker.isLocked('autoextend')).toBeFalse();
                const lock5 = await locker.acquireLock('autoextend', 1);
                expect(lock5).toBeInstanceOf(Lock);
                expect(await locker.isLocked('autoextend')).toBeTrue();
                await lock5.unlock();
                expect(await locker.isLocked('autoextend')).toBeFalse();
                resolve();
            }, 1000);

        }, 1000);
    });
});
