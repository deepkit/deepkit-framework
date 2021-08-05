/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { asyncOperation } from '@deepkit/core';
import { BenchSuite } from '../bench';


export async function main() {

    const bench = new BenchSuite('asyncOperation');

    bench.addAsync('empty', async () => {
    });

    bench.addAsync('new Promise', async () => {
        await new Promise((resolve) => {
            resolve(undefined);
        });
    });

    bench.addAsync('asyncOperation', async () => {
        await asyncOperation((resolve) => {
            resolve(undefined);
        });
    });

    await bench.runAsync();
}
