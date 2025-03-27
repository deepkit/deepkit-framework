import { add, run } from '@deepkit/bench';
import { rpc } from '../src/decorators.js';
import { ActionDispatcher } from '../src/action.js';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { MessageFlag, writeAction } from '../src/protocol.js';

let calls = 0;

class Controller {
    @rpc.action()
    myAction() {
        calls++;
    }
}

const module = new InjectorModule([
    { provide: Controller, scope: 'rpc' },
]);

const injector = new InjectorContext(module);

const actions = new ActionDispatcher;
actions.build(injector, [{ name: 'test', controller: Controller, module }]);

const message = new Uint8Array(32);
message[0] = MessageFlag.TypeAction;
writeAction(message, 0);

const scope = injector.createChildScope('rpc');
actions.dispatch(message, scope.scope!);

console.log('calls', calls);

add('action dispatcher', () => {
    // we need to optimise scope. Turn it into an array of instances not a object
    actions.dispatch(message, scope.scope!);
});

run();
