import { entity, getClassSchema, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { DirectClient } from '../../src/client/client-direct';
import { rpc } from '../../src/decorators';
import { RpcKernel } from '../../src/server/kernel';


@entity.name('purchase')
export class Purchase {
    @t.primary.autoIncrement id: number = 0;

    @t sentAt?: Date;
    @t canceledAt?: Date;
}

test('partial', async () => {
    class Controller {
        @rpc.action()
        async patchPurchase(id: number, @t.partial(Purchase) purchase: Partial<Purchase>): Promise<void> {
            expect('sentAt' in purchase).toBe(true);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    await controller.patchPurchase(23, { sentAt: undefined });
});