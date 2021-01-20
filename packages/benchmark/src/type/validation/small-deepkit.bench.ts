/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t, validateFactory } from '@deepkit/type';
import { good } from './validation';
import { BenchSuite } from '../../bench';

const Model = t.schema({
    number: t.number,
    negNumber: t.number.negative(),
    maxNumber: t.number.maximum(500),
    strings: t.array(t.string),
    longString: t.string,
    boolean: t.boolean,
    deeplyNested: t.type({
        foo: t.string,
        num: t.number,
        bool: t.boolean
    })
});
const validate = validateFactory(Model);

export async function main() {
    const suite = new BenchSuite('deepkit');

    if (!validate(good)) throw new Error('Should be valid');

    suite.add('validate', () => {
        validate(good);
    });

    suite.run();
}
