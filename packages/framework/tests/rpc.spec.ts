import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { ControllerSymbol, rpc, RpcKernelConnection, RpcKernelSecurity, Session, SessionState } from '@deepkit/rpc';
import { createTestingApp } from '../src/testing';
import { AppModule } from '@deepkit/app';

test('di', async () => {
    class MyService {
    }

    const MyController = ControllerSymbol<Controller>('test');

    @rpc.controller(MyController)
    class Controller {
        constructor(protected connection: RpcKernelConnection, protected service: MyService, protected sessionState: SessionState) {
        }

        @rpc.action()
        hasService(): boolean {
            return this.service instanceof MyService;
        }

        @rpc.action()
        hasSession(): boolean {
            return this.sessionState.getSession() instanceof Session;
        }

        @rpc.action()
        hasConnection(): boolean {
            return this.connection instanceof RpcKernelConnection;
        }
    }

    const testing = createTestingApp({ providers: [MyService], controllers: [Controller] });
    await testing.startServer();

    const client = testing.createRpcClient();
    const controller = client.controller(MyController);

    expect(await controller.hasConnection()).toBe(true);
    expect(await controller.hasSession()).toBe(true);
    expect(await controller.hasService()).toBe(true);
});

test('non-forRoot sub module lives in own injector scope for rpc controllers', async () => {
    class MyService {
    }

    const MyController = ControllerSymbol<Controller>('test');

    @rpc.controller(MyController)
    class Controller {
        constructor(protected connection: RpcKernelConnection, protected service: MyService, protected sessionState: SessionState) {
        }

        @rpc.action()
        hasService(): boolean {
            return this.service instanceof MyService;
        }

        @rpc.action()
        hasSession(): boolean {
            return this.sessionState.getSession() instanceof Session;
        }

        @rpc.action()
        hasConnection(): boolean {
            return this.connection instanceof RpcKernelConnection;
        }
    }

    const module = new AppModule({ providers: [MyService], controllers: [Controller] }, 'baseservice-container.spec.ts:7');
    const testing = createTestingApp({ imports: [module] });
    await testing.startServer();

    const client = testing.createRpcClient();
    const controller = client.controller(MyController);

    expect(await controller.hasConnection()).toBe(true);
    expect(await controller.hasSession()).toBe(true);
    expect(await controller.hasService()).toBe(true);
});


test('module provides RpcKernelSecurity', () => {
    class MyRpcKernelSecurity extends RpcKernelSecurity {

    }

    const module = new AppModule({
        providers: [{
            provide: RpcKernelSecurity, useClass: MyRpcKernelSecurity
        }]
    }, 'module').forRoot();
    const testing = createTestingApp({ imports: [module] });

    expect(testing.app.get(RpcKernelSecurity)).toBeInstanceOf(MyRpcKernelSecurity);
});
