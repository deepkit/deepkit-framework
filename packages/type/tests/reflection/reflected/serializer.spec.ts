/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { expect, test } from '@jest/globals';
import { reflect } from '../../../src/reflection/reflection';
import { integer } from '../../../src/reflection/type';
import { cast, createSerializeFunction, jsonSerializer } from '../../../src/serializer';

test('serializer', () => {
    class User {
        username!: string;
        created!: Date;
    }

    const fn = createSerializeFunction(reflect(User), jsonSerializer.deserializeRegistry);
    const o = fn({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(o).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z')
    });
});

test('cast interface', () => {
    interface User {
        username: string;
        created: Date;
    }

    const user = cast<User>({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(user).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z')
    });
});

test('cast class', () => {
    class User {
        created: Date = new Date;

        constructor(public username: string) {}
    }

    const user = cast<User>({ username: 'Peter', created: '2021-10-19T00:22:58.257Z' });
    expect(user).toBeInstanceOf(User);
    expect(user).toEqual({
        username: 'Peter',
        created: new Date('2021-10-19T00:22:58.257Z')
    });
});

test('cast primitives', () => {
    expect(cast<string>('123')).toBe('123');
    expect(cast<string>(123)).toBe('123');
    expect(cast<number>(123)).toBe(123);
    expect(cast<number>('123')).toBe(123);

    expect(cast<Date>('2021-10-19T00:22:58.257Z')).toEqual(new Date('2021-10-19T00:22:58.257Z'));
});

test('cast integer', () => {
    const value = cast<integer>(123.456);
    expect(value).toBe(123);
});

