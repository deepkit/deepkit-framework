/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrokerDirectClient, BrokerKernel } from "@deepkit/broker";
import { t } from "@deepkit/type";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const bench = new BenchSuite('broker');

    const keyId = client.key('id', schema);

    bench.addAsync('set', async () => {
        await keyId.set({ v: 123 });
    });

    bench.addAsync('get', async () => {
        const v = await keyId.getOrUndefined();
    });

    bench.addAsync('get undefined', async () => {
        const v = await client.key('id-unknown', schema).getOrUndefined();
    });

    bench.addAsync('increment', async () => {
        await client.increment('inc1', 2);
    });

    bench.addAsync('increment get', async () => {
        const v = await client.getIncrement('inc1');
    });

    await bench.runAsync();
}
