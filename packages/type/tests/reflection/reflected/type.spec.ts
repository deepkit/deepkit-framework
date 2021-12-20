import { describe, expect, test } from '@jest/globals';
import { ReceiveType, resolveReceiveType, typeOf } from '../../../src/reflection/reflection';
import { indexAccess, isSameType, ReflectionKind, stringifyResolvedType, stringifyType, UUID } from '../../../src/reflection/type';
import { isExtendable } from '../../../src/reflection/extends';

//note: this needs to run in a strict TS mode to infer correctly in the IDE
type Extends<A, B> = [A] extends [B] ? true : false;

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

test('type alias preserved', () => {
    type MyString = string;
    expect(stringifyType(typeOf<MyString>())).toBe('MyString');

    expect(stringifyType(typeOf<UUID>())).toBe('UUID');
});

test('stringify class', () => {
    class User {
        id!: number;
        username!: string;
    }

    expect(stringifyResolvedType(typeOf<User>())).toBe(`User {\n  id: number;\n  username: string;\n}`);
    expect(stringifyResolvedType(typeOf<Partial<User>>())).toBe(`{\n  id?: number;\n  username?: string;\n}`);
    expect(stringifyType(typeOf<Partial<User>>())).toBe(`Partial<User {\n  id: number;\n  username: string;\n}>`);
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

    expect(stringifyResolvedType(typeOf<User>())).toBe(`{\n  id: number;\n  username: string;\n}`);
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

    expect(stringifyResolvedType(typeOf<User>())).toBe(`{\n  id: number;\n  username?: string;\n  config: {\n    color: number;\n  };\n}`);
});

function validExtend<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = resolveReceiveType(a);
    const bType = resolveReceiveType(b);
    expect(isExtendable(aType, bType)).toBe(true);
}

function invalidExtend<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
    const aType = resolveReceiveType(a);
    const bType = resolveReceiveType(b);
    expect(isExtendable(aType, bType)).toBe(false);
}

test('extendability union', () => {
    validExtend<'a', number | string>();
    validExtend<null, null | undefined>();
    validExtend<undefined, null | undefined>();
    invalidExtend<string, null | undefined>();
});

test('extendability constructor', () => {
    type c = abstract new (...args: any) => any;

    class User {
        constructor() {
        }
    }

    class Setting {
        constructor(public key: string, public value: any) {
        }
    }

    validExtend<any, c>();
    validExtend<User, c>();
    validExtend<Setting, c>();
    invalidExtend<string, c>();
    invalidExtend<string, c>();

    type c2 = new (key: string, value: any) => any;
    type c3 = typeof User extends c2 ? true : false;
    type c4 = typeof Setting extends c2 ? true : false;

    type d1 = new () => any;
    type d2 = typeof User extends d1 ? true : false;
    type d3 = typeof Setting extends d1 ? true : false;

    // type d2 = (key: string, value: any) => any;
    // type d3 = (() => void) extends d2 ? true : false;

    validExtend<Setting, c2>();
    invalidExtend<User, c2>();
});

test('extendability function', () => {
    validExtend<(a: string) => void, (a: string) => void>();
    validExtend<(a: string) => void, (...args: any[]) => void>();

    type f1 = ((a: string) => void) extends ((a: string, b: string) => void) ? true : false;
    validExtend<(a: string) => void, (a: string, b: string) => void>();

    type f2 = ((a: string, b: string) => void) extends ((a: string) => void) ? true : false;
    invalidExtend<(a: string, b: string) => void, (a: string) => void>();

    validExtend<() => void, (a: string) => void>();
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

    validExtend<string, any>();
    validExtend<[string], any>();
    validExtend<boolean, any>();
    validExtend<{ a: string }, any>();
    validExtend<never, any>();

    type a1 = Extends<never, any>;
    type a11 = Extends<never, unknown>;
    type a12 = Extends<never, object>;
    type a13 = Extends<never, void>;
    type a14 = Extends<never, undefined>;
    type a15 = Extends<never, never>;
    type a16 = Extends<never, null>;
    type a17 = Extends<never, string>;
    type a18 = Extends<never, {}>;
    type a181 = Extends<never, { a: string }>;
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
    validExtend<never, {}>();
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
    type a288 = Extends<null, { a: string }>;
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
    invalidExtend<null, {}>();
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
    type a388 = Extends<undefined, { a: string }>;
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
    invalidExtend<undefined, {}>();
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
    type a488 = Extends<void, { a: string }>;
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
    invalidExtend<void, {}>();
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
    type a588 = Extends<object, { a: string }>;
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
    validExtend<object, {}>();
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
    type a688 = Extends<unknown, { a: string }>;
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
    invalidExtend<unknown, {}>();
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
    type a788 = Extends<any, { a: string }>;
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
    validExtend<any, {}>();
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
    type a888 = Extends<{}, { a: string }>;
    type a89 = Extends<{}, User>;
    type a899 = Extends<{}, EmptyEntity>;
    validExtend<{}, any>();
    validExtend<{}, unknown>();
    validExtend<{}, object>();
    invalidExtend<{}, void>();
    invalidExtend<{}, undefined>();
    invalidExtend<{}, never>();
    invalidExtend<{}, null>();
    invalidExtend<{}, string>();
    invalidExtend<{}, number>();
    invalidExtend<{}, boolean>();
    invalidExtend<{}, bigint>();
    invalidExtend<{}, symbol>();
    validExtend<{}, {}>();
    invalidExtend<{}, { a: string }>();
    invalidExtend<{}, User>();
    validExtend<{}, EmptyEntity>();

    type a9 = Extends<`a${string}`, any>;
    type a91 = Extends<`a${string}`, unknown>;
    type a911 = Extends<`${string}`, unknown>;
    type a912 = Extends<string, unknown>;
    type a92 = Extends<`a${string}`, object>;
    type a93 = Extends<`a${string}`, void>;
    type a94 = Extends<`a${string}`, undefined>;
    type a95 = Extends<`a${string}`, never>;
    type a96 = Extends<`a${string}`, null>;
    type a97 = Extends<`a${string}`, string>;
    type a971 = Extends<`a${string}`, number>;
    type a98 = Extends<`a${string}`, {}>;
    type a988 = Extends<`a${string}`, { a: string }>;
    type a99 = Extends<`a${string}`, User>;
    type a999 = Extends<`a${string}`, EmptyEntity>;
    validExtend<`a${string}`, any>();
    validExtend<`a${string}`, unknown>();
    validExtend<`${string}`, unknown>();
    validExtend<string, unknown>();
    invalidExtend<`a${string}`, object>();
    invalidExtend<`a${string}`, void>();
    invalidExtend<`a${string}`, undefined>();
    invalidExtend<`a${string}`, never>();
    invalidExtend<`a${string}`, null>();
    validExtend<`a${string}`, string>();
    invalidExtend<`a${string}`, number>();
    invalidExtend<`a${string}`, boolean>();
    invalidExtend<`a${string}`, bigint>();
    invalidExtend<`a${string}`, symbol>();
    validExtend<`a${string}`, {}>();
    invalidExtend<`a${string}`, { a: string }>();
    invalidExtend<`a${string}`, User>();
    validExtend<`a${string}`, EmptyEntity>();

    type b9 = Extends<any, `a${string}`>;
    type b91 = Extends<unknown, `a${string}`>;
    type b92 = Extends<object, `a${string}`>;
    type b93 = Extends<void, `a${string}`>;
    type b94 = Extends<undefined, `a${string}`>;
    type b95 = Extends<never, `a${string}`>;
    type b96 = Extends<null, `a${string}`>;
    type b97 = Extends<string, `a${string}`>;
    type b971 = Extends<number, `a${string}`>;
    type b98 = Extends<{}, `a${string}`>;
    type b988 = Extends<{ a: string }, `a${string}`>;
    type b99 = Extends<User, `a${string}`>;
    type b999 = Extends<EmptyEntity, `a${string}`>;
    validExtend<any, `a${string}`>();
    invalidExtend<unknown, `a${string}`>();
    invalidExtend<unknown, `${string}`>();
    invalidExtend<object, `a${string}`>();
    invalidExtend<void, `a${string}`>();
    invalidExtend<undefined, `a${string}`>();
    validExtend<never, `a${string}`>();
    invalidExtend<null, `a${string}`>();
    invalidExtend<string, `a${string}`>();
    invalidExtend<number, `a${string}`>();
    invalidExtend<boolean, `a${string}`>();
    invalidExtend<bigint, `a${string}`>();
    invalidExtend<symbol, `a${string}`>();
    invalidExtend<{}, `a${string}`>();
    invalidExtend<{ a: string }, `a${string}`>();
    invalidExtend<User, `a${string}`>();
    invalidExtend<EmptyEntity, `a${string}`>();

    type c9 = Extends<string, unknown>;
    type c91 = Extends<number, unknown>;
    type c92 = Extends<boolean, unknown>;
    type c93 = Extends<any, unknown>;
    type c94 = Extends<{}, unknown>;
    type c95 = Extends<User, unknown>;
    type c96 = Extends<{ a: string }, unknown>;
    type c97 = Extends<object, unknown>;
    type c98 = Extends<null, unknown>;
    type c99 = Extends<undefined, unknown>;
    type c100 = Extends<never, unknown>;
    validExtend<string, unknown>();
    validExtend<number, unknown>();
    validExtend<boolean, unknown>();
    validExtend<string, unknown>();
});

test('template literal basics', () => {
    expect(typeOf<`${string}`>()).toEqual(typeOf<string>());
    expect(typeOf<`${number}`>()).toEqual(typeOf<`${number}`>());
    expect(typeOf<`${1}`>()).toEqual(typeOf<'1'>());
    expect(typeOf<`${true}`>()).toEqual(typeOf<'true'>());
    expect(typeOf<`${boolean}`>()).toEqual(typeOf<'false' | 'true'>());
});

test('literal extends template literal', () => {
    validExtend<string, `${string}`>();
    invalidExtend<string, `a${string}`>();
    validExtend<`a${string}`, string>();

    type b1 = Extends<'abc', `a${string}`>;
    type b2 = Extends<'abc', `a${string}bc`>;
    type b3 = Extends<'abc', `a${string}c`>;
    type c1 = Extends<'abc', `a${number}`>;
    type c2 = Extends<'a2', `a${number}`>;
    type c3 = Extends<'a2e4s', `a${number}s`>;
    type c4 = Extends<'a2.34s', `a${number}s`>;
    type c5 = Extends<'2.34s', `${number}${string}`>;

    validExtend<'abc', `a${string}`>();
    validExtend<'abc', `a${string}bc`>();
    validExtend<'abc', `a${string}c`>();

    invalidExtend<'abc', `a${number}`>();
    validExtend<'a2', `a${number}`>();
    validExtend<'a2e4s', `a${number}s`>();
    validExtend<'a2.34s', `a${number}s`>();
    validExtend<'2.34s', `${number}${string}`>();

    validExtend<'abc', `a${string}c`>();
});

test('template literal extends template literal', () => {
    // type a0 = Extends<`a${'abc'}`, `aabc`>;
    // type a1 = Extends<`a${string}`, `a${string}`>;
    // type a2 = Extends<`a${string}`, `${'1' | ''}a${string}`>;
    // type a3 = Extends<`abcd`, `a${string}b${string}`>;
    //
    // type d1 = `a${number}${number}${string}d` extends `a${infer A}${infer B}d` ? [A, B] : never;
    // type d2 = `a${number}${number}${string}d` extends `a${string}${string}d` ? true : never;
    // type d3 = `a122` extends `a${infer A}${infer B}` ? [A, B] : never;
    // type d4 = `123` extends `${infer S}${number}` ? [S] : never;
    // type d5 = `!abc123` extends `${infer S}${number}` ? [S] : never;
    // type d6 = `a1b` extends `${infer T1}${number}${infer T3}` ? [T1, 'number', T3] : never;
    // type d7 = `a123` extends `${string}${number}${infer T1}${number}` ? T1 : never;
    //
    // type d123 = `abc${string}3` extends `a${infer T1}${infer T2}` ? [T1, T2] : never;
    //
    // type d8 = `1234` extends `${number}${infer T1}${number}` ? T1 : never;
    // type d9 = `2234` extends `${number}${infer T1}${number}` ? T1 : never;
    // type d90 = `2234` extends `${number}${infer T1}${infer T2}` ? T1 : never;
    // type d901 = `1322234` extends `${number}2${infer T1}` ? T1 : never;
    //
    // type d91 = `1133` extends `${infer T1}${string}${number}` ? T1 extends `${number}` ? T1 : never : never;
    // type d92 = `1133` extends `${number}${string}${number}` ? true : never;
    //
    // type d10 = `112233` extends `${number}${infer T1}${number}` ? T1 : never;
    // type e1 = `${number}a${string}` extends `${string}a${infer T}` ? T : never;

    validExtend<`a${string}`, `a${string}`>();
    expect(stringifyType(typeOf<`${'1' | ''}a${string}`>())).toEqual('`1a${string}` | `a${string}`');
    validExtend<`a${string}`, `${'1' | ''}a${string}`>();
    invalidExtend<`a${string}`, `${'1' | '0'}a${string}`>();
    validExtend<`1a${string}`, `${'1' | '0'}a${string}`>();
    validExtend<`0a${string}`, `${'1' | '0'}a${string}`>();

    type e1 = `abcd${string}` extends `ab${infer T1}` ? T1 : never;
    expect(stringifyResolvedType(typeOf<e1>())).toEqual('`cd${string}`');

    type e2 = `abcd${string}` extends `ab${string}${infer T1}` ? T1 : never;
    expect(stringifyResolvedType(typeOf<e2>())).toEqual('`d${string}`');
});

test('template literal infer', () => {
    type a1 = 'abc' extends `a${infer T}` ? T : never;
    expect(typeOf<a1>()).toMatchObject(typeOf<'bc'>() as any);

    type a2 = 'abcd' extends `a${infer T}${infer T2}` ? [T, T2] : never;
    expect(typeOf<a2>()).toMatchObject(typeOf<['b', 'cd']>() as any);

    type a3 = 'abcd' extends `a${string}${infer T2}` ? T2 : never;
    expect(typeOf<a3>()).toMatchObject(typeOf<'cd'>() as any);

    type TN<T> = T extends `a${number}` ? T extends `a${infer T}` ? T : never : never;
    type e1 = TN<`a123.4`>;
    expect(typeOf<e1>()).toMatchObject(typeOf<'123.4'>() as any);
});

test('tuple indexAccess', () => {
    expect(indexAccess(typeOf<[string]>(), { kind: ReflectionKind.literal, literal: 0 })).toEqual({ kind: ReflectionKind.string });
    expect(indexAccess(typeOf<[string]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({ kind: ReflectionKind.undefined });
    expect(indexAccess(typeOf<[string, string]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({ kind: ReflectionKind.string });
    expect(indexAccess(typeOf<[string, number]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({ kind: ReflectionKind.number });
    expect(indexAccess(typeOf<[string, ...number[], boolean]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({
        kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.boolean }]
    });
    expect(indexAccess(typeOf<[string, ...(number | undefined)[]]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({
        kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }]
    });
    expect(indexAccess(typeOf<[string, number?]>(), { kind: ReflectionKind.literal, literal: 1 })).toEqual({
        kind: ReflectionKind.union, types: [{ kind: ReflectionKind.number }, { kind: ReflectionKind.undefined }]
    });
});

test('tuple extends', () => {
    validExtend<[string], [string]>();
    invalidExtend<[], [string]>();
    validExtend<[string], []>();
    expect(isExtendable(typeOf<[string, number]>(), { kind: ReflectionKind.tuple, types: [] })).toBe(true);
    validExtend<[string], [...string[]]>();

    validExtend<[string, number], [...string[], number]>();
    validExtend<[string, string, number], [...string[], number]>();
    validExtend<[...string[], number], [...string[], number]>();

    validExtend<[number, string], [number, ...string[]]>();
    validExtend<[number, string, string], [number, ...string[]]>();
    validExtend<[number, ...string[]], [number, ...string[]]>();

    validExtend<[...string[], number], [...string[], number]>();
    validExtend<[...string[]], [...string[], number]>();
    validExtend<[...(string | number)[]], [...string[], number]>();

    invalidExtend<[boolean, string], [number, ...string[]]>();
    invalidExtend<[boolean], [number, ...string[]]>();
    invalidExtend<[boolean], [number]>();
    invalidExtend<[boolean], [boolean, boolean]>();
    validExtend<[...boolean[]], [boolean, boolean]>();

    validExtend<[...boolean[]], boolean[]>();
    validExtend<[boolean], boolean[]>();
    validExtend<[boolean, boolean], boolean[]>();
    validExtend<[boolean, boolean], (boolean | undefined)[]>();
    validExtend<[boolean, boolean, undefined], (boolean | undefined)[]>();
    validExtend<[boolean, boolean?], (boolean | undefined)[]>();

    validExtend<boolean[], [...boolean[]]>();
    invalidExtend<boolean[], [boolean]>();
    invalidExtend<(boolean | undefined)[], [boolean]>();
    validExtend<(boolean | undefined)[], [boolean?]>();
});

class User {
    a!: string;
}

class EmptyEntity {
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
    typeOf<string[]>(),
    typeOf<number[]>(),
    typeOf<[string]>(),
    typeOf<[number]>(),
    typeOf<User[]>(),
    typeOf<[User]>(),
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
