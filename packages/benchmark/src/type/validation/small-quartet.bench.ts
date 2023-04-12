/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { good } from './validation.js';
//we use `e` and not `v` because deepkit/type supports out of the box error explanations, which quartet does only with `e`.
import { e } from 'quartet';
import { BenchSuite } from '../../bench.js';

const QuartetModelChecker = e<any>({
    number: e.number,
    negNumber: e.and(e.number, e.negative),
    maxNumber: e.number,
    strings: e.arrayOf(e.string),
    longString: e.and(e.string, e.minLength(100)),
    boolean: e.boolean,
});

export async function main() {
    const suite = new BenchSuite('quartet');

    suite.add('validate', () => {
        QuartetModelChecker(good);
    });

    suite.run();
}
