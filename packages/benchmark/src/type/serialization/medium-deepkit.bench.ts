/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createClassToXFunction, createXToClassFunction, Entity, f, getClassSchema, jsonSerializer } from '@deepkit/type';
import { BenchSuite } from '../../bench';


@Entity('sub')
export class SubModel {
    @f
    label: string;

    @f.optional
    age?: number;

    constructorUsed = false;

    constructor(label: string) {
        this.label = label;
        this.constructorUsed = true;
    }
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

export class Model {
    @f
    name: string;

    @f
    type: number = 0;

    @f
    yesNo: boolean = false;

    @f.enum(Plan)
    plan: Plan = Plan.DEFAULT;

    @f
    created: Date = new Date;

    @f.array(String)
    types: string[] = [];

    @f.array(SubModel)
    children: SubModel[] = [];

    @f.map(SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    notMapped: { [key: string]: any } = {};

    @f.exclude()
    excluded: string = 'default';

    @f.exclude('json')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}
const ModelSerializer = jsonSerializer.for(Model);

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
