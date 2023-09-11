import { expect, test } from '@jest/globals';
import { RpcKernel, RpcKernelConnection } from '../src/lib/server/kernel.js';
import { DirectClient } from '../src/lib/client/client-direct.js';
import { rpc } from '../src/lib/decorators.js';

test('back controller', async () => {
    class Controller {
        constructor(protected connection: RpcKernelConnection) {
        }

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
