import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { Service } from '../src/app/service';
import { HelloWorldControllerCli } from '../src/controller/hello-world.cli';

test('cli command', async () => {
    const testing = createTestingApp({
        controllers: [HelloWorldControllerCli],
        providers: [Service]
    });

    await testing.app.execute(['hello', 'World']);
});
