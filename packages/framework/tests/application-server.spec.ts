import { rpc } from '@deepkit/rpc';
import { test, expect } from '@jest/globals';
import 'reflect-metadata';
import { InMemoryApplicationServer } from '../src/application-server';
import { Application } from '../src/application';
import { createModule } from '../src/module';
import { InjectorContext } from '../src/injector/injector';

test('basic bootstrap', async () => {
    const AppModule = createModule({});

    const app = new Application(AppModule, [InMemoryApplicationServer]);
    const applicationServer = app.get(InMemoryApplicationServer);

    await applicationServer.start();
    await applicationServer.close();
});

test('basic controller', async () => {
    let createdControllers = 0;

    @rpc.controller('test')
    class MyController {
        constructor() {
            createdControllers++;
        }

        @rpc.action()
        foo() {
            return 'bar';
        }
    }

    const AppModule = createModule({
        controllers: [MyController],
    });

    const app = new Application(AppModule, [InMemoryApplicationServer]);
    const applicationServer = app.get(InMemoryApplicationServer);
    const injectorContext = app.get(InjectorContext);
    const controller = injectorContext.createChildScope('rpc').get(MyController);
    expect(controller.foo()).toBe('bar');

    createdControllers = 0;

    expect(createdControllers).toBe(0);

    await applicationServer.start();

    {
        const client = applicationServer.createClient();

        const controller = client.controller<MyController>('test');
        const a = await controller.foo();
        expect(a).toBe('bar');
        expect(createdControllers).toBe(1);
        client.disconnect();
    }

    {
        const client = applicationServer.createClient();

        const controller = client.controller<MyController>('test');
        const a = await controller.foo();
        expect(a).toBe('bar');
        expect(createdControllers).toBe(2);
        client.disconnect();
    }

    await applicationServer.close();
});
