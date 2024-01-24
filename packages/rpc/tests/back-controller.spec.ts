import { expect, test } from '@jest/globals';

import { DirectClient } from '../src/client/client-direct.js';
import { rpc } from '../src/decorators.js';
import { RpcKernel, RpcKernelConnection } from '../src/server/kernel.js';

test('back controller', async () => {
    class Controller {
        constructor(protected connection: RpcKernelConnection) {}

        @rpc.action()
        foo(bar: string): string {
            return bar;
        }

        @rpc.action()
        async triggerClientCall(): Promise<string> {
            const controller = this.connection.controller<Controller>('myController');
            return await controller.foo('2');
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    client.registerController(Controller, 'myController');

    expect(await controller.foo('1')).toBe('1');
    expect(await controller.triggerClientCall()).toBe('2');
});
