import { describe, expect, test } from '@jest/globals';
import { ReceiveType, typeOf } from '../../../src/reflection/reflection';
import { isSameType, stringifyType } from '../../../src/reflection/type';
import { isExtendable } from '../../../src/reflection/extends';

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

function validExtend<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = typeOf([], a);
    const bType = typeOf([], b);
    expect(isExtendable(aType, bType)).toBe(true);
}

function invalidExtend<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = typeOf([], a);
    const bType = typeOf([], b);
    expect(isExtendable(aType, bType)).toBe(false);
}

test('extendability union', () => {
    validExtend<'a', number | string>();
    validExtend<null, null | undefined>();
    validExtend<undefined, null | undefined>();
    invalidExtend<string, null | undefined>();
});

test('extendability', () => {
    validExtend<string, string>();
    validExtend<'a', string>();
    invalidExtend<23, string>();
    invalidExtend<true, string>();
    invalidExtend<boolean, string>();
    invalidExtend<number, string>();

    validExtend<number, number>();
    validExtend<34, number>();
    validExtend<-34, number>();

    validExtend<boolean, boolean>();
    validExtend<true, boolean>();
    validExtend<false, boolean>();


    //note: this needs to run in a strict TS mode to infer correctly in the IDE
    type Extends<A, B> = [A] extends [B] ? true : false;

    type a1 = Extends<never, any>;
    type a11 = Extends<never, unknown>;
    type a12 = Extends<never, object>;
    type a13 = Extends<never, void>;
    type a14 = Extends<never, undefined>;
    type a15 = Extends<never, never>;
    type a16 = Extends<never, null>;
    type a17 = Extends<never, string>;
    type a18 = Extends<never, {}>;
    type a181 = Extends<never, {a: string}>;
    type a19 = Extends<never, User>;
    validExtend<never, any>();
    validExtend<never, unknown>();
    validExtend<never, object>();
    validExtend<never, void>();
    validExtend<never, undefined>();
    validExtend<never, never>();
    validExtend<never, null>();
    validExtend<never, string>();
    validExtend<never, number>();
    validExtend<never, boolean>();
    validExtend<never, bigint>();
    validExtend<never, symbol>();
    validExtend<never, { }>();
    validExtend<never, { a: string }>();
    validExtend<never, User>();

    type a2 = Extends<null, any>;
    type a21 = Extends<null, unknown>;
    type a22 = Extends<null, object>;
    type a23 = Extends<null, void>;
    type a24 = Extends<null, undefined>;
    type a25 = Extends<null, never>;
    type a26 = Extends<null, null>;
    type a27 = Extends<null, string>;
    type a28 = Extends<null, {}>;
    type a288 = Extends<null, {a: string}>;
    type a29 = Extends<null, User>;
    validExtend<null, any>();
    validExtend<null, unknown>();
    invalidExtend<null, object>();
    invalidExtend<null, void>();
    invalidExtend<null, undefined>();
    invalidExtend<null, never>();
    validExtend<null, null>();
    invalidExtend<null, string>();
    invalidExtend<null, number>();
    invalidExtend<null, boolean>();
    invalidExtend<null, bigint>();
    invalidExtend<null, symbol>();
    invalidExtend<null, { }>();
    invalidExtend<null, { a: string }>();
    invalidExtend<null, User>();

    type a3 = Extends<undefined, any>;
    type a31 = Extends<undefined, unknown>;
    type a32 = Extends<undefined, object>;
    type a33 = Extends<undefined, void>;
    type a34 = Extends<undefined, undefined>;
    type a35 = Extends<undefined, never>;
    type a36 = Extends<undefined, null>;
    type a37 = Extends<undefined, string>;
    type a38 = Extends<undefined, {}>;
    type a388 = Extends<undefined, {a: string}>;
    type a39 = Extends<undefined, User>;
    validExtend<undefined, any>();
    validExtend<undefined, unknown>();
    invalidExtend<undefined, object>();
    validExtend<undefined, void>();
    validExtend<undefined, undefined>();
    invalidExtend<undefined, never>();
    invalidExtend<undefined, null>();
    invalidExtend<undefined, string>();
    invalidExtend<undefined, number>();
    invalidExtend<undefined, boolean>();
    invalidExtend<undefined, bigint>();
    invalidExtend<undefined, symbol>();
    invalidExtend<undefined, { }>();
    invalidExtend<undefined, { a: string }>();
    invalidExtend<undefined, User>();

    type a4 = Extends<void, any>;
    type a41 = Extends<void, unknown>;
    type a42 = Extends<void, object>;
    type a43 = Extends<void, void>;
    type a44 = Extends<void, undefined>;
    type a45 = Extends<void, never>;
    type a46 = Extends<void, null>;
    type a47 = Extends<void, string>;
    type a48 = Extends<void, {}>;
    type a488 = Extends<void, {a: string}>;
    type a49 = Extends<void, User>;
    validExtend<void, any>();
    validExtend<void, unknown>();
    invalidExtend<void, object>();
    validExtend<void, void>();
    invalidExtend<void, undefined>();
    invalidExtend<void, never>();
    invalidExtend<void, null>();
    invalidExtend<void, string>();
    invalidExtend<void, number>();
    invalidExtend<void, boolean>();
    invalidExtend<void, bigint>();
    invalidExtend<void, symbol>();
    invalidExtend<void, { }>();
    invalidExtend<void, { a: string }>();
    invalidExtend<void, User>();

    type a5 = Extends<object, any>;
    type a51 = Extends<object, unknown>;
    type a52 = Extends<object, object>;
    type a53 = Extends<object, void>;
    type a54 = Extends<object, undefined>;
    type a55 = Extends<object, never>;
    type a56 = Extends<object, null>;
    type a57 = Extends<object, string>;
    type a58 = Extends<object, {}>;
    type a588 = Extends<object, {a: string}>;
    type a59 = Extends<object, User>;
    type a599 = Extends<object, EmptyEntity>;
    validExtend<object, any>();
    validExtend<object, unknown>();
    validExtend<object, object>();
    invalidExtend<object, void>();
    invalidExtend<object, undefined>();
    invalidExtend<object, never>();
    invalidExtend<object, null>();
    invalidExtend<object, string>();
    invalidExtend<object, number>();
    invalidExtend<object, boolean>();
    invalidExtend<object, bigint>();
    invalidExtend<object, symbol>();
    validExtend<object, { }>();
    invalidExtend<object, { a: string }>();
    invalidExtend<object, User>();
    validExtend<object, EmptyEntity>();

    type a6 = Extends<unknown, any>;
    type a61 = Extends<unknown, unknown>;
    type a62 = Extends<unknown, object>;
    type a63 = Extends<unknown, void>;
    type a64 = Extends<unknown, undefined>;
    type a65 = Extends<unknown, never>;
    type a66 = Extends<unknown, null>;
    type a67 = Extends<unknown, string>;
    type a68 = Extends<unknown, {}>;
    type a688 = Extends<unknown, {a: string}>;
    type a69 = Extends<unknown, User>;
    validExtend<unknown, any>();
    validExtend<unknown, unknown>();
    invalidExtend<unknown, object>();
    invalidExtend<unknown, void>();
    invalidExtend<unknown, undefined>();
    invalidExtend<unknown, never>();
    invalidExtend<unknown, null>();
    invalidExtend<unknown, string>();
    invalidExtend<unknown, number>();
    invalidExtend<unknown, boolean>();
    invalidExtend<unknown, bigint>();
    invalidExtend<unknown, symbol>();
    invalidExtend<unknown, { }>();
    invalidExtend<unknown, { a: string }>();
    invalidExtend<unknown, User>();

    type a7 = Extends<any, any>;
    type a71 = Extends<any, unknown>;
    type a72 = Extends<any, object>;
    type a73 = Extends<any, void>;
    type a74 = Extends<any, undefined>;
    type a75 = Extends<any, never>;
    type a76 = Extends<any, null>;
    type a77 = Extends<any, string>;
    type a78 = Extends<any, {}>;
    type a788 = Extends<any, {a: string}>;
    type a79 = Extends<any, User>;
    type a799 = Extends<any, EmptyEntity>;
    validExtend<any, any>();
    validExtend<any, unknown>();
    validExtend<any, object>();
    validExtend<any, void>();
    validExtend<any, undefined>();
    invalidExtend<any, never>();
    validExtend<any, null>();
    validExtend<any, string>();
    validExtend<any, number>();
    validExtend<any, boolean>();
    validExtend<any, bigint>();
    validExtend<any, symbol>();
    validExtend<any, { }>();
    validExtend<any, { a: string }>();
    validExtend<any, User>();

    type a8 = Extends<{}, any>;
    type a81 = Extends<{}, unknown>;
    type a82 = Extends<{}, object>;
    type a83 = Extends<{}, void>;
    type a84 = Extends<{}, undefined>;
    type a85 = Extends<{}, never>;
    type a86 = Extends<{}, null>;
    type a87 = Extends<{}, string>;
    type a88 = Extends<{}, {}>;
    type a888 = Extends<{}, {a: string}>;
    type a89 = Extends<{}, User>;
    type a899 = Extends<{}, EmptyEntity>;
    validExtend< { }, any>();
    validExtend<{ }, unknown>();
    validExtend<{ }, object>();
    invalidExtend<{ }, void>();
    invalidExtend<{ }, undefined>();
    invalidExtend<{ }, never>();
    invalidExtend<{ }, null>();
    invalidExtend<{ }, string>();
    invalidExtend<{ }, number>();
    invalidExtend<{ }, boolean>();
    invalidExtend<{ }, bigint>();
    invalidExtend<{ }, symbol>();
    validExtend<{ }, { }>();
    invalidExtend<{ }, { a: string }>();
    invalidExtend<{ }, User>();
    validExtend<{ }, EmptyEntity>();
});

class User {
    a!: string;
}

class EmptyEntity {
}

class User2 {
    a!: number;
}

class Setting {
    name!: string;
    value!: any;
}

const types = [
    typeOf<string>(),
    typeOf<number>(),
    typeOf<bigint>(),
    typeOf<symbol>(),
    typeOf<undefined>(),
    typeOf<null>(),
    typeOf<any>(),
    typeOf<never>(),
    typeOf<Date>(),
    typeOf<'a'>(),
    typeOf<23>(),
    typeOf<4n>(),
    typeOf<true>(),
    typeOf<User>(),
    typeOf<Setting>(),
    typeOf<{ a: string }>(),
    typeOf<{ a: string, b: number }>(),
    typeOf<{ b: number }>(),
    typeOf<{ [index: string]: string }>(),
    typeOf<{ [index: string]: number }>(),
    typeOf<{ [index: string]: number | string }>(),
    typeOf<{ [index: number]: number | string }>(),
    typeOf<() => void>(),
    typeOf<(a: string) => void>(),
    typeOf<(b: number) => void>(),
    typeOf<(b: string, a: number) => void>(),
    typeOf<string | number>(),
    typeOf<string | 'a'>(),
];

describe('types equality', () => {
    for (const a of types) {
        for (const b of types) {
            if (a === b) {
                test(`${stringifyType(a)} same to ${stringifyType(b)}`, () => {
                    expect(isSameType(a, b)).toBe(true);
                });
            } else {
                test(`${stringifyType(a)} different to ${stringifyType(b)}`, () => {
                    expect(isSameType(a, b)).toBe(false);
                });
            }
        }
    }
});
