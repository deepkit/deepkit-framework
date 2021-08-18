/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createClassToXFunction, createXToClassFunction, f, getClassSchema, jsonSerializer } from '@deepkit/type';
import { BenchSuite } from '../../bench';

class Model {
    @f ready?: boolean;

    @f.array(String) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

const ModelSerializer = jsonSerializer.for(Model);

export async function main() {
    const suite = new BenchSuite('deepkit');
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    };

    const schema = getClassSchema(Model);

    suite.add('JIT XToClass', () => {
        createXToClassFunction(schema, jsonSerializer);
    });

    suite.add('JIT ClassToX', () => {
        createClassToXFunction(schema, jsonSerializer);
    });

    suite.add('deserialize', () => {
        ModelSerializer.deserialize(plain);
    });

    const item = jsonSerializer.for(Model).deserialize(plain);
    suite.add('serialize', () => {
        ModelSerializer.serialize(item);
    });

    suite.run();
}
