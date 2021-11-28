import { expect, test } from '@jest/globals';
import { typeOf } from '../../../src/reflection/reflection';
import { ReflectionKind, Type, typeInfer, TypeLiteral, widenLiteral } from '../../../src/reflection/type';

const symbol = Symbol();

test('primitives', () => {
    expect(typeInfer('asd')).toEqual({ kind: ReflectionKind.literal, literal: 'asd' } as Type);
    expect(typeInfer(23)).toEqual({ kind: ReflectionKind.literal, literal: 23 } as Type);
    expect(typeInfer(true)).toEqual({ kind: ReflectionKind.literal, literal: true } as Type);
    expect(typeInfer(false)).toEqual({ kind: ReflectionKind.literal, literal: false } as Type);
    expect(typeInfer(12n)).toEqual({ kind: ReflectionKind.literal, literal: 12n } as Type);
    expect(typeInfer(symbol)).toEqual({ kind: ReflectionKind.literal, literal: symbol } as Type);
});

test('widen literal', () => {
    expect(widenLiteral(typeInfer('asd') as TypeLiteral)).toEqual({ kind: ReflectionKind.string } as Type);
    expect(widenLiteral(typeInfer(23) as TypeLiteral)).toEqual({ kind: ReflectionKind.number } as Type);
    expect(widenLiteral(typeInfer(true) as TypeLiteral)).toEqual({ kind: ReflectionKind.boolean } as Type);
    expect(widenLiteral(typeInfer(false) as TypeLiteral)).toEqual({ kind: ReflectionKind.boolean } as Type);
    expect(widenLiteral(typeInfer(12n) as TypeLiteral)).toEqual({ kind: ReflectionKind.bigint } as Type);
    expect(widenLiteral(typeInfer(symbol) as TypeLiteral)).toEqual({ kind: ReflectionKind.symbol } as Type);
});

test('container', () => {
    expect(typeInfer([123, 'abc', 'bcd'])).toEqual(typeOf<(number | string)[]>());
    expect(typeInfer(new Set())).toEqual(typeOf<Set<any>>());
    expect(typeInfer(new Map())).toEqual(typeOf<Map<any, any>>());
    expect(typeInfer(new Set(['a', 32]))).toEqual(typeOf<Set<string | number>>());
    expect(typeInfer(new Map([[1, 'hello'], [3, 'yes']]))).toEqual(typeOf<Map<number, string>>());
});

test('class', () => {
    class User {}
    expect(typeInfer(new User())).toEqual(typeOf<User>());
    expect(typeInfer(new Date(''))).toEqual(typeOf<Date>());
    expect(typeInfer(new RegExp(''))).toEqual(typeOf<RegExp>());
});

test('object', () => {
    expect(typeInfer({ a: 'hello' })).toEqual(typeOf<{ a: string }>());
    expect(typeInfer({ a: 123 })).toEqual(typeOf<{ a: number }>());
    expect(typeInfer({ a: true })).toEqual(typeOf<{ a: boolean }>());
    expect(typeInfer({ a: 12n })).toEqual(typeOf<{ a: bigint }>());
    expect(typeInfer({ a: symbol })).toEqual(typeOf<{ a: symbol }>());
    expect(typeInfer({ a: new Date })).toEqual(typeOf<{ a: Date }>());
    expect(typeInfer({ a: new RegExp('') })).toEqual(typeOf<{ a: RegExp }>());
    expect(typeInfer({ a: (b: string): void => undefined  })).toEqual(typeOf<{ a(b: string): void }>());
    expect(typeInfer({ a(b: string): void {} })).toEqual(typeOf<{ a(b: string): void }>());
});

test('function', () => {
    expect(typeInfer((a: string): void => undefined)).toEqual(typeOf<(a: string) => void>());
    expect(typeInfer((a: string, b: number): void => undefined)).toEqual(typeOf<(a: string, b: number) => void>());
});
