import { expect, test } from '@jest/globals';
import { ActionDispatcher } from '../src/action.js';
import { rpc } from '../src/decorators.js';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { getActionOffset, writeAction } from '../src/protocol.js';
import { serializeBSONWithoutOptimiser, Writer } from '@deepkit/bson';

test('action', async () => {
    const dispatcher = new ActionDispatcher();

    let calls1 = 0;
    const calls2: number[] = [];
    const calls3: [number, string][] = [];
    const calls4: any[] = [];

    class Controller {
        @rpc.action()
        test1() {
            calls1++;
        }

        @rpc.action()
        test2(a: number) {
            calls2.push(a);
        }

        @rpc.action()
        test3(a: number, b: string) {
            calls3.push([a, b]);
        }

        @rpc.action()
        test4(a: number | string) {
            calls4.push(a);
        }
    }

    const module = new InjectorModule([{ provide: Controller, scope: 'rpc' }]);
    const injector = new InjectorContext(module);
    dispatcher.build(injector, [
        { name: 'main', controller: Controller, module },
    ]);

    const scope = injector.createChildScope('rpc');

    {
        const message = new Uint8Array(3);
        writeAction(message, 0);
        dispatcher.dispatch(message, scope.scope!);
        expect(calls1).toBe(1);
    }

    {
        const message = new Uint8Array(3 + 8);
        writeAction(message, 1);
        const bodyOffset = getActionOffset(message[0]) + 2;
        const writer = new Writer(message, bodyOffset);
        writer.writeDouble(256);
        dispatcher.dispatch(message, scope.scope!);
        console.log('calls2', calls2);
        expect(calls2).toEqual([256]);
    }

    {
        const message = new Uint8Array(3 + 8 + 4 + 5);
        writeAction(message, 2);
        const bodyOffset = getActionOffset(message[0]) + 2;
        const writer = new Writer(message, bodyOffset);
        writer.writeDouble(256);

        writer.writeUint32(5);
        writer.writeString('1234');
        writer.writeByte(0);

        dispatcher.dispatch(message, scope.scope!);
        console.log('calls3', calls3);
        expect(calls3).toEqual([[256, '1234']]);
    }

    {
        const message = new Uint8Array(3 + 32);
        writeAction(message, 3);
        const bodyOffset = getActionOffset(message[0]) + 2;
        const bson = serializeBSONWithoutOptimiser([123]);
        message.set(bson, bodyOffset);

        dispatcher.dispatch(message, scope.scope!);
        console.log('calls4', calls4);
        expect(calls4).toEqual([123]);
    }

    {
        const message = new Uint8Array(3 + 32);
        writeAction(message, 3);
        const bodyOffset = getActionOffset(message[0]) + 2;
        const bson = serializeBSONWithoutOptimiser(['abc']);
        message.set(bson, bodyOffset);

        dispatcher.dispatch(message, scope.scope!);
        console.log('calls4', calls4);
        expect(calls4).toEqual([123, 'abc']);
    }
});
