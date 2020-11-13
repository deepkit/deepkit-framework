import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {InMemoryApplicationServer} from '../src/inmemory-application-server';
import {rpc} from '@deepkit/framework-shared';
import {Application} from '../src/application';
import {RpcControllerContainer} from '../src/service-container';
import { createModule } from '../src/module';

test('basic bootstrap', async () => {
    const AppModule = createModule({})

    const app = new Application(AppModule, {}, [InMemoryApplicationServer]);
    const applicationServer = app.getInjector().get(InMemoryApplicationServer);

    await applicationServer.start();
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
    })

    const app = new Application(AppModule, {}, [InMemoryApplicationServer]);
    const applicationServer = app.get(InMemoryApplicationServer);
    expect(createdControllers).toBe(0);

    const container = new RpcControllerContainer(new Map([['test', MyController]]));
    const controllerInstance = container.createController(MyController);
    expect(controllerInstance.foo()).toBe('bar');
    expect(createdControllers).toBe(1);

    await applicationServer.start();
    {
        const client = applicationServer.createClient();

        const controller = client.controller<MyController>('test');
        const a = await controller.foo();
        expect(a).toBe('bar');
        expect(createdControllers).toBe(2);
        client.disconnect();
    }

    {
        const client = applicationServer.createClient();

        const controller = client.controller<MyController>('test');
        const a = await controller.foo();
        expect(a).toBe('bar');
        expect(createdControllers).toBe(3);
        client.disconnect();
    }

    await applicationServer.close();
});
