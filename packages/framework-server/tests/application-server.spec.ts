import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Module} from "@super-hornet/framework-server-common";
import {InMemoryApplicationServer} from "../src/inmemory-application-server";
import {Action, Controller} from "@super-hornet/framework-shared";

test('basic bootstrap', async () => {
    @Module({})
    class AppModule {
    }

    const applicationServer = new InMemoryApplicationServer(AppModule);

    await applicationServer.start();
});

test('basic controller', async () => {
    @Controller('test')
    class MyController {
        @Action()
        foo() {
            return 'bar';
        }
    }

    @Module({
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
