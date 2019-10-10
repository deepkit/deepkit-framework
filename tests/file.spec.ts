import 'jest';
import 'reflect-metadata';
import {Action, Controller, GlutFile, StreamBehaviorSubject} from "@marcj/glut-core";
import {EntityStorage, FS} from "@marcj/glut-server";
import {closeAllCreatedServers, createServerClientPair} from "./util";
import {sleep} from '@marcj/estdlib';

// @ts-ignore
global['WebSocket'] = require('ws');

afterAll(async () => {
    await closeAllCreatedServers();
});

test('test file list', async () => {
    @Controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private fs: FS<GlutFile>,
        ) {

        }

        @Action()
        async init() {
            await this.fs.removeAll({});

            await this.fs.write('test1.txt', 'Was geht?');
            await this.fs.write('test2.txt', 'Nix');
            await this.fs.write('test2-doppelt.txt', 'Nix');
        }

        @Action()
        async deleteTest2() {
            await this.fs.removeAll({
                path: 'test2.txt'
            });
        }

        @Action()
        async content(path: string): Promise<StreamBehaviorSubject<string | undefined>> {
            return await this.fs.subscribe(path);
        }

        @Action()
        async write(path: string, content: string) {
            await this.fs.write(path, content);
        }

        @Action()
        async files() {
            return this.storage.collection(GlutFile).filter({
                path: {$regex: /^test2/}
            }).find();
        }
    }

    const {client, close} = await createServerClientPair('test file list', [TestController], []);
    const test = client.controller<TestController>('test');
    await test.init();

    const files = await test.files();

    expect(files.count()).toBe(2);

    test.deleteTest2();
    await files.nextStateChange;
    expect(files.count()).toBe(1);

    const fileContent = await test.content('test1.txt');
    expect(fileContent).toBeInstanceOf(StreamBehaviorSubject);
    expect(fileContent.getValue()).toBe('Was geht?');

    test.write('test1.txt', 'updated');
    await fileContent.nextStateChange;
    expect(fileContent.getValue()).toBe('updated');

    await close();
});

test('test file stream', async () => {
    @Controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private fs: FS<GlutFile>,
        ) {

        }

        @Action()
        async init() {
            await this.fs.removeAll({});
        }

        @Action()
        async stream(path: string, content: string) {
            await this.fs.stream(path, Buffer.from(content, 'utf8'));
        }

        @Action()
        async content(path: string): Promise<StreamBehaviorSubject<string | undefined>> {
            return await this.fs.subscribe(path);
        }
    }

    const {client, close} = await createServerClientPair('test file stream', [TestController], []);
    const test = client.controller<TestController>('test');
    await test.init();

    await test.stream('stream.txt', 'init');

    // const fileContent = await test.content('stream.txt');
    // fileContent.activateNextOnAppend();
    //
    // expect(fileContent).toBeInstanceOf(StreamBehaviorSubject);
    // expect(fileContent.getValue()).toBe('init');
    //
    // test.stream('stream.txt', '\nupdated');
    // await fileContent.nextStateChange;
    // expect(fileContent.getValue()).toBe('init\nupdated');
    //
    // await fileContent.unsubscribe();
    // await test.stream('stream.txt', '\nnext');
    //
    // await sleep(0.2);
    // //content is still the same, since we unsubscribed
    // expect(fileContent.value).toBe('init\nupdated');

    await close();
});
