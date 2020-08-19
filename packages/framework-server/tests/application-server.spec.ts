import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {hornet} from '@super-hornet/framework-server-common';
import {InMemoryApplicationServer} from '../src/inmemory-application-server';
import {rpc} from '@super-hornet/framework-shared';

test('basic bootstrap', async () => {
    @hornet.module({})
    class AppModule {
    }

    const applicationServer = new InMemoryApplicationServer(AppModule);

    await applicationServer.start();
});

test('basic controller', async () => {
    @rpc.controller('test')
    class MyController {
        @rpc.action()
        foo() {
            return 'bar';
        }
    }

    @hornet.module({
        controllers: [MyController]
    })
    class AppModule {
    }

    const applicationServer = new InMemoryApplicationServer(AppModule);

    await applicationServer.start();
    const client = applicationServer.createClient();

    const controller = client.controller<MyController>('test');
    const a = await controller.foo();
    expect(a).toBe('bar');

    await applicationServer.close();
});
