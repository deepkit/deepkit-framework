/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from '../../bench.js';
import { IsArray, IsBoolean, IsInt, IsNegative, IsString, Max, validate, ValidateNested, } from 'class-validator';
import { good } from './validation.js';

export class Nested {
    @IsString()
    foo!: string;

    @IsInt()
    num!: number;

    @IsBoolean()
    bool!: boolean;
}

export class Model {
    @IsInt()
    number!: number;

    @IsInt()
    @IsNegative()
    negNumber!: number;

    @IsInt()
    @Max(500)
    maxNumber!: number;

    @IsArray()
    @IsString({ each: true })
    strings!: string[];

    @IsString()
    longString!: string;

    @IsBoolean()
    boolean!: boolean;

    @ValidateNested()
    deeplyNested!: Nested;
}

export async function main() {
    const suite = new BenchSuite('class-validator');
    const model = new Model;
    model.number = 1;
    model.negNumber = -1;
    model.maxNumber = 200;
    model.strings = ['a', 'b', 'c'];
    model.longString = good.longString;
    model.boolean = true;
    model.deeplyNested = new Nested;
    model.deeplyNested.foo = 'bar';
    model.deeplyNested.num = 1;
    model.deeplyNested.bool = false;

    suite.add('validate', async () => {
        await validate(model, {enableDebugMessages: true});
    });

    await suite.runAsync();
}
