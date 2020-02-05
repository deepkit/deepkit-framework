import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {FS, getMd5} from "../src/fs";
import {Exchange} from "../src/exchange";
import {pathExists, readFile, remove} from 'fs-extra';
import {ExchangeDatabase, ExchangeNotifyPolicy} from "../src/exchange-database";
import {ClassType} from '@marcj/estdlib';
import {Connection, Database} from '@marcj/marshal-mongo';
import {FileType} from "@marcj/glut-core";
import {ProcessLocker} from "../src/process-locker";
import {ExchangeServer} from "../src/exchange-server";

jest.setTimeout(100_000);

let fs = 0;

async function createFs(name?: string) {
    fs++;
    const dbName = "fs-test-" + (name || fs);
    const connection = new Connection('localhost', dbName);
    const localDir = '/tmp/deepkit/testing/';
    await remove(localDir);

    const exchangeServer = new ExchangeServer();
    exchangeServer.allowToPickFreePort = true;
    await exchangeServer.start();

    const exchange = new Exchange(exchangeServer.port);

    const notifyPolicy = new class implements ExchangeNotifyPolicy {
        notifyChanges<T>(classType: ClassType<T>): boolean {
            return true;
        }
    };

    const database = new Database(connection, dbName);
    await (await database.connection.connect()).db(dbName).dropDatabase();
    const accountDb = new ExchangeDatabase(notifyPolicy, database, exchange);

    return {
        fs: new FS(FileType.forDefault(), exchange, database, accountDb, new ProcessLocker(), localDir),
        exchange, database,
        disconnect: async function () {
            await exchange.disconnect();
            await database.close();
            exchangeServer.close();
        }
    };
}

test('which is faster: exchange-server get or mongodb fetchOne', async () => {
    const {fs, disconnect, exchange, database} = await createFs();

    for (let i = 0; i < 1000; i++) {
        await fs.write('file' + i + '.txt', 'myfetter content ' + i);
    }

    const testCount = 1000;

    {
        const start = performance.now();
        for (let i = 0; i < testCount; i++) {
            const item = await database.query(fs.fileType.classType).filter({path: 'file10.txt'}).ids();
            // console.log('item', item.md5);
        }

        console.log('db findOne() took', performance.now() - start, 'ms for', testCount, 'items');
    }

    {
        const start = performance.now();
        for (let i = 0; i < testCount; i++) {
            await exchange.get('file-meta/file10.txt');
        }

        console.log('exchange get', performance.now() - start, 'ms for', testCount, 'items');
    }

    {
        const start = performance.now();
        for (let i = 0; i < testCount; i++) {
            await fs.getFileMetaCache('file10.txt');
        }

        console.log('fs.getFileId via exchange took', performance.now() - start, 'ms for', testCount, 'items');
    }
});

// test('performance', async () => {
//     const {fs, disconnect} = await createFs('performance');
//     await fs.remove('logfile.txt');
//
//     const start = performance.now();
//     const times = 1_000;
//     const all: Promise<any>[] = [];
//     for (let i = 0; i < times; i++) {
//         all.push(fs.stream('logfile.txt', Buffer.from('Hiiii wahhat uupppp', 'utf8')));
//     }
//
//     await Promise.all(all);
//     console.log('fs took for ', times, performance.now() - start, 'ms', ', per item=', (performance.now() - start) / times, 'ms');
//     disconnect();
// });

test('test fs storage based on md5', async () => {
    const {fs, disconnect} = await createFs();
    const content = new Buffer('TestString ' + Math.random());

    const md5 = getMd5(content);
    const file1 = await fs.write('file1.txt', content);
    const file2 = await fs.write('file2.txt', content);

    expect(md5).toBe(file1.md5);
    expect(md5).toBe(file2.md5);
    expect(await fs.hasMd5InDb(md5)).toBeTrue();
    expect(await fs.hasMd5(md5)).toBeTrue();

    expect((await fs.read('file2.txt'))!.toString()).toBe(content.toString());

    const path1 = fs.getLocalPath(file1);
    const path2 = fs.getLocalPath(file1);

    expect(path1).toBe(path2);
    expect(await pathExists(path1)).toBeTrue();

    expect((await readFile(path1)).toString()).toBe(content.toString());

    await fs.remove(file1.path);
    expect(await pathExists(path1)).toBeTrue();

    expect(await fs.hasMd5InDb(md5)).toBeTrue();
    expect(await fs.hasMd5(md5)).toBeTrue();

    await fs.remove(file2.path);
    //now after we have no files anymore with that md5, we are going to remove it from the disk
    expect(await pathExists(path1)).toBeFalse();

    await disconnect();
});

test('test fs storage change content of files with same md5', async () => {
    const {fs, disconnect} = await createFs();
    const content = new Buffer('TestString ' + Math.random());

    let file1 = await fs.write('file1.txt', content);
    const file2 = await fs.write('file2.txt', content);

    const path1 = fs.getLocalPath(file1);
    const path2 = fs.getLocalPath(file1);
    expect(await pathExists(path1)).toBeTrue();
    expect(await pathExists(path2)).toBeTrue();

    const content2 = new Buffer('TestString 222 ' + Math.random());
    file1 = await fs.write('file1.txt', content2);
    expect(file1.version).toBeGreaterThan(0);

    expect(file1.md5).not.toBeUndefined();
    expect(file1.md5).not.toBe(file2.md5);
    expect(await fs.hasMd5(file1.md5!)).toBeTrue();
    expect(await fs.hasMd5(file2.md5!)).toBeTrue();

    await disconnect();
});

test('test fs single deletion', async () => {
    const {fs, disconnect} = await createFs();
    const content = new Buffer('TestString ' + Math.random());
    const file1 = await fs.write('file1.txt', content);

    const path1 = fs.getLocalPath(file1);
    expect(await pathExists(path1)).toBeTrue();

    await fs.remove(file1.path);

    expect(await fs.findOne('file1.txt')).toBeUndefined();
    expect(await pathExists(path1)).toBeFalse();

    await disconnect();
});

test('test fs fork', async () => {
    const {fs, disconnect} = await createFs();
    const content = new Buffer('TestString ' + Math.random());
    const file1 = await fs.write('file1.txt', content);

    const path1 = fs.getLocalPath(file1);
    expect(await pathExists(path1)).toBeTrue();

    const file2 = await fs.registerFile(file1.md5!, 'file1-copy.txt');

    const path2 = fs.getLocalPath(file1);
    expect(path2).toBe(path1); //same path since same md5

    const file2Changed = await fs.write('file1-copy.txt', 'changed');
    expect(file2Changed.md5).not.toBe(file2.md5);
    expect(fs.getLocalPath(file2Changed)).not.toBe(path1); //changed since new md5

    await fs.remove(file2Changed.path);
    expect(await pathExists(path1)).toBeTrue();

    await fs.remove(file1.path);

    expect(await pathExists(path1)).toBeFalse();
    expect(await fs.findOne('file1.txt')).toBeUndefined();

    await disconnect();
});

test('test fs stream', async () => {
    const {fs, disconnect} = await createFs();

    await fs.stream('filestream.txt', new Buffer('start\n'));

    const file1 = await fs.findOne('filestream.txt');

    expect(() => {
        file1!.getMd5();
    }).toThrow('File is in streaming mode');

    const path1 = fs.getLocalPath(file1!);
    expect(await pathExists(path1)).toBeTrue();
    expect(await readFile(path1, 'utf8')).toBe('start\n');

    await fs.stream('filestream.txt', new Buffer('next1\n'));
    expect(await readFile(path1, 'utf8')).toBe('start\nnext1\n');

    expect(await pathExists(path1)).toBeTrue();

    await disconnect();
});
