import { expect, test } from '@jest/globals';
import { typeOf } from '../src/reflection/reflection';
import { defaultValue } from '../src/default';

test('default basic', () => {
    expect(defaultValue(typeOf<undefined>())).toBe(undefined);
    expect(defaultValue(typeOf<null>())).toBe(null);
    expect(defaultValue(typeOf<string>())).toBe('');
    expect(defaultValue(typeOf<number>())).toBe(0);
    expect(defaultValue(typeOf<boolean>())).toBe(false);
    expect(defaultValue(typeOf<bigint>())).toBe(BigInt(0));
    expect(defaultValue(typeOf<string[]>())).toEqual([]);
    expect(defaultValue(typeOf<Date>())).toBeInstanceOf(Date);
    expect(defaultValue(typeOf<Set<any>>())).toBeInstanceOf(Set);
    expect(defaultValue(typeOf<Map<any, any>>())).toBeInstanceOf(Map);
});

test('default tuple', () => {
    expect(defaultValue(typeOf<[string]>())).toEqual(['']);
    expect(defaultValue(typeOf<[string, number]>())).toEqual(['', 0]);
    expect(defaultValue(typeOf<[...string[], number]>())).toEqual(['', 0]);
    expect(defaultValue(typeOf<[string, number?]>())).toEqual(['']);
});

test('default enum', () => {
    enum Enum {
        a= 1,
        b,
        c = 4
    }

    expect(defaultValue(typeOf<Enum>())).toEqual(1);
    expect(defaultValue(typeOf<Enum>())).toEqual(1);
});

test('default interface', () => {
    interface Base {
        id: number;
    }

    interface User extends Base {
        username: string;
        created?: Date;
    }

    expect(defaultValue(typeOf<Base>())).toEqual({id: 0});
    expect(defaultValue(typeOf<User>())).toEqual({id: 0, username: ''});
});


test('default class', () => {
    class Base {
        id: number = 0;
    }

    class User extends Base {
        username!: string;
        created?: Date;
    }

    expect(defaultValue(typeOf<Base>())).toEqual({id: 0});
    expect(defaultValue(typeOf<User>())).toEqual({id: 0, username: ''});
});
