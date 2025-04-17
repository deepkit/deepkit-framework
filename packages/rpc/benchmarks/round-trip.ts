import { benchmark, run } from '@deepkit/bench';
import { rpc } from '../src/decorators.js';
import { RpcKernel } from '../src/server/kernel.js';
import { isContextFlag, MessageFlag, setContextFlag, writeAction } from '../src/protocol.js';
import { DirectClient } from '../src/client/client-direct.js';

let calls = 0;

class Controller {
    @rpc.action()
    myAction() {
        calls++;
    }

    @rpc.action()
    action1() {
        calls++;
    }

    @rpc.action()
    action2(value: string): string {
        calls++;
        return value;
    }
}

const kernel = new RpcKernel;
kernel.registerController(Controller, 'main');

const message = new Uint8Array(32);
message[0] = MessageFlag.TypeAction | MessageFlag.ContextNew;
writeAction(message, 0);
setContextFlag(message, MessageFlag.ContextNew);

const client = new DirectClient(kernel);
void client.connect();

client.write(message);
client.write(message);
client.write(message);
console.log('calls', calls);

// benchmark('action - no response', function benchmarkAction1() {
//     setContextFlag(message, MessageFlag.ContextNone);
//     client.write(message);
// });

function promiseCallback(resolve: any) {
    const id = client.selfContext.create(function contextReply(reply) {
        if (isContextFlag(reply[0], MessageFlag.ContextEnd)) {
            client.selfContext.release(id);
        }
        resolve();
    });
    client.write(message);
}

benchmark('action - promise response', async function benchmarkAction2() {
    setContextFlag(message, MessageFlag.ContextNew);
    await new Promise<void>(promiseCallback);
});

const controller = client.controller<Controller>('main');

benchmark('await action()', async function benchmarkAction2() {
    await controller.action1();
});

// benchmark('await action(string): string', async function benchmarkAction2() {
//     await controller.action2('foo');
// });
//
// benchmark('baseline empty promise', async function benchmarkAction2() {
//     await new Promise<void>((resolve) => {
//         resolve();
//     });
// });

run().then(() => {
    console.log('calls', calls);
    console.log('current context', client.selfContext.current());
    debugger;
}).catch((error: any) => {
    console.log(error);
});

