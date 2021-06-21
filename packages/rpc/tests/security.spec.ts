import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';
import { RpcKernelSecurity, Session } from '../src/server/security';

test('authentication', async () => {
    class Controller {
        @rpc.action()
        test(value: string): string {
            return value;
        }
    }

    class MyKernelSecurity extends RpcKernelSecurity {
        async hasControllerAccess(session: Session) {
            return !session.isAnonymous();
        }

        async isAllowedToRegisterAsPeer(session: Session) {
            return !session.isAnonymous();
        }

        async isAllowedToSendToPeer(session: Session) {
            return !session.isAnonymous();
        }

        async authenticate(token: any): Promise<Session> {
            if (token === 'secret') return new Session('user', token);
            throw new Error('Invalid authentication');
        }
    }

    const kernel = new RpcKernel(undefined, new MyKernelSecurity);
    kernel.registerController('test', Controller);

    {
        const client = new DirectClient(kernel);
        const controller = client.controller<Controller>('test');
        await expect(controller.test('asd')).rejects.toThrow('Access denied');
        await expect(client.registerAsPeer('asd')).rejects.toThrowError('Access denied');
        await expect(client.peer('asd').controller<Controller>('controller').test('foo')).rejects.toThrowError('Access denied');
        client.disconnect();

        client.token.set('invalid');
        await expect(client.registerAsPeer('asd')).rejects.toThrowError('Authentication failed');
        await expect(client.peer('asd').controller<Controller>('controller').test('foo')).rejects.toThrowError('Authentication failed');
        await expect(client.connect()).rejects.toThrowError('Authentication failed');
        await expect(client.connect()).rejects.toThrowError('Authentication failed');
        await expect(controller.test('asd')).rejects.toThrowError('Authentication failed');

        client.token.set('secret');
        await client.connect();

        const client2 = new DirectClient(kernel);
        client2.token.set('secret');
        await client2.registerAsPeer('asd');
        client2.registerPeerController('controller', Controller);

        expect(await client.peer('asd').controller<Controller>('controller').test('foo')).toBe('foo');
        expect(client.username).toBe('user');
        expect(await controller.test('asd')).toBe('asd');
    }

    {
        const client = new DirectClient(kernel);
        const controller = client.controller<Controller>('test');
        client.token.set('secret');
        expect(await controller.test('asd')).toBe('asd');
    }
});
