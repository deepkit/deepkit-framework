import { createTestingApp } from '@deepkit/framework';
import { ControllerSymbol, rpc } from '@deepkit/rpc';
import { entity } from '@deepkit/type';
import { beforeEach, describe, test, expect } from '@jest/globals';

import {
    CloudflareWorkerRpcWebSocketClient,
} from '../src/client';
import {
    webSocketFetchRequestHandler,
} from '../src/server';

test('client and server', async () => {
    const UserController = ControllerSymbol<Controller>('test');

    @entity.name('user')
    class User {}

    @rpc.controller(UserController)
    class Controller {
        @rpc.action()
        getUser(): User {
            return new User();
        }
    }

    const { app } = createTestingApp({
        controllers: [Controller],
    });

    const request = new Request('http://localhost/', {
        headers: {
            Upgrade: 'websocket',
        },
    });

    const response = webSocketFetchRequestHandler({
        request,
        app,
    });

    const client = new CloudflareWorkerRpcWebSocketClient(response);
    await client.connect();

    const controller = client.controller(UserController);
    await expect(controller.getUser()).resolves.toBeInstanceOf(User);
});
