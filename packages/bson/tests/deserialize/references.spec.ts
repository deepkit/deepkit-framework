/**
 * Deserialization tests for References
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { getClassName } from '@deepkit/core';
import { expect } from '@deepkit/run/expect';
import { PrimaryKey, Reference } from '@deepkit/type';

import { deserializeBSON } from '../../index.js';

const { serialize } = bson;

describe('reference deserialization', () => {
    class User {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {}
    }

    test('reference from primary key', () => {
        type T = { v: User & Reference };
        const item = deserializeBSON<T>(serialize({ v: 23 }));
        expect(item).toEqual({ v: { id: 23 } });
        expect(item.v).toBeInstanceOf(User);
        expect(getClassName(item.v)).toBe('UserReference');
    });

    test('reference from full object', () => {
        type T = { v: User & Reference };
        const item = deserializeBSON<T>(serialize({ v: { id: 34, username: 'Peter' } }));
        expect(item).toEqual({ v: { id: 34, username: 'Peter' } });
        expect(item.v).toBeInstanceOf(User);
        expect(getClassName(item.v)).toBe('User');
    });
});

describe('reference in union', () => {
    class User {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {}
    }

    test('reference from primary key in union', () => {
        type T = { v: (User & Reference) | string[] };

        const item = deserializeBSON<T>(serialize({ v: 23 }));
        expect(item).toEqual({ v: { id: 23 } });
        expect(item.v).toBeInstanceOf(User);
        expect(getClassName(item.v)).toBe('UserReference');
    });

    test('reference from full object in union', () => {
        type T = { v: (User & Reference) | string[] };

        const item = deserializeBSON<T>(serialize({ v: { id: 34, username: 'Peter' } }));
        expect(item).toEqual({ v: { id: 34, username: 'Peter' } });
        expect(item.v).toBeInstanceOf(User);
        expect(getClassName(item.v)).toBe('User');
    });
});

describe('constructor parameters', () => {
    test('class with constructor public property', () => {
        class A {
            id: number = 0;

            constructor(public username: string) {}
        }

        type T = { v: A };
        expect(deserializeBSON<T>(serialize({ v: new A('Peter') }))).toEqual({ v: { id: 0, username: 'Peter' } });
    });
});

describe('class deserialization', () => {
    test('class with constructor', () => {
        class User {
            id: number = 0;

            constructor(public username: string) {}
        }

        {
            const user = deserializeBSON<User>(serialize({ username: 'Peter' }));
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.id).toBe(0);
        }

        {
            const user = deserializeBSON<User>(serialize({ id: 3, username: 'Peter' }));
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.id).toBe(3);
        }
    });

    test('class no constructor', () => {
        class User {
            id: number = 0;
            username!: string;
        }

        {
            const user = deserializeBSON<User>(serialize({ username: 'Peter' }));
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.id).toBe(0);
        }

        {
            const user = deserializeBSON<User>(serialize({ id: 3, username: 'Peter' }));
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.id).toBe(3);
        }
    });

    test('optional property with initializer uses default', () => {
        const defaultValue = new Date();

        class User {
            v: Date = defaultValue;
        }

        expect(deserializeBSON<User>(serialize({ v: new Date(1) }))).toEqual({ v: new Date(1) });
        expect(deserializeBSON<User>(serialize({ v: undefined }))).toEqual({ v: defaultValue });
        expect(deserializeBSON<User>(serialize({ v: null }))).toEqual({ v: defaultValue });
        expect(deserializeBSON<User>(serialize({}))).toEqual({ v: defaultValue });
    });
});

describe('additional fields', () => {
    test('additional fields are ignored', () => {
        const data = {
            setVersion: 1,
            ismaster: true,
        };

        interface IsMasterResponse {
            ismaster: boolean;
        }

        const bson = serialize(data);
        const back = deserializeBSON<IsMasterResponse>(bson);
        expect(back).toEqual({ ismaster: true });
    });
});

describe('circular types', () => {
    test('circular type deserialization', () => {
        class Model {
            id: number = 0;
            child?: Model;
        }

        interface Response {
            items: Model[];
        }

        const bson = serialize({ items: [{ id: 0, child: { id: 2 } }] });
        const back = deserializeBSON<Response>(bson);
        expect(back).toEqual({ items: [{ id: 0, child: { id: 2 } }] });
    });
});
