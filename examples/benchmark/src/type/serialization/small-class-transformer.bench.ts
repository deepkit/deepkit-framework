/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    classToPlain,
    plainToClass
} from "class-transformer";
import { BenchSuite } from '../../bench.js';

export class Model {
    public id?: number;
    public name?: string;

    ready?: boolean;

    tags: string[] = [];

    priority: number = 0;
}

export async function main() {
    const suite = new BenchSuite('class-transformer');
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    };

    suite.add('deserialize', () => {
        plainToClass(Model, plain);
    });

    const item = plainToClass(Model, plain);
    suite.add('serialize', () => {
        classToPlain(item);
    });

    suite.run();
}
