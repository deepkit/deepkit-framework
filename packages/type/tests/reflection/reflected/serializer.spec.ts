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
import { reflect, typeOf } from '../../../src/reflection/reflection';
import { integer } from '../../../src/reflection/type';
import { cast, createSerializeFunction, jsonSerializer, serialize } from '../../../src/serializer';

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


test('default value', () => {
    class User {
        logins: number = 0;
    }

    {
        const user = cast<User>({});
        expect(user).toBeInstanceOf(User);
        expect(user).toEqual({
            logins: 0
        });
    }

    {
        const user = cast<User>({logins: 2});
        expect(user).toEqual({
            logins: 2
        });
    }
});

test('optional value', () => {
    class User {
        logins?: number;
    }

    {
        const user = cast<User>({});
        expect(user).toEqual({
            logins: undefined
        });
    }

    {
        const user = cast<User>({logins: 2});
        expect(user).toEqual({
            logins: 2
        });
    }
});

test('optional default value', () => {
    class User {
        logins?: number = 2;
    }

    {
        const user = cast<User>({});
        expect(user).toEqual({
            logins: 2
        });
    }

    {
        const user = cast<User>({logins: 2});
        expect(user).toEqual({
            logins: 2
        });
    }

    {
        const user = cast<User>({logins: null});
        expect(user).toEqual({
            logins: undefined
        });
    }

    {
        const user = cast<User>({logins: undefined});
        expect(user).toEqual({
            logins: undefined
        });
    }
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

test('tuple 2', () => {
    const value = cast<[string, number]>([12, '13']);
    expect(value).toEqual(['12', 13]);
});

test('tuple rest', () => {
    {
        const value = cast<[...string[], number]>([12, '13']);
        expect(value).toEqual(['12', 13]);
    }
    {
        const value = cast<[...string[], number]>([12, 13, '14']);
        expect(value).toEqual(['12', '13', 14]);
    }
    {
        const value = cast<[boolean, ...string[], number]>([1, 12, '13']);
        expect(value).toEqual([true, '12', 13]);
    }
    {
        const value = cast<[boolean, ...string[], number]>([1, 12, 13, '14']);
        expect(value).toEqual([true, '12', '13', 14]);
    }
});

test('set', () => {
    {
        const value = cast<Set<string>>(['a', 'a', 'b']);
        expect(value).toEqual(new Set(['a', 'b']));
    }
    {
        const value = serialize<Set<string>>(new Set(['a', 'b']));
        expect(value).toEqual(['a', 'b']);
    }
});

test('map', () => {
    {
        const value = cast<Map<string, number>>([['a', 1], ['a', 2], ['b', 3]]);
        expect(value).toEqual(new Map([['a', 2], ['b', 3]]));
    }
    {
        const value = serialize<Map<string, number>>(new Map([['a', 2], ['b', 3]]));
        expect(value).toEqual([['a', 2], ['b', 3]]);
    }
});

