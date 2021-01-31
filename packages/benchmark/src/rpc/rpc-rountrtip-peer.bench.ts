/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from "@deepkit/core";
import { DirectClient, rpc, RpcKernel } from "@deepkit/rpc";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

class SimpleInjector {
    get(classType: ClassType) {
        return new classType;
    }
}

export async function main() {
    const kernel = new RpcKernel();
    let called = 0;

    const client1 = new DirectClient(kernel);
    class Controller {
        @rpc.action()
        action(value: string): string {
            called++;
            return value;
        }
    }

    await client1.registerAsPeer('peer1');
    client1.registerController('foo', Controller);

    const client2 = new DirectClient(kernel);

    const controller = client2.peer('peer1').controller<Controller>('foo');
    const res = await controller.action('bar');

    const bench = new BenchSuite('peer');

    bench.addAsync('action', async () => {
        const res = await controller.action('bar');
    });

    await bench.runAsync();

    console.log('called', called);
}
