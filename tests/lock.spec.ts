import 'jest';
import 'jest-extended';
import {sleep} from "@marcj/estdlib";
import {createConnection} from "typeorm";
import {Lock, LockItem, Locker} from "../src/locker";
import {Database, getTypeOrmEntity} from '@marcj/marshal-mongo';
import {EntitySchema} from 'typeorm';
import { AsyncSubscription } from '@marcj/estdlib-rxjs';

jest.setTimeout(10000);

let db: Database;
let locker: Locker;

beforeAll(async () => {
    const lockSchema = getTypeOrmEntity(LockItem);
    if (!(lockSchema instanceof EntitySchema)) {
        throw new Error('EntitySchema from getTypeOrmEntity is not from typeorm root package.');
    }
    const connection = await createConnection({
        type: "mongodb",
        host: '127.0.0.1',
        port: 27017,
        database: 'glut-locks',
        name: 'connectionTest',
        useNewUrlParser: true,
        entities: [lockSchema]
    });
    db = new Database(connection, 'glut-locks');
    await connection.synchronize(true);
    locker = new Locker(db);
});

afterAll(async () => {
    await db!.close();
});

test('test mongo lock indices', async () => {
    expect(getTypeOrmEntity(LockItem).options.indices!.length).toBe(1); //name

    //typeOrm createConnection.synchronize syncs the indices
    const indices = await db.getCollection(LockItem).indexes();
    expect(indices.length).toBe(2); //_id_ and name
});

test('test mongo lock', async () => {
    const lock = await locker.acquireLock('test-lock');
    expect(lock.isLocked()).toBeTrue();
    expect(await locker.count()).toBe(1);

    await lock.release();
    expect(lock.isLocked()).toBeFalse();
    expect(await locker.count()).toBe(0);
});

test('test mongo lock multiple', async () => {
    const lock1 = await locker.acquireLock('test-lock1');
    const lock2 = await locker.acquireLock('test-lock2');

    expect(lock1.isLocked()).toBeTrue();
    expect(lock2.isLocked()).toBeTrue();
    expect(await locker.count({})).toBe(2);

    await lock1.release();
    expect(lock1.isLocked()).toBeFalse();
    expect(await locker.count({})).toBe(1);

    await lock2.release();
    expect(lock2.isLocked()).toBeFalse();
    expect(await locker.count({})).toBe(0);
});

test('test mongo lock timeout', async () => {
    const lock1 = await locker.acquireLock('test-lock1', 2);
    expect(lock1.isLocked()).toBeTrue();
    await sleep(2);
    expect(lock1.isLocked()).toBeFalse();
});


test('test mongo lock competing', async () => {
    //typeOrm createConnection.synchronize syncs the indices
    const indices = await db.getCollection(LockItem).indexes();
    expect(indices.length).toBe(2); //_id_ and name

    const lock1 = await locker.acquireLock('test-lock1', 2);
    expect(lock1.isLocked()).toBeTrue();

    let lock2Locked = false;
    setTimeout(() => {
        expect(lock2Locked).toBeTrue();
    }, 2500);

    setTimeout(() => {
        expect(lock2Locked).toBeFalse();
    }, 1000);

    const lock2 = await locker.acquireLock('test-lock1', 1);
    lock2Locked = true;
    expect(lock2.isLocked()).toBeTrue();

    //when this is false, it's probably because indices haven't been synced to mongodb
    expect(lock1.isLocked()).toBeFalse();
});


test('test mongo lock timeout accum', async () => {
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
                await lock5.release();
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
                await lock5.release();
                expect(await locker.isLocked('autoextend')).toBeFalse();
                resolve();
            }, 1000);

        }, 1000);
    });
});
