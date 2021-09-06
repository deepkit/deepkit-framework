/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import * as t from 'io-ts';
import { BenchSuite } from '../../bench';

const decoderIoTS = t.type({
    ready: t.boolean,
    tags: t.array(t.string),
    priority: t.number,
    id: t.number,
    name: t.string,
})


export async function main() {
    const suite = new BenchSuite('io-ts');
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    };

    const decoded = decoderIoTS.decode(plain);
    suite.add('serialize', () => {
        //there is something wrong with that, as it does nothing
        decoderIoTS.encode(plain);
    });

    suite.add('deserialize', () => {
        decoderIoTS.decode(plain);
    });

    suite.run();
}
