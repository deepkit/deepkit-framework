import 'jest';

import {Action, Controller, ReturnType} from "@marcj/glut-core";
import {Entity, Field} from '@marcj/marshal';
import {createServerClientPair} from "./util";

// @ts-ignore
global['WebSocket'] = require('ws');

@Entity('user')
class User {
    constructor(@Field() public name: string) {
        this.name = name;
    }
}

test('test peer2peer', async () => {
    @Controller('test')
    class TestController {
        @Action()
        @ReturnType(String)
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }

        @Action()
        user(name: string): User {
            return new User(name);
        }
    }

    const {client, createClient, close} = await createServerClientPair('test basic setup', []);

    await client.registerController('test', TestController);

    const client2 = createClient();
    const peerController = client2.peerController<TestController>('test');

    const result = await peerController.names('myName');
    expect(result).toEqual(['a', 'b', 'c', 'myName']);

    const user = await peerController.user('Peter');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toBe('Peter');

    await close();
});
