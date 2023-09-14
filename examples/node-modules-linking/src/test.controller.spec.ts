import { createTestingApp } from '@deepkit/framework';

import { TestController } from './test.controller';

test('GET /version', async () => {
    const testing = createTestingApp({ controllers: [TestController] });
    await testing.startServer();

    // TODO

    await testing.stopServer(true);
})
