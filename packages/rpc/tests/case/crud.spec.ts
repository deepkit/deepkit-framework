import { entity } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { DirectClient } from '../../src/client/client-direct.js';
import { rpc } from '../../src/decorators.js';
import { RpcKernel } from '../../src/server/kernel.js';

@entity.name('purchase')
export class Purchase {
    id: number = 0;
    sentAt: Date = new Date;
    canceledAt: Date = new Date;
}

test('partial', async () => {
    class Controller {
        @rpc.action()
        async patchPurchase(id: number, purchase: Partial<Purchase>): Promise<void> {
            expect('sentAt' in purchase).toBe(true);
            expect('canceledAt' in purchase).toBe(false);
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController(Controller, 'myController');

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    await controller.patchPurchase(23, { sentAt: undefined });
});
