import 'jest';
import {Action, Controller, EntityStorage, ExchangeDatabase} from "@marcj/glut-server";
import {createServerClientPair} from "./util";

global['WebSocket'] = require('ws');

test('test', async () => {

});

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

        }
    }

    const {server, client, close} = await createServerClientPair([TestController], []);
    const test = client.controller<TestController>('test');

    const users = await test.users();
    await users.readyState;

    await close();
});
