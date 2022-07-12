import { rpc } from '@deepkit/rpc';
import { afterEach, describe, expect, it, jest, test } from '@jest/globals';
import { InjectorContext } from '@deepkit/injector';
import { createTestingApp } from '../src/testing.js';
import { ApplicationServer } from '../src/application-server.js';
import { ConsoleTransport, Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { FrameworkModule } from '../src/module.js';
import { RpcServer, RpcServerInterface, WebWorker } from '../src/worker.js';
import { HttpRequest } from '@deepkit/http';
import { BrokerModule } from '../src/broker/broker.module.js';
import { App } from '@deepkit/app';

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

Error.stackTraceLimit = 50;

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
            constructor(protected logger: Logger) {
            }

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

        const app = new App({
            controllers: [MyController],
            imports: [
                new FrameworkModule()
                    .setup((module) => {
                        module.getImportedModuleByClass(BrokerModule).configure({ startOnBootstrap: false });
                    })
            ]
        });
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
                imports: [new FrameworkModule({ publicDir: 'public' })]
            });

            await testing.startServer();
            const applicationServer = testing.app.get(ApplicationServer);
            expect(applicationServer.getWorker()).toBeInstanceOf(WebWorker);
            await testing.stopServer();
        });

        test('not needed without controllers or publicDir', async () => {
            const testing = createTestingApp({
                controllers: [],
            });

            await testing.startServer();
            const applicationServer = testing.app.get(ApplicationServer);
            expect(() => applicationServer.getWorker()).toThrow();
            await testing.stopServer();
        });
    });

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
                    });
                })),
            };

            @rpc.controller('test')
            class MyController {
            }

            const app = new App({
                controllers: [MyController],
                providers: [
                    {
                        provide: RpcServer,
                        useValue: rpcServerMock,
                    }
                ],
                imports: [new FrameworkModule()]
            });
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
            class MyController {
            }

            const app = new App({
                controllers: [MyController],
                imports: [new FrameworkModule()]
            });
            const applicationServer = app.get(ApplicationServer);
            await applicationServer.start();

            expect(require('ws').Server).toHaveBeenCalledTimes(1);
            expect((new (require('ws').Server)()).on).toHaveBeenCalledTimes(1);

            await applicationServer.close();
        });
    });
});

describe("createTestingApp", () => {
    it("should setup the logger correctly", async () => {
        const loggerRemoveTransportSpy = jest.spyOn(Logger.prototype, "removeTransport");
        const loggerAddTransportSpy = jest.spyOn(Logger.prototype, "addTransport");
        const facade = createTestingApp({});
        await facade.startServer();
        expect(loggerAddTransportSpy).toHaveBeenCalledWith(expect.any(MemoryLoggerTransport));
        expect(loggerRemoveTransportSpy).toHaveBeenCalledWith(expect.any(ConsoleTransport));
    });
});
