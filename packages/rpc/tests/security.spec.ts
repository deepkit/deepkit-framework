import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { AsyncDirectClient, DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { RpcKernel, RpcKernelConnection } from '../src/server/kernel';
import { RpcKernelSecurity, Session } from '../src/server/security';
import { AuthenticationError } from '../src/model';
import { MemoryLoggerTransport } from '../../logger';
import { Logger } from '@deepkit/logger';
import { injectable } from '@deepkit/injector';

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

test('authentication errors', async () => {
    class MyKernelSecurity extends RpcKernelSecurity {
        async authenticate(token: any): Promise<Session> {
            if (token === 'generic') throw new Error('Secure error');
            throw new AuthenticationError('Custom message');
        }
    }

    const memoryLogger = new MemoryLoggerTransport;
    const kernel = new RpcKernel(undefined, new MyKernelSecurity, new Logger([memoryLogger]));
    const client = new DirectClient(kernel);

    client.token.set('generic');
    await expect(() => client.connect()).rejects.toThrow('Authentication failed');
    //generic errors get logged
    expect(memoryLogger.messages.length).toBe(1);
    expect(memoryLogger.messageStrings[0]).toContain('authenticate failed Error: Secure error');

    client.token.set('asd');
    await expect(() => client.connect()).rejects.toThrow('Custom message');
    //AuthenticationError don't get logged.
    expect(memoryLogger.messages.length).toBe(1);
});


test('onAuthenticate controllers', async () => {
    class AuthenticatedSession extends Session {
        isAnonymous(): boolean {
            return false;
        }
    }

    @injectable()
    class Controller {
        constructor(protected connection: RpcKernelConnection) {
        }

        @rpc.action()
        authenticated(): boolean {
            return this.connection.sessionState.getSession() instanceof AuthenticatedSession;
        }

        @rpc.action()
        auth(value: string): boolean {
            if (value === 'secret') {
                this.connection.sessionState.setSession(new AuthenticatedSession('safe', undefined));
                return true;
            }
            return false;
        }
    }

    const kernel = new RpcKernel(undefined);
    kernel.registerController('test', Controller);

    class CustomAuthClient extends AsyncDirectClient {
        authCalled: number = 0;
        protected async onAuthenticate(): Promise<void> {
            if (!this.token.has()) return;
            this.authCalled++;
            const success = await this.controller<Controller>('test', {dontWaitForConnection: true}).auth(this.token.get());
            if (!success) throw new AuthenticationError('Invalid');
        }
    }

    {
        const client = new CustomAuthClient(kernel);
        expect(await client.controller<Controller>('test').authenticated()).toBe(false);
        expect(await client.controller<Controller>('test').auth('secret')).toBe(true);
        expect(await client.controller<Controller>('test').authenticated()).toBe(true);
        expect(client.authCalled).toBe(0);
    }

    {
        const client = new CustomAuthClient(kernel);
        expect(await client.controller<Controller>('test').authenticated()).toBe(false);
        expect(await client.controller<Controller>('test').auth('wrong')).toBe(false);
        expect(await client.controller<Controller>('test').authenticated()).toBe(false );
        expect(client.authCalled).toBe(0);
    }

    {
        const client = new CustomAuthClient(kernel);
        client.token.set('secret');
        expect(client.transporter.isConnected()).toBe(false);
        expect(await client.controller<Controller>('test').authenticated()).toBe(true);
        expect(client.transporter.isConnected()).toBe(true);
        expect(client.authCalled).toBe(1);
        expect(await client.controller<Controller>('test').authenticated()).toBe(true);
        expect(client.authCalled).toBe(1);
    }

    {
        const client = new CustomAuthClient(kernel);
        client.token.set('secret');
        const res = await Promise.all([
            client.controller<Controller>('test').authenticated(),
            client.controller<Controller>('test').authenticated(),
            client.controller<Controller>('test').authenticated(),
        ]);
        expect(client.authCalled).toBe(1);
        expect(res).toEqual([true, true, true]);
    }
});
