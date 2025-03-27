import { getAction, getContextId, MessageFlag, writeAction, writeContextNoRoute } from '../src/protocol.js';
import { add, run } from '@deepkit/bench';
import { RpcAction } from '../src/model.js';

const message = new Uint8Array(32);

// todo: this is faster in ESM. We have to switch back to CJS in @deepkit/run
//  => ok fixed by using node 23
// const b = writeContext;

add('write', () => {
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextExisting | MessageFlag.TypeAction;
    writeContextNoRoute(message, 1);
    writeAction(message, RpcAction.Ping);
});

add('read', () => {
    const contextId = getContextId(message);
    const action = getAction(message);
});

run();
