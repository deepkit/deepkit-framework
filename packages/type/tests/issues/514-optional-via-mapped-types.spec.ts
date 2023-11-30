/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt, Apollo Software Limited, SamJakob
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */


import {expect, test } from '@jest/globals';
import { integer } from "../../src/reflection/type";
import {ReflectionClass} from "../../src/reflection/reflection";

interface User {
    readonly id: integer;
    readonly name?: string;
    readonly address: string;
    readonly postcode: string;
}

type PartialUser = Pick<
    User,
    'id' | 'name'
>;

test('the optional modifier should be retained after a mapped type', () => {
    // This has always worked: checking the optional property on the original type
    const reflectionClass = ReflectionClass.from<User>();
    expect(reflectionClass.getProperty('id').isOptional()).toBe(false);
    expect(reflectionClass.getProperty('name').isOptional()).toBe(true);

    // ...but it should work if we map it with - e.g., Pick - too.
    const partialReflectionClass = ReflectionClass.from<PartialUser>();
    expect(partialReflectionClass.getProperty('id').isOptional()).toBe(false);
    expect(partialReflectionClass.getProperty('name').isOptional()).toBe(true);
});
