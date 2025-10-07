import { expect, test } from '@jest/globals';
import { ControllerSymbol, rpc, RpcKernelConnection, RpcKernelSecurity, Session, SessionState } from '@deepkit/rpc';
import { createTestingApp } from '../src/testing.js';
import { AppModule } from '@deepkit/app';
import { InjectorContext } from '@deepkit/injector';
import { http, HttpQuery, HttpRequest } from '@deepkit/http';

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

    const module = new AppModule({}, { name: 'base', providers: [MyService], controllers: [Controller] });
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

    const module = new AppModule({}, {
        name: 'module',
        controllers: [Controller],
        providers: [{
            provide: RpcKernelSecurity, useClass: MyRpcKernelSecurity, scope: 'rpc',
        }],
    }).forRoot();
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
        providers: [ModelRegistryService],
    });

    const client = testing.createRpcClient();
    const controller = client.controller<Controller>('main');
    expect(await controller.test()).toEqual(['a']);

    const registry = testing.app.get(ModelRegistryService);
    expect(registry.models).toEqual(['a']);
});

test('InjectorContext', async () => {
    @rpc.controller('main')
    class RpcController {
        constructor(private injectorContext: InjectorContext) {
        }

        @rpc.action()
        test() {
            expect(this.injectorContext.scope?.name).toBe('rpc');
            expect(this.injectorContext.getOrUndefined(HttpRequest)?.url).toBe(undefined);
        }
    }

    class HttpController {
        constructor(private injectorContext: InjectorContext) {
        }

        @http.GET('/test')
        test(q: HttpQuery<string>) {
            expect(this.injectorContext.scope?.name).toBe('http');
            expect(this.injectorContext.get(HttpRequest)?.url).toBe('/test?q=' + q);
        }
    }

    const testing = createTestingApp({
        controllers: [RpcController, HttpController],
    });

    await testing.startServer();

    const request1 = await testing.request(HttpRequest.GET('/test?q=1'));
    expect(request1.statusCode).toBe(200);
    const request2 = await testing.request(HttpRequest.GET('/test?q=2'));
    expect(request2.statusCode).toBe(200);

    const client = testing.createRpcClient();
    const controller = client.controller<RpcController>('main');
    await controller.test();

    const request3 = await testing.request(HttpRequest.GET('/test?q=3'));
    expect(request3.statusCode).toBe(200);

    await testing.stopServer();
});
