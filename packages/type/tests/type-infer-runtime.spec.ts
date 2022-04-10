import { test } from '@jest/globals';
import { typeInfer } from '../src/reflection/processor';
import { typeOf } from '../src/reflection/reflection';
import { ReflectionKind, Type, TypeLiteral, widenLiteral } from '../src/reflection/type';
import { expectEqualType } from './utils';

const symbol = Symbol();

test('primitives', () => {
    expectEqualType(typeInfer('asd'), { kind: ReflectionKind.literal, literal: 'asd' } as Type);
    expectEqualType(typeInfer(23), { kind: ReflectionKind.literal, literal: 23 } as Type);
    expectEqualType(typeInfer(true), { kind: ReflectionKind.literal, literal: true } as Type);
    expectEqualType(typeInfer(false), { kind: ReflectionKind.literal, literal: false } as Type);
    expectEqualType(typeInfer(12n), { kind: ReflectionKind.literal, literal: 12n } as Type);
    expectEqualType(typeInfer(symbol), { kind: ReflectionKind.literal, literal: symbol } as Type);
});

test('widen literal', () => {
    expectEqualType(widenLiteral(typeInfer('asd') as TypeLiteral), { kind: ReflectionKind.string }, {noOrigin: true});
    expectEqualType(widenLiteral(typeInfer(23) as TypeLiteral), { kind: ReflectionKind.number }, {noOrigin: true});
    expectEqualType(widenLiteral(typeInfer(true) as TypeLiteral), { kind: ReflectionKind.boolean }, {noOrigin: true});
    expectEqualType(widenLiteral(typeInfer(false) as TypeLiteral), { kind: ReflectionKind.boolean }, {noOrigin: true});
    expectEqualType(widenLiteral(typeInfer(12n) as TypeLiteral), { kind: ReflectionKind.bigint }, {noOrigin: true});
    expectEqualType(widenLiteral(typeInfer(symbol) as TypeLiteral), { kind: ReflectionKind.symbol }, {noOrigin: true});
});

test('container', () => {
    expectEqualType(typeInfer([123, 'abc', 'bcd']), typeOf<(number | string)[]>() as any, {noOrigin: true});
    expectEqualType(typeInfer(new Set()), typeOf<Set<any>>(), {noOrigin: true});
    expectEqualType(typeInfer(new Map()), typeOf<Map<any, any>>(), {noOrigin: true});
    expectEqualType(typeInfer(new Set(['a', 32])), typeOf<Set<string | number>>() as any, {noOrigin: true});
    expectEqualType(typeInfer(new Map([[1, 'hello'], [3, 'yes']])), typeOf<Map<number, string>>() as any, {noOrigin: true});
});

test('class', () => {
    class User {}
    expectEqualType(typeInfer(new User()), typeOf<User>());
    expectEqualType(typeInfer(new Date('')), typeOf<Date>());
});

test('object', () => {
    expectEqualType(typeInfer({ a: 'hello' }), typeOf<{ a: string }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: 123 }), typeOf<{ a: number }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: true }), typeOf<{ a: boolean }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: 12n }), typeOf<{ a: bigint }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: symbol }), typeOf<{ a: symbol }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: new Date }), typeOf<{ a: Date }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a: (b: string): void => undefined }), typeOf<{ a(b: string): void }>() as any, {noOrigin: true});
    expectEqualType(typeInfer({ a(b: string): void {} }), typeOf<{ a(b: string): void }>() as any, {noOrigin: true});
});

test('function', () => {
    expectEqualType(typeInfer((a: string): void => undefined), typeOf<(a: string) => void>() as any, {excludes: ['function']});
    expectEqualType(typeInfer((a: string, b: number): void => undefined), typeOf<(a: string, b: number) => void>() as any, {excludes: ['function']});
});
