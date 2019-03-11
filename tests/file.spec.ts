import 'jest';
import {Action, Controller, EntityStorage, ExchangeDatabase} from "@marcj/glut-server";
import {createServerClientPair} from "./util";

global['WebSocket'] = require('ws');

test('test file list', async () => {
    @Controller('test')
    class TestController {
        constructor(
            private storage: EntityStorage,
            private database: ExchangeDatabase,
        ) {

        }

        @Action()
        async files() {
            //todo
        }
    }

    const {server, client, close} = await createServerClientPair([TestController], []);
    const test = client.controller<TestController>('test');

    const files = await test.files();
    // await users.readyState;

    await close();
});
