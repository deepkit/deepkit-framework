import { rpc } from '@deepkit/rpc';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import 'reflect-metadata';
import { Application } from '../src/application';
import { AppModule } from '@deepkit/app';
import { InjectorContext } from '@deepkit/injector';
import { createTestingApp } from '../src/testing';
import { ApplicationServer } from '../src/application-server';
import { Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { KernelModule } from '../src/kernel';
import { RpcServer, RpcServerInterface, WebWorker } from '../src/worker';
import { HttpRequest } from '@deepkit/http';

jest.mock('ws', () => {
    const on = jest.fn();
    const Server = jest.fn(() => ({
        on,
        close: jest.fn(),
    }));
    return {
        Server,
    };
});

jest.mock('http', () => ({
    ...jest.requireActual('http') as any,
    Server: jest.fn(() => ({
        on: jest.fn(),
        listen: jest.fn(),
        close: jest.fn(),
    })),
}));


describe('application-server', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

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

    describe('http worker', () => {
        test('needed for publicDir', async () => {
            const testing = createTestingApp({
                controllers: [],
                imports: [KernelModule.configure({ publicDir: 'public' })]
            });

            await testing.startServer();
            const applicationServer = testing.app.get(ApplicationServer);
            expect(applicationServer.getWorker()).toBeInstanceOf(WebWorker);
            await testing.stopServer();
        })

        test('not needed without controllers or publicDir', async () => {
            const testing = createTestingApp({
                controllers: [],
            });

            await testing.startServer();
            const applicationServer = testing.app.get(ApplicationServer);
            expect(() => applicationServer.getWorker()).toThrow();
            await testing.stopServer();
        })
    })

    describe('RpcServer', () => {
        test('should use custom implementation when provided', async () => {
            const onMock = jest.fn();
            const wsServerMock = {
                on: onMock,
            };

            const rpcServerMock: RpcServerInterface = {
                start: jest.fn((
                    options,
                    createRpcConnection
                ) => wsServerMock.on('connection', (ws: any, req: HttpRequest) => {
                    createRpcConnection({
                        write: jest.fn(),
                        close: jest.fn(),
                        bufferedAmount: jest.fn(),
                        clientAddress: jest.fn(),
                    })
                })),
            };

            @rpc.controller('test')
            class MyController {}

            const appModule = new AppModule({
                controllers: [MyController],
                providers: [
                    {
                        provide: RpcServer,
                        useValue: rpcServerMock,
                    }
                ],
            });

            const app = new Application(appModule);
            const applicationServer = app.get(ApplicationServer);
            await applicationServer.start();

            expect(rpcServerMock.start).toHaveBeenCalledTimes(1);
            expect(onMock).toHaveBeenCalledTimes(1);
            expect(require('ws').Server).not.toHaveBeenCalled();
            expect((new (require('ws').Server)()).on).not.toHaveBeenCalled();

            await applicationServer.close();
        });

        test('should use default implementation via ws when not specified', async () => {
            @rpc.controller('test')
            class MyController {}

            const appModule = new AppModule({
                controllers: [MyController],
            });

            const app = new Application(appModule);
            const applicationServer = app.get(ApplicationServer);
            await applicationServer.start();

            expect(require('ws').Server).toHaveBeenCalledTimes(1);
            expect((new (require('ws').Server)()).on).toHaveBeenCalledTimes(1);

            await applicationServer.close();
        });
    });

});

