/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { randomBytes } from 'crypto';
import { BenchSuite } from '../bench';

export function main() {
    const bench = new BenchSuite('crypto');

    bench.add('randomBytes(32)', () => {
        randomBytes(32);
    });

    bench.add('randomBytes(64)', () => {
        randomBytes(64);
    });

    bench.add('randomBytes(256)', () => {
        randomBytes(256);
    });

    bench.run();
}
