/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { plainToClass, t } from '@deepkit/type';
import { buildChanges, getInstanceState, getJITConverterForSnapshot } from '@deepkit/orm';
import { BenchSuite } from '../bench';

export async function main() {
    const schema = t.schema({
        id: t.number.primary,
        name: t.string,
        priority: t.number,
        tags: t.array(t.string),
        ready: t.boolean
    });

    const item = plainToClass(schema, { id: 0, name: 'Peter', priority: 4, tags: ['a', 'b', 'c'], ready: true });

    const bench = new BenchSuite('change-detection');
    const createSnapshot = getJITConverterForSnapshot(schema);

    bench.add('create-snapshot', () => {
        const bla = createSnapshot(item);
    });

    getInstanceState(item).markAsPersisted();
    item.name = 'Alex';
    item.tags = ['a', 'b', 'c'];
    bench.add('build-changeSet', () => {
        buildChanges(item);
    });

    bench.run();
}
