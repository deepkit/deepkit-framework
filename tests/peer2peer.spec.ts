import 'jest';
import 'reflect-metadata';
import {Action, Controller, ReturnType} from "@marcj/glut-core";
import {Entity, Field} from '@marcj/marshal';
import {createServerClientPair} from "./util";
import {Application} from "@marcj/glut-server";
import {Session} from "@marcj/glut-server";
import {Injector} from 'injection-js';
import {Observable} from 'rxjs';
import {InternalClient} from "@marcj/glut-server";

// @ts-ignore
global['WebSocket'] = require('ws');

@Entity('user')
class User {
    constructor(@Field() public name: string) {
        this.name = name;
    }
}

test('test peer2peer', async () => {
    @Controller('test')
    class TestController {
        @Action()
        @ReturnType(String)
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }

        @Action()
        user(name: string): User {
            return new User(name);
        }

        @Action()
        ob(): Observable<string> {
            return new Observable(() => {});
        }

        @Action()
        throwError(): void {
            throw new Error('Errored.');
        }
    }

    class MyAppController extends Application {
        async isAllowedToRegisterPeerController<T>(injector: Injector, session: Session | undefined, controllerName: string): Promise<boolean> {
            if (controllerName === 'forbiddenToRegister') return false;
            return true;
        }

        async isAllowedToSendToPeerController<T>(injector: Injector, session: Session | undefined, controllerName: string): Promise<boolean> {
            if (controllerName === 'forbiddenToSend') return false;
            return true;
        }
    }

    const {client, server, createClient, close} = await createServerClientPair('test basic setup', [], [], MyAppController);

    await client.registerController('test', new TestController);

    const client2 = createClient();
    const peerController = client2.peerController<TestController>('test');

    const result = await peerController.names('myName');
    expect(result).toEqual(['a', 'b', 'c', 'myName']);

    const user = await peerController.user('Peter');
    expect(user).toBeInstanceOf(User);
    expect(user.name).toBe('Peter');

    try {
        await peerController.ob();
        fail('should error');
    } catch (error) {
        expect(error.message).toBe('Action ob returned Observable, which is not supported.');
    }

    try {
        await peerController.throwError();
        fail('should error');
    } catch (error) {
        expect(error.message).toBe('Errored.');
    }

    try {
        await (peerController as any).nothing();
        fail('should error');
    } catch (error) {
        expect(error.message).toBe('Action nothing does not exist.');
    }

    try {
        await client.registerController('forbiddenToRegister', new TestController);
        fail('should error');
    } catch (error) {
        expect(error.message).toBe('Access denied');
    }

    await client.registerController('forbiddenToSend', new TestController);
    try {
        const controller2 = client2.peerController<TestController>('forbiddenToSend');
        await controller2.names('asd');
        fail('should error');
    } catch (error) {
        expect(error.message).toBe('Access denied');
    }

    const internalClient: InternalClient = server.getInjector().get(InternalClient);
    const internalPeerController = internalClient.peerController<TestController>('test');
    {
        const result = await internalPeerController.names('myName');
        expect(result).toEqual(['a', 'b', 'c', 'myName']);

        const user = await internalPeerController.user('Peter');
        expect(user).toBeInstanceOf(User);
        expect(user.name).toBe('Peter');

        try {
            await internalPeerController.throwError();
            fail('should error');
        } catch (error) {
            expect(error.message).toBe('Errored.');
        }
    }

    await close();
});
