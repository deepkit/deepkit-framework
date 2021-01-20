/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from '../bench';

export function main() {
    const bench = new BenchSuite('prototype');

    class Peter { }

    const sub = class extends Peter { };

    bench.add('Object.getPrototypeOf', () => {
        const same = Object.getPrototypeOf(sub) === Peter;
    });

    bench.run();
}
