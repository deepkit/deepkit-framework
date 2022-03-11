/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrokerDirectClient, BrokerKernel } from '@deepkit/broker';
import { BenchSuite } from '../bench';

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const bench = new BenchSuite('broker');

    bench.addAsync('lock', async () => {
        const lock = await client.lock('id');
        await lock.unsubscribe();
    });

    await bench.runAsync();
}
