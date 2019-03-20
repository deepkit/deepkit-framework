import 'jest';
import 'jest-extended';
import {sleep} from "@marcj/estdlib";
import {createConnection} from "typeorm";
import {Lock, Locker} from "../src/locker";
import {Database, getTypeOrmEntity} from '@marcj/marshal-mongo';

jest.setTimeout(10000);

let db: Database;
let locker: Locker;

beforeEach(async () => {
    const connection = await createConnection({
        type: "mongodb",
        host: '127.0.0.1',
        port: 27017,
        database: 'glut-locks',
        name: 'connectionTest',
        useNewUrlParser: true,
        synchronize: true,
        entities: [getTypeOrmEntity(Lock)]
    });
    db = new Database(connection, 'glut-locks');
    await db.getCollection(Lock).deleteMany({});
    locker = new Locker(db);
});

afterEach(async () => {
    await db!.close();
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
    const lock1 = await locker.acquireLock('test-lock1', 2);
    expect(lock1.isLocked()).toBeTrue();

    let lock2Locked = false;
    setTimeout(() => {
        expect(lock2Locked).toBeTrue();
    }, 2500);

    setTimeout(() => {
        expect(lock2Locked).toBeFalse();
    }, 1000);

    const lock2 = await locker.acquireLock('test-lock1');
    lock2Locked = true;
    expect(lock2.isLocked()).toBeTrue();
    expect(lock1.isLocked()).toBeFalse();
});


test('test mongo lock timeout accum', async () => {
    const lock1 = await locker.acquireLock('test-lock1', 2);

    const start = Date.now();
    const lock2 = await locker.acquireLock('test-lock1', 2);
    expect((Date.now() - start) / 1000).toBeGreaterThan(1.9);
    const lock3 = await locker.acquireLock('test-lock1', 2);
    expect((Date.now() - start) / 1000).toBeGreaterThan(3.9);
});
