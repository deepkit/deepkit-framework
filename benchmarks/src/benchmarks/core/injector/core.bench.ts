/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BenchSuite } from '@deepkit/bench';
import { asyncOperation } from '@deepkit/core';

/**
 * Core async benchmark - compares AsyncOperation vs native Promise
 *
 * This benchmark tests:
 * - Empty async function baseline
 * - Native Promise creation and resolution
 * - Deepkit's asyncOperation utility
 *
 * asyncOperation is a utility that provides better stack traces
 * and improved debugging capabilities for async operations.
 */

export default async function () {
    const suite = new BenchSuite('core/async');

    suite.add('empty async', async () => {});

    suite.add('new Promise', async () => {
        await new Promise(resolve => {
            resolve(undefined);
        });
    });

    suite.add('asyncOperation', async () => {
        await asyncOperation(resolve => {
            resolve(undefined);
        });
    });

    return suite;
}
