import { expect, test } from '@jest/globals';
import { RpcKernel, RpcKernelConnection } from '../src/server/kernel.js';
import { createRpcMessage, RpcMessage } from '../src/protocol.js';
import { DirectClient } from '../src/client/client-direct.js';
import { sleep } from '@deepkit/core';

test('back controller', async () => {
    /**
     * @see RpcTypes
     */
    enum MyTypes {
        //the first 100 are reserved in @deepkit/rpc RpcTypes
        Ack,
        Error,

        // Our custom types:
        QueryAndAnswer = 100,
        Answer = 101,

        BroadcastWithAck = 102,
        Broadcast = 103,
    }

    let broadcastCalled: any = undefined;
    let broadcastWithAckCalled: any = undefined;

    class MyRpcKernelConnection extends RpcKernelConnection {
        async onMessage(message: RpcMessage): Promise<void> {
            if (message.type === MyTypes.QueryAndAnswer) {
                this.writer.write(createRpcMessage<{ v: string }>(message.id, MyTypes.Answer, { v: '42 is the answer' }));
                return;
            }

            if (message.type === MyTypes.BroadcastWithAck) {
                broadcastWithAckCalled = message.parseBody<{v: string}>()
                this.writer.write(createRpcMessage(message.id, MyTypes.Ack));
                return;
            }

            if (message.type === MyTypes.Broadcast) {
                // no ack wanted
                broadcastCalled = message.parseBody<{v: string}>()
                return;
            }

            // Handle all the other messages with the default behavior
            return super.onMessage(message);
        }
    }

    class MyKernel extends RpcKernel {
        RpcKernelConnection = MyRpcKernelConnection;
    }

    const kernel = new MyKernel();

    const client = new DirectClient(kernel);

    // This waits for the server's Ack
    const answer = await client
        .sendMessage(MyTypes.QueryAndAnswer)
        .firstThenClose<{ v: string }>(MyTypes.Answer);
    expect(answer.v).toBe('42 is the answer');

    // This waits for the server's Ack
    await client
        .sendMessage<{v: string}>(MyTypes.BroadcastWithAck, {v: 'Hi1'})
        .ackThenClose();
    expect(broadcastWithAckCalled).toEqual({v: 'Hi1'});

    // This does not wait for the server's Ack. release() call necessary to
    // release the message context.
    client
        .sendMessage<{v: string}>(MyTypes.Broadcast, {v: 'Hi2'})
        .release();

    await sleep(0.1);
    expect(broadcastCalled).toEqual({v: 'Hi2'});
});
