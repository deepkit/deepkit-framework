import 'jest';
import {Action, Controller, EntityStorage, ExchangeDatabase, FS} from "@marcj/glut-server";
import {File} from "@marcj/glut-core";
import {createServerClientPair} from "./util";

global['WebSocket'] = require('ws');

test('test file list', async () => {
    @Controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private fs: FS,
        ) {

        }

        @Action()
        async deleteTest2() {
            await this.fs.removeAll({
                path: 'test2.txt'
            });
        }

        @Action()
        async files() {
            await this.fs.removeAll({});

            await this.fs.write('test1.txt', 'Was geht?');
            await this.fs.write('test2.txt', 'Nix');
            await this.fs.write('test2-doppelt.txt', 'Nix');

            return this.storage.find(File, {
                path: {$regex: /^test2/}
            });
        }
    }

    const {server, client, close} = await createServerClientPair('test file list', [TestController], []);
    const test = client.controller<TestController>('test');

    const files = await test.files();
    await files.readyState;

    expect(files.count()).toBe(2);

    test.deleteTest2();
    await files.nextStateChange;
    expect(files.count()).toBe(1);

    await close();
});
