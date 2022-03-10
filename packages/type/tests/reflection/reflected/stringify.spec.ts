import { expect, test } from '@jest/globals';
import { stringifyResolvedType, stringifyShortResolvedType, stringifyType, Type } from '../../../src/reflection/type';
import { typeOf } from '../../../src/reflection/reflection';
import { deserializeType, serializeType } from '../../../src/type-serialization';

test('stringifyType basic', () => {
    expect(stringifyResolvedType(typeOf<string>())).toBe('string');
    expect(stringifyResolvedType(typeOf<number>())).toBe('number');
    expect(stringifyResolvedType(typeOf<Date>())).toBe('Date');
});

test('stringifyType union', () => {
    expect(stringifyResolvedType(typeOf<string | number>())).toBe('string | number');
});

test('stringifyType object', () => {
    expect(stringifyResolvedType(typeOf<{ a: string }>())).toBe('{a: string}');
    expect(stringifyResolvedType(typeOf<{ a: string, b: number }>())).toBe('{\n  a: string;\n  b: number;\n}');
    expect(stringifyResolvedType(typeOf<{ a: string, b: number, c: boolean }>())).toBe('{\n  a: string;\n  b: number;\n  c: boolean;\n}');
    expect(stringifyResolvedType(typeOf<{ a: string, b: number, c: { d: string } }>())).toBe('{\n  a: string;\n  b: number;\n  c: {d: string};\n}');
    expect(stringifyResolvedType(typeOf<{ a: string, b: number, c: { d: string, e: number } }>())).toBe('{\n  a: string;\n  b: number;\n  c: {\n    d: string;\n    e: number;\n  };\n}');
    expect(stringifyResolvedType(typeOf<{ a: string, b: number, c: { d: string, e: number, f: boolean } }>())).toBe(`{
  a: string;
  b: number;
  c: {
    d: string;
    e: number;
    f: boolean;
  };
}`);
});

test('stringifyType array', () => {
    expect(stringifyResolvedType(typeOf<string[]>())).toBe('Array<string>');
    expect(stringifyResolvedType(typeOf<(string | number)[]>())).toBe('Array<string | number>');
    expect(stringifyResolvedType(typeOf<(string | number)[][]>())).toBe('Array<Array<string | number>>');
});

test('stringifyType tuple', () => {
    expect(stringifyResolvedType(typeOf<[string]>())).toBe('[string]');
    expect(stringifyResolvedType(typeOf<[string, number]>())).toBe('[string, number]');
    expect(stringifyResolvedType(typeOf<[string, number?]>())).toBe('[string, number?]');
    expect(stringifyResolvedType(typeOf<[a: string, b: number]>())).toBe('[a: string, b: number]');
    expect(stringifyResolvedType(typeOf<[a: string, b?: number]>())).toBe('[a: string, b?: number]');
    expect(stringifyResolvedType(typeOf<[string, number[]]>())).toBe('[string, Array<number>]');
});

test('stringifyType function', () => {
    expect(stringifyResolvedType(typeOf<() => void>())).toBe('() => void');
    expect(stringifyResolvedType(typeOf<(a: string) => void>())).toBe('(a: string) => void');
    expect(stringifyResolvedType(typeOf<(a: string, b: number) => void>())).toBe('(a: string, b: number) => void');
    expect(stringifyResolvedType(typeOf<(a: string, b?: number) => void>())).toBe('(a: string, b?: number) => void');
    expect(stringifyResolvedType(typeOf<(...a: string[]) => void>())).toBe('(...a: string[]) => void');
});

test('stringifyType index signature', () => {
    expect(stringifyResolvedType(typeOf<{ [name: string]: boolean }>())).toBe('{[index: string]: boolean}');
    expect(stringifyResolvedType(typeOf<{ a: boolean, [name: string]: boolean }>())).toBe(`{
  a: boolean;
  [index: string]: boolean;
}`);
});

test('stringifyType method signature', () => {
    expect(stringifyResolvedType(typeOf<{ a(): void }>())).toBe('{a(): void}');
    expect(stringifyResolvedType(typeOf<{ a(b: string): void }>())).toBe('{a(b: string): void}');
    expect(stringifyResolvedType(typeOf<{ a(b: string): void, b: string }>())).toBe(`{
  a(b: string): void;
  b: string;
}`);
});

test('stringifyType methods', () => {
    class A {
        a(): void {
        }
    }

    class B {
        a(b: string): void {
        }
    }

    class C {
        a(b: string): void {
        }

        b: string = '';
    }

    expect(stringifyResolvedType(typeOf<A>())).toBe('A {a(): void}');
    expect(stringifyResolvedType(typeOf<B>())).toBe('B {a(b: string): void}');
    expect(stringifyResolvedType(typeOf<C>())).toBe(`C {
  a(b: string): void;
  b: string;
}`);
    expect(stringifyType(typeOf<C>(), {defaultIsOptional: true})).toBe(`C {
  a(b: string): void;
  b?: string;
}`);
});

test('stringifyType template literal', () => {
    expect(stringifyType(typeOf<`a${string}`>())).toBe('`a${string}`');
    expect(stringifyType(typeOf<`a${number}and${string}`>())).toBe('`a${number}and${string}`');
});

test('stringifyType class generics', () => {
    class A<T> {
        a!: T;
    }

    expect(stringifyResolvedType(typeOf<A<string>>())).toBe('A {a: string}');
    expect(stringifyResolvedType(typeOf<A<string | number>>())).toBe('A {a: string | number}');
    expect(stringifyShortResolvedType(typeOf<A<string>>())).toBe('A<string>');
    expect(stringifyShortResolvedType(typeOf<A<string | number>>())).toBe('A<string | number>');
});

test('stringifyType recursive', () => {
    interface User {
        id: number;
        /**
         * @description the user
         */
        admin: User;
    }

    expect(stringifyResolvedType(typeOf<User>())).toBe(`User {
  id: number;
  admin: User;
}`);

    expect(stringifyType(typeOf<User>(), {showNames: false, showDescription: true})).toBe(`User {
  id: number;
  /* the user */
  admin: User;
}`);

    type A<T> = [A<T>];
    expect(stringifyResolvedType(typeOf<A<string>>())).toBe('[[* Recursion *]]');
});

test('description interface', () => {
    interface User {
        id: number;
        /**
         * @description the user
         * another line?
         */
        username: string;
    }

    expect(stringifyType(typeOf<User>(), {showNames: false, showDescription: true})).toBe(`User {
  id: number;
  /* the user
   * another line? */
  username: string;
}`);;

    const json = serializeType(typeOf<User>());
    const back = deserializeType(json);
    expect(stringifyType(back, {showNames: false, showDescription: true})).toBe(`User {
  id: number;
  /* the user
   * another line? */
  username: string;
}`);

    interface small {
        /** @description thats the number */
        id: number;
    }

    expect(stringifyType(typeOf<small>(), {showNames: false, showDescription: true})).toBe(`small {\n  /* thats the number */\n  id: number;\n}`);
});

test('description class', () => {
    class User {
        id!: number;
        /**
         * @description the user
         * another line?
         */
        username?: string;
    }

    expect(stringifyType(typeOf<User>(), {showNames: false, showDescription: true})).toBe(`User {
  id: number;
  /* the user
   * another line? */
  username?: string;
}`);

});

test('stringifyType heritage', () => {
    class Base {
        id!: number;
    }

    class User extends Base {
        username!: string;
    }

    expect(stringifyType(typeOf<User>())).toBe(`User {
  id: number;
  username: string;
}`);

    const serialized = serializeType(typeOf<User>());
    const back = deserializeType(serialized);
    expect(stringifyType(back)).toBe(`User {
  id: number;
  username: string;
}`);
});

test('enum', () => {
    enum MyEnum {
        a, b, c = 4
    }

    interface User {
        status: MyEnum;
    }
    expect(stringifyType(typeOf<MyEnum>(), {showNames: false})).toBe('MyEnum {a: 0, b: 1, c: 4}');
    expect(stringifyType(typeOf<User>(), {showNames: false})).toBe('User {status: MyEnum {a: 0, b: 1, c: 4}}');

    const json = serializeType(typeOf<MyEnum>());
    const back = deserializeType(json);
    expect(stringifyType(back, {showNames: false})).toBe('MyEnum {a: 0, b: 1, c: 4}');
})

test('stringifyType type', () => {
    const type = typeOf<Type>();
    const s = stringifyType(type);
    console.log(s);
});
