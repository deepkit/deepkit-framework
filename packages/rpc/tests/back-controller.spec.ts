import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { RpcKernel, RpcKernelConnection } from '../src/server/kernel';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { injectable } from '@deepkit/injector';
import { t } from '@deepkit/type';


test('back controller', async () => {
    @injectable()
    class Controller {
        constructor(protected connection: RpcKernelConnection) {
        }

        @rpc.action()
        foo(bar: string): string {
            return bar;
        }

        @rpc.action()
        @t.string
        async triggerClientCall(): Promise<string> {
            const controller = this.connection.controller<Controller>('myController');
            return await controller.foo('2');
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    client.registerController('myController', Controller);

    expect(await controller.foo('1')).toBe('1');
    expect(await controller.triggerClientCall()).toBe('2');
});
