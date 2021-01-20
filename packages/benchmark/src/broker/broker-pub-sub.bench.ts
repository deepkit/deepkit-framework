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
import { sleep } from "@deepkit/core";
import { t } from "@deepkit/type";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const bench = new BenchSuite('broker');
    const channel = client.channel('id', schema);

    let count = 0;
    await channel.subscribe((next) => { count++; });

    bench.addAsync('publish subscribed', async () => {
        await channel.publish({ v: 123 });
    });

    await bench.runAsync();
    console.log('called', count);
}
