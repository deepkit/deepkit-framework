import 'jest';
import 'jest-extended';
import {FS, getMd5} from "../src/fs";
import {Exchange} from "../src/exchange";
import {readFile, pathExists, remove} from 'fs-extra';
import {ExchangeDatabase, ExchangeNotifyPolicy} from "..";
import {ClassType} from '@marcj/estdlib';
import {Database} from '@marcj/marshal-mongo';
import {createConnection} from 'typeorm';

let fs = 0;

async function createFs(): Promise<[FS, Function]> {
    fs++;
    const connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        port: 27017,
        name: 'fs-test-' + fs,
        database: "fs-test-" + fs,
        useNewUrlParser: true,
        synchronize: true,
        entities: []
    });

    const localDir = '/tmp/deepkit/testing/';
    await remove(localDir);

    const exchange = new Exchange();

    const notifyPolicy = new class implements ExchangeNotifyPolicy {
        notifyChanges<T>(classType: ClassType<T>): boolean {
            return true;
        }
    };

    const database = new Database(connection, 'fs-test-' + fs);
    await database.dropDatabase('fs-test-' + fs);
    const accountDb = new ExchangeDatabase(notifyPolicy, database, exchange);

    return [new FS(exchange, accountDb, localDir), async function () {
        await exchange.disconnect();
        await database.close();
    }];
}

test('test fs storage based on md5', async () => {
    const [fs, disconnect] = await createFs();
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

    await fs.removeFile(file1);
    expect(await pathExists(path1)).toBeTrue();

    expect(await fs.hasMd5InDb(md5)).toBeTrue();
    expect(await fs.hasMd5(md5)).toBeTrue();

    await fs.removeFile(file2);
    //now after we have no files anymore with that md5, we are going to remove it from the disk
    expect(await pathExists(path1)).toBeFalse();

    await disconnect();
});

test('test fs storage change content of files with same md5', async () => {
    const [fs, disconnect] = await createFs();
    const content = new Buffer('TestString ' + Math.random());

    let file1 = await fs.write('file1.txt', content);
    const file2 = await fs.write('file2.txt', content);

    const path1 = fs.getLocalPath(file1);
    const path2 = fs.getLocalPath(file1);
    expect(await pathExists(path1)).toBeTrue();
    expect(await pathExists(path2)).toBeTrue();

    const content2 = new Buffer('TestString 222 ' + Math.random());
    file1 = await fs.write('file1.txt', content2);

    expect(file1.md5).not.toBe(file2.md5);
    expect(await fs.hasMd5(file1.md5!)).toBeTrue();
    expect(await fs.hasMd5(file2.md5!)).toBeTrue();

    await disconnect();
});

test('test fs single deletion', async () => {
    const [fs, disconnect] = await createFs();
    const content = new Buffer('TestString ' + Math.random());
    const file1 = await fs.write('file1.txt', content);

    const path1 = fs.getLocalPath(file1);
    expect(await pathExists(path1)).toBeTrue();

    await fs.removeFile(file1);

    expect(await fs.findOne('file1.txt')).toBeNull();
    expect(await pathExists(path1)).toBeFalse();

    await disconnect();
});

test('test fs fork', async () => {
    const [fs, disconnect] = await createFs();
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

    await fs.removeFile(file2Changed);
    expect(await pathExists(path1)).toBeTrue();

    await fs.removeFile(file1);

    expect(await fs.findOne('file1.txt')).toBeNull();
    expect(await pathExists(path1)).toBeFalse();

    await disconnect();
});

test('test fs stream', async () => {
    const [fs, disconnect] = await createFs();

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
