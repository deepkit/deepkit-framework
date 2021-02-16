import { rpc } from '@deepkit/rpc';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { Application } from '../src/application';
import { AppModule } from '@deepkit/app';
import { InjectorContext } from '@deepkit/injector';
import { createTestingApp } from '../src/testing';
import { ApplicationServer } from '../src/application-server';
import { Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { KernelModule } from '../src/kernel';

test('testing app api', async () => {
    @rpc.controller('test')
    class MyController {
        constructor(protected logger: Logger) { }

        @rpc.action()
        foo() {
            this.logger.log('bar');
            return 'bar';
        }
    }

    const testing = createTestingApp({ controllers: [MyController] });
    await testing.startServer();

    const client = testing.createRpcClient();
    const controller = client.controller<MyController>('test');

    expect(await controller.foo()).toBe('bar');
    expect(testing.app.get(MemoryLoggerTransport).messageStrings.includes('bar'));
    await testing.stopServer();
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

    const appModule = new AppModule({
        controllers: [MyController],
        imports: [
            KernelModule.configure({
                broker: {startOnBootstrap: false}
            })
        ]
    });

    const app = new Application(appModule);
    const applicationServer = app.get(ApplicationServer);
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
