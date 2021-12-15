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
    expect(widenLiteral(typeInfer('asd') as TypeLiteral)).toMatchObject({ kind: ReflectionKind.string });
    expect(widenLiteral(typeInfer(23) as TypeLiteral)).toMatchObject({ kind: ReflectionKind.number });
    expect(widenLiteral(typeInfer(true) as TypeLiteral)).toMatchObject({ kind: ReflectionKind.boolean });
    expect(widenLiteral(typeInfer(false) as TypeLiteral)).toMatchObject({ kind: ReflectionKind.boolean });
    expect(widenLiteral(typeInfer(12n) as TypeLiteral)).toMatchObject({ kind: ReflectionKind.bigint });
    expect(widenLiteral(typeInfer(symbol) as TypeLiteral)).toMatchObject({ kind: ReflectionKind.symbol });
});

test('container', () => {
    expect(typeInfer([123, 'abc', 'bcd'])).toMatchObject(typeOf<(number | string)[]>() as any);
    expect(typeInfer(new Set())).toEqual(typeOf<Set<any>>());
    expect(typeInfer(new Map())).toEqual(typeOf<Map<any, any>>());
    expect(typeInfer(new Set(['a', 32]))).toMatchObject(typeOf<Set<string | number>>() as any);
    expect(typeInfer(new Map([[1, 'hello'], [3, 'yes']]))).toMatchObject(typeOf<Map<number, string>>() as any);
});

test('class', () => {
    class User {}
    expect(typeInfer(new User())).toEqual(typeOf<User>());
    expect(typeInfer(new Date(''))).toEqual(typeOf<Date>());
});

test('object', () => {
    expect(typeInfer({ a: 'hello' })).toMatchObject(typeOf<{ a: string }>() as any);
    expect(typeInfer({ a: 123 })).toMatchObject(typeOf<{ a: number }>() as any);
    expect(typeInfer({ a: true })).toMatchObject(typeOf<{ a: boolean }>() as any);
    expect(typeInfer({ a: 12n })).toMatchObject(typeOf<{ a: bigint }>() as any);
    expect(typeInfer({ a: symbol })).toMatchObject(typeOf<{ a: symbol }>() as any);
    expect(typeInfer({ a: new Date })).toMatchObject(typeOf<{ a: Date }>() as any);
    expect(typeInfer({ a: (b: string): void => undefined  })).toMatchObject(typeOf<{ a(b: string): void }>() as any);
    expect(typeInfer({ a(b: string): void {} })).toMatchObject(typeOf<{ a(b: string): void }>() as any);
});

test('function', () => {
    expect(typeInfer((a: string): void => undefined)).toMatchObject(typeOf<(a: string) => void>() as any);
    expect(typeInfer((a: string, b: number): void => undefined)).toMatchObject(typeOf<(a: string, b: number) => void>() as any);
});
