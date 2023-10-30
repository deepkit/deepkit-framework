import { expect, test } from '@jest/globals';
import { ControllerSymbol, rpc, RpcKernelConnection, RpcKernelSecurity, Session, SessionState } from '@deepkit/rpc';
import { createTestingApp } from '../src/testing.js';
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

    const module = new AppModule({ providers: [MyService], controllers: [Controller] }, 'base');
    const testing = createTestingApp({ imports: [module] });
    await testing.startServer();

    const client = testing.createRpcClient();
    const controller = client.controller(MyController);

    expect(await controller.hasConnection()).toBe(true);
    expect(await controller.hasSession()).toBe(true);
    expect(await controller.hasService()).toBe(true);
});

test('module provides RpcKernelSecurity', async () => {
    class MyRpcKernelSecurity extends RpcKernelSecurity {
        async authenticate(token: any): Promise<Session> {
            if (token === 'secret') return new Session('yes', token);
            throw new Error('Invalid token');
        }
    }

    @rpc.controller('/main')
    class Controller {
        @rpc.action()
        test(): boolean {
            return true;
        }
    }

    const module = new AppModule({
        controllers: [Controller],
        providers: [{
            provide: RpcKernelSecurity, useClass: MyRpcKernelSecurity, scope: 'rpc'
        }]
    }, 'module').forRoot();
    const testing = createTestingApp({ imports: [module] });
    await testing.startServer();

    {
        const client = testing.createRpcClient();
        client.token.set('secret');
        const controller = client.controller<Controller>('/main');
        const result = await controller.test();
        expect(result).toBe(true);
        client.disconnect();
    }

    {
        const client = testing.createRpcClient();
        client.token.set('invalidSecret');
        const controller = client.controller<Controller>('/main');
        await expect(async () => await controller.test()).rejects.toThrow('Authentication failed');
    }

    await testing.stopServer();
});

test('rpc controller access unscoped provider', async () => {
    class ModelRegistryService {
        public models: string[] = ['a'];
    }

    @rpc.controller('main')
    class Controller {
        constructor(private registry: ModelRegistryService) {
        }

        @rpc.action()
        test(): string[] {
            return this.registry.models;
        }
    }

    const testing = createTestingApp({
        controllers: [Controller],
        providers: [ModelRegistryService]
    });

    const client = testing.createRpcClient();
    const controller = client.controller<Controller>('main');
    expect(await controller.test()).toEqual(['a']);

    const registry = testing.app.get(ModelRegistryService);
    expect(registry.models).toEqual(['a']);
});
