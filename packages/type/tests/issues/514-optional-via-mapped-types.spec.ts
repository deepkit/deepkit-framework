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
import { ReflectionClass, typeOf } from "../../src/reflection/reflection";
import {expectEqualType} from "../utils";

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

type Test = {name: User['name'], address: User['address']};
type Username = User['name'];
type Username2 = Test['name'];

test('The optional property should not carry over when a property is mapped (consistent with TypeScript)', () => {
    const reflectionClass = ReflectionClass.from<User>();
    expect(reflectionClass.getProperty('address').isOptional()).toBe(false); // (sanity check)
    expect(reflectionClass.getProperty('name').isOptional()).toBe(true);

    const alteredReflectionClass = ReflectionClass.from<Test>();
    expect(alteredReflectionClass.getProperty('address').isOptional()).toBe(false); // (sanity check)
    expect(alteredReflectionClass.getProperty('name').isOptional()).toBe(false);

    expectEqualType(typeOf<Username>(), typeOf<Username2>(), { noTypeNames: true });
});

type UserNestedType = Omit<Pick<
    User,
    'id' | 'name' | 'address'
>, 'id'>;

test('Nested mapped types should work', () => {
    const nestedReflectionClass = ReflectionClass.from<UserNestedType>();
    expect(nestedReflectionClass.getProperty('name').isOptional()).toBe(true);
    expect(nestedReflectionClass.getProperty('address').isOptional()).toBe(false);
});
