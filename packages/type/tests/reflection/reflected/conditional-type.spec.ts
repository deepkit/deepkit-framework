import { expect, test } from '@jest/globals';
import { removeTypeName, typeOf } from '../../../src/reflection/reflection';

test('distributed conditional type', () => {
    //when T is naked, it will be distributed
    type OnlyStrings<T> = T extends string ? T : never;
    type OnlyStrings1<T> = [T] extends [string] ? T : never;
    type OnlyStrings2<T, E> = T extends string ? T : E;
    type OnlyStrings22<T, E> = boolean | (T extends string ? T : E);
    type OnlyStrings3<T, E> = T extends infer K ? boolean | (K extends string ? K : E) : never;
    type OnlyStrings4<T, T2, E> = T2 extends string ? T2[] : T;
    expect(removeTypeName(typeOf<OnlyStrings<string>>())).toEqual(typeOf<string>());
    expect(removeTypeName(typeOf<OnlyStrings1<string>>())).toEqual(typeOf<string>());

    type r1 = OnlyStrings<'a' | 'b' | number>; //'a' | 'b'
    type r12 = OnlyStrings2<'a' | 'b' | number, 'nope'>; //boolean | 'a' | 'b' | 'nope'
    type r122 = OnlyStrings22<'a' | 'b' | number, 'nope'>; //boolean | 'a' | 'b' | 'nope'

    expect(typeOf<r1>()).toEqual(typeOf<'a' | 'b'>());
    expect(typeOf<r12>()).toEqual(typeOf<'a' | 'b' | 'nope'>());
    expect(typeOf<r122>()).toEqual(typeOf<boolean | 'a' | 'b' | 'nope'>());

    type r13 = OnlyStrings3<'a' | 'b' | number, 'nope'>; //boolean | 'a' | 'b' | 'nope'
    expect(typeOf<r13>()).toEqual(typeOf<boolean | 'a' | 'b' | 'nope'>());

    type r14 = OnlyStrings4<'a' | 'b', 'c' | 'd', 'nope'>; //'c'[] | 'd'[]
    expect(typeOf<r14>()).toEqual(typeOf<'c'[] | 'd'[]>());
});

test('deep distribution in mapped type', () => {
    type Filter<O, V> = { [K in keyof O]: V extends O[K] ? O[K] : never }[keyof O];
    type FilterNoDistribution<O, V> = { [K in keyof O]: [V] extends [O[K]] ? O[K] : never }[keyof O];

    type r1 = Filter<{ a: string, b: number }, string>; // string
    type r2 = Filter<{ a: string, b: number }, number>; // number
    type r3 = Filter<{ a: string, b: number }, string | number>; // string|number
    expect(removeTypeName(typeOf<r1>())).toEqual(typeOf<string>());
    expect(removeTypeName(typeOf<r2>())).toEqual(typeOf<number>());
    expect(removeTypeName(typeOf<r3>())).toEqual(typeOf<string | number>());

    type r4 = FilterNoDistribution<{ a: string, b: number }, string>; // string
    type r5 = FilterNoDistribution<{ a: string, b: number }, number>; // number
    type r6 = FilterNoDistribution<{ a: string, b: number }, string | number>; // never
    expect(removeTypeName(typeOf<r4>())).toEqual(typeOf<string>());
    expect(removeTypeName(typeOf<r5>())).toEqual(typeOf<number>());
    expect(removeTypeName(typeOf<r6>())).toEqual(typeOf<never>());
});

test('disable distribution tuple', () => {
    type DisabledDistribution<T> = [T] extends [string] ? T[] : never;

    type r2 = DisabledDistribution<'a' | 'b'>; // ('a' | 'b')[]
    type r3 = DisabledDistribution<'a' | 'b' | number>; // never
    expect(removeTypeName(typeOf<r2>())).toEqual(typeOf<('a' | 'b')[]>());
    expect(removeTypeName(typeOf<r3>())).toEqual(typeOf<never>());
});

test('disable distribution array', () => {
    type DisabledDistribution<T> = T[] extends string[] ? T[] : never;

    type r2 = DisabledDistribution<'a' | 'b'>; // ('a' | 'b')[]
    type r3 = DisabledDistribution<'a' | 'b' | number>; // never
    expect(removeTypeName(typeOf<r2>())).toEqual(typeOf<('a' | 'b')[]>());
    expect(removeTypeName(typeOf<r3>())).toEqual(typeOf<never>());
});
