import { expect, test } from '@jest/globals';
import { ControllerSymbol, rpc, RpcKernelConnection, Session, SessionState } from '@deepkit/rpc';
import { createTestingApp } from '../src/testing';

test('di', async () => {
    class MyService {}

    const MyController = ControllerSymbol<Controller>('test')

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
