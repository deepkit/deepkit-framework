/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Maximum, Negative, guard } from '@deepkit/type';
import { good } from './validation';
import { BenchSuite } from '../../bench';

interface Model {
    number: number;
    negNumber: number & Negative;
    maxNumber: number & Maximum<500>;
    strings: string[];
    longString: string;
    boolean: boolean;
    deeplyNested: {
        foo: string;
        num: number;
        bool: boolean;
    }
}

const validate = guard<Model>();

export async function main() {
    const suite = new BenchSuite('deepkit');

    if (!validate(good)) throw new Error('Should be valid');
    if (validate({...good, negNumber: 100})) throw new Error('Should be invalid');

    suite.add('validate', () => {
        validate(good);
    });

    suite.run();
}
