/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { getClassSchema, jsonSerializer, t } from '@deepkit/type';
import { getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator } from '@deepkit/orm';
import { BenchSuite } from '../bench.js';

class Image {
    @t title: string = '';

    constructor(@t.primary public id: number = 0) {
    }
}

class User {
    @t.reference().optional image?: Image;
    @t title: string = '';

    constructor(@t.primary public id: number = 0) {
    }
}

export async function main() {

    const suite = new BenchSuite('converter');

    const schema = getClassSchema(User);

    const item = { id: 22, title: 'Peter', image: new Image(3) };

    suite.add('primaryKeyExtractor-getter', () => {
        getPrimaryKeyExtractor(schema);
    });

    suite.add('converterForSnapshot-getter', () => {
        getJITConverterForSnapshot(schema);
    });

    suite.add('primaryKeyHashGenerator-getter', () => {
        getPrimaryKeyHashGenerator(schema, jsonSerializer);
    });

    suite.add('primaryKeyExtractor', () => {
        const converted = getPrimaryKeyExtractor(schema)(item);
    });

    suite.add('converterForSnapshot', () => {
        const converted = getJITConverterForSnapshot(schema)(item);
    });

    suite.add('primaryKeyHashGenerator', () => {
        const converted = getPrimaryKeyHashGenerator(schema, jsonSerializer)(item);
    });

    const hash = getPrimaryKeyHashGenerator(schema, jsonSerializer);
    suite.add('primaryKeyHashGenerator-saved', () => {
        const converted = hash(item);
    });

    const snap = getJITConverterForSnapshot(schema);
    suite.add('converterForSnapshot-saved', () => {
        const converted = snap(item);
    });

    var _value = item;
    suite.add('primaryKeyHashGenerator-ref', () => {
        var _result = '';
        var lastValue;

        //getPrimaryKeyHashGenerator id class:plain:number
        lastValue = '';

        if (_value.id === undefined) {


        } else if (_value.id === null) {


        } else {
            lastValue = _value.id;
        }

        _result += ' ' + lastValue;
        _result;
    });

    suite.run();
}
