/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import { createRpcMessage, DirectClient, readRpcMessage, rpc, rpcAction, RpcKernel } from '@deepkit/rpc';
import { BenchSuite } from '../bench';

export async function main() {
    const bench1 = new BenchSuite('protocol');
    const bson = createRpcMessage(0, 4, rpcAction, { controller: 'asd', method: 'asd' });
    readRpcMessage(bson).parseBody(rpcAction);

    bench1.add('encode', () => {
        const message = createRpcMessage(0, 4, rpcAction, { controller: 'asd', method: 'asd' });
    });

    bench1.add('decode', () => {
        const message = readRpcMessage(bson);
        const body = message.parseBody(rpcAction);
    });

    bench1.run();

    let called = 0;

    class Controller {
        @rpc.action()
        action(value: string): string {
            called++;
            return value;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    // const connection = kernel.createConnection({ write: (v) => console.log(readRpcMessage(v)) });
    // connection.handleMessage(createRpcMessage(0, RpcTypes.ActionType, rpcActionType, { controller: 'myController', method: 'action' }));

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    const bench = new BenchSuite('controller');
    // const res = await controller.action('foo');
    // console.log('res', res);

    bench.addAsync('action', async () => {
        // await client.sendMessage(RpcTypes.Ping).ackThenClose();
        const res = await controller.action('foo');
    });

    await bench.runAsync();

    console.log('called', called);
}
