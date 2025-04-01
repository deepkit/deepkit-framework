import { benchmark, run } from '@deepkit/bench';
import { rpc } from '../src/decorators.js';
import { ActionDispatcher } from '../src/action.js';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { getActionOffset, MessageFlag, writeAction } from '../src/protocol.js';
import { Writer } from '@deepkit/bson';

let calls1 = 0;
let calls2 = 0;

class Controller {
    @rpc.action()
    myAction() {
        calls1++;
    }

    @rpc.action()
    test2(a: number) {
        calls2++;
    }
}

const module = new InjectorModule([
    { provide: Controller, scope: 'rpc' },
]);

const injector = new InjectorContext(module);

const actions = new ActionDispatcher;
actions.build(injector, [{ name: 'test', controller: Controller, module }]);

const message1 = new Uint8Array(32);
message1[0] = MessageFlag.TypeAction;
writeAction(message1, 0);

const scope = injector.createChildScope('rpc');
actions.dispatch(message1, scope.scope!);

console.log('calls', calls1);

benchmark('action dispatcher', () => {
    // we need to optimise scope. Turn it into an array of instances not a object
    actions.dispatch(message1, scope.scope!);
});

const message2 = new Uint8Array(3 + 8);
writeAction(message2, 1);
const bodyOffset = getActionOffset(message2[0]) + 2;
const writer = new Writer(message2, bodyOffset);
writer.writeDouble(256);

benchmark('action with arg', () => {
    actions.dispatch(message2, scope.scope!);
});

run().then(() => {
    console.log('done');
    console.log('calls1', calls1);
    console.log('calls2', calls2);
})
