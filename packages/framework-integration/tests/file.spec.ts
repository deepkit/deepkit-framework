import 'jest-extended';
import {File, rpc, StreamBehaviorSubject} from '@deepkit/framework-shared';
import {EntityStorage, FS} from '@deepkit/fs';
import {appModuleForControllers, closeAllCreatedServers, createServerClientPair} from './util';
import {sleep} from '@deepkit/core';
import {Buffer} from 'buffer';
import {arrayBufferTo} from '@deepkit/marshal';

// @ts-ignore
global['WebSocket'] = require('ws');

afterAll(async () => {
    await closeAllCreatedServers();
});

test('test file list', async () => {
    @rpc.controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private fs: FS<File>,
        ) {

        }

        @rpc.action()
        async init() {
            await this.fs.removeAll({});

            await this.fs.write('test1.txt', 'Was geht?');
            await this.fs.write('test2.txt', 'Nix');
            await this.fs.write('test2-doppelt.txt', 'Nix');
        }

        @rpc.action()
        async deleteTest2() {
            await this.fs.removeAll({
                path: 'test2.txt'
            });
        }

        @rpc.action()
        async content(path: string) {
            return await this.fs.subscribe(path, {});
        }

        @rpc.action()
        async write(path: string, content: string) {
            await this.fs.write(path, content);
        }

        @rpc.action()
        async files() {
            return this.storage.collection(File).filter({
                path: {$regex: /^test2/}
            }).find();
        }
    }

    const {client, close} = await createServerClientPair('test file list', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');
    await test.init();

    const files = await test.files();

    expect(files.count()).toBe(2);

    test.deleteTest2();
    await files.nextStateChange;
    expect(files.count()).toBe(1);

    const fileContent = await test.content('test1.txt');
    expect(fileContent).toBeInstanceOf(StreamBehaviorSubject);
    expect(arrayBufferTo(fileContent.value!, 'utf8')).toBe('Was geht?');

    test.write('test1.txt', 'updated');
    await fileContent.nextStateChange;
    expect(arrayBufferTo(fileContent.value!, 'utf8')).toBe('updated');

    await close();
});

test('test file stream', async () => {
    @rpc.controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private fs: FS<File>,
        ) {

        }

        @rpc.action()
        async init() {
            await this.fs.removeAll({});
        }

        @rpc.action()
        async stream(path: string, content: string) {
            await this.fs.stream(path, Buffer.from(content, 'utf8'));
        }

        @rpc.action()
        async content(path: string) {
            return await this.fs.subscribe(path, {});
        }
    }

    const {client, close} = await createServerClientPair('test file stream', appModuleForControllers([TestController]));
    const test = client.controller<TestController>('test');
    await test.init();

    await test.stream('stream.txt', 'init');

    const fileContent = await test.content('stream.txt');
    fileContent.activateNextOnAppend();

    expect(fileContent).toBeInstanceOf(StreamBehaviorSubject);
    expect(Buffer.from(fileContent.value!).toString('utf8')).toBe('init');

    test.stream('stream.txt', '\nupdated');
    await fileContent.nextStateChange;
    expect(Buffer.from(fileContent.value!).toString('utf8')).toBe('init\nupdated');

    await fileContent.unsubscribe();
    await test.stream('stream.txt', '\nnext');

    await sleep(0.2);
    //content is still the same, since we unsubscribed
    expect(Buffer.from(fileContent.value!).toString('utf8')).toBe('init\nupdated');

    const binaryContent = await test.content('stream.txt');
    expect(binaryContent.value).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(binaryContent.value!).toString('utf8')).toBe('init\nupdated\nnext');
    binaryContent.unsubscribe();

    const fileContentUtf = (await test.content('stream.txt')).toUTF8();
    fileContentUtf.activateNextOnAppend();
    expect(fileContentUtf.value).toBe('init\nupdated\nnext');

    console.log('end stream');
    test.stream('stream.txt', '\nend');
    await fileContentUtf.nextStateChange;
    expect(fileContentUtf.value).toBe('init\nupdated\nnext\nend');

    await close();
});
