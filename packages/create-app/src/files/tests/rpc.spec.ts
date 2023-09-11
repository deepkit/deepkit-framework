import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { Service } from '../src/app/service';
import { HelloWorldControllerRpc } from '../src/controller/hello-world.rpc';

test('rpc controller', async () => {
    const testing = createTestingApp({
        controllers: [HelloWorldControllerRpc],
        providers: [Service]
    });

    await testing.startServer();

    try {
        const client = testing.createRpcClient();
        const controller = client.controller<HelloWorldControllerRpc>('/main');
        const result = await controller.hello('World');
        expect(result).toBe(`Hello World!`);
    } finally {
        await testing.stopServer();
    }
});
