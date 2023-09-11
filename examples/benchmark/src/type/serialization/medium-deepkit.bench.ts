/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { deserializeFunction, Excluded, serializeFunction } from '@deepkit/type';
import { BenchSuite } from '../../bench.js';

export class SubModel {
    age?: number;

    constructorUsed = false;

    constructor(public label: string) {
        this.constructorUsed = true;
    }
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

export class Model {
    type: number = 0;

    yesNo: boolean = false;

    plan: Plan = Plan.DEFAULT;

    created: Date = new Date;

    types: string[] = [];

    children: SubModel[] = [];

    childrenMap: { [key: string]: SubModel } = {};

    notMapped: { [key: string]: any } = {};

    excluded: string & Excluded = 'default';

    excludedForPlain: string & Excluded<'json'> = 'excludedForPlain';

    constructor(public name: string) {
    }
}

const serializer = serializeFunction<Model>();
const deserializer = deserializeFunction<Model>();

export async function main() {
    const suite = new BenchSuite('deepkit');
    const plain = {
        name: 'name',
        type: 2,
        plan: Plan.ENTERPRISE,
        children: [{ label: 'label' }],
        childrenMap: { 'sub': { label: 'label' } },
        types: ['a', 'b', 'c']
    };

    suite.add('deserialize', () => {
        deserializer(plain);
    });

    const item = deserializer(plain);
    suite.add('serialize', () => {
        serializer(item);
    });

    suite.run();
}
