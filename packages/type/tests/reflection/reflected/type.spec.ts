import { expect, test } from '@jest/globals';
import { typeOf } from '../../../src/reflection/reflection';
import { stringifyType } from '../../../src/reflection/type';

test('stringify primitives', () => {
    expect(stringifyType(typeOf<string>())).toBe('string');
    expect(stringifyType(typeOf<number>())).toBe('number');
    expect(stringifyType(typeOf<boolean>())).toBe('boolean');
    expect(stringifyType(typeOf<bigint>())).toBe('bigint');
    expect(stringifyType(typeOf<'a'>())).toBe(`'a'`);
    expect(stringifyType(typeOf<1>())).toBe(`1`);
    expect(stringifyType(typeOf<true>())).toBe(`true`);
});

test('stringify array', () => {
    expect(stringifyType(typeOf<string[]>())).toBe('string[]');
    expect(stringifyType(typeOf<number[]>())).toBe('number[]');
});

test('stringify date/set/map', () => {
    expect(stringifyType(typeOf<Date>())).toBe('Date');
    expect(stringifyType(typeOf<Map<string, number>>())).toBe('Map<string, number>');
    expect(stringifyType(typeOf<Set<string>>())).toBe('Set<string>');
});

test('stringify class', () => {
    class User {
        id!: number;
        username!: string;
    }

    expect(stringifyType(typeOf<User>())).toBe(`User {\n  id: number;\n  username: string;\n}`);
    expect(stringifyType(typeOf<Partial<User>>())).toBe(`{\n  id?: number;\n  username?: string;\n}`);
});

test('stringify class generic', () => {
    class User<T> {
        id!: number;
        username!: T;
    }

    expect(stringifyType(typeOf<User<string>>())).toBe(`User<string> {\n  id: number;\n  username: string;\n}`);
});

test('stringify interface', () => {
    interface User {
        id: number;
        username: string;
    }

    expect(stringifyType(typeOf<User>())).toBe(`{\n  id: number;\n  username: string;\n}`);
});

test('stringify nested class', () => {
    class Config {
        color!: number;
    }

    class User {
        id!: number;
        username?: string;
        config!: Config;
    }

    expect(stringifyType(typeOf<User>())).toBe(`User {\n  id: number;\n  username?: string;\n  config: Config {\n    color: number;\n  };\n}`);
});

test('stringify nested interface', () => {
    interface Config {
        color: number;
    }

    interface User {
        id: number;
        username?: string;
        config: Config;
    }

    expect(stringifyType(typeOf<User>())).toBe(`{\n  id: number;\n  username?: string;\n  config: {\n    color: number;\n  };\n}`);
});
