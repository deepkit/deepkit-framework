import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, assertType, stringifyResolvedType } from '../src/reflection/type.js';

test('Capitalize', () => {
    type A = Capitalize<'hello world'>;
    const type = typeOf<A>();
    assertType(type, ReflectionKind.literal);
    expect(type.literal).toBe('Hello world');
});

test('Uppercase', () => {
    type A = Uppercase<'hello world'>;
    const type = typeOf<A>();
    assertType(type, ReflectionKind.literal);
    expect(type.literal).toBe('HELLO WORLD');
});

test('Lowercase', () => {
    type A = Lowercase<'HELLO WORLD'>;
    const type = typeOf<A>();
    assertType(type, ReflectionKind.literal);
    expect(type.literal).toBe('hello world');
});

test('Uncapitalize', () => {
    type A = Uncapitalize<'Hello World'>;
    const type = typeOf<A>();
    assertType(type, ReflectionKind.literal);
    expect(type.literal).toBe('hello World');
});

test('template literal with intrinsic', () => {
    type A = `Prefix_${Uppercase<'hello'>}_Suffix`;
    const type = typeOf<A>();
    assertType(type, ReflectionKind.literal);
    expect(type.literal).toBe('Prefix_HELLO_Suffix');
});

test('union intrinsic', () => {
    type A = Uppercase<'hello' | 'world'>;
    const type = typeOf<A>();
    expect(stringifyResolvedType(type)).toBe(`'HELLO' | 'WORLD'`);
    assertType(type, ReflectionKind.union);
    expect(type.types).toHaveLength(2);
    assertType(type.types[0], ReflectionKind.literal);
    assertType(type.types[1], ReflectionKind.literal);
    expect(type.types[0].literal).toBe('HELLO');
    expect(type.types[1].literal).toBe('WORLD');
});

test('template literal unioning intrinsic', () => {
    type A = `Prefix_${Uppercase<'hello' | 'world'>}_Suffix`;
    const type = typeOf<A>();
    expect(stringifyResolvedType(type)).toBe(`'Prefix_HELLO_Suffix' | 'Prefix_WORLD_Suffix'`);
    assertType(type, ReflectionKind.union);
    expect(type.types).toHaveLength(2);
    assertType(type.types[0], ReflectionKind.literal);
    assertType(type.types[1], ReflectionKind.literal);
    expect(type.types[0].literal).toBe('Prefix_HELLO_Suffix');
    expect(type.types[1].literal).toBe('Prefix_WORLD_Suffix');
});

test('complex 1', () => {
    type Keys = 'health' | 'damage' | 'defense' | 'clickRadius';
    type Modified = `original${Capitalize<Keys>}`;
    type Attributes = {
        [key in Keys | Modified]: number;
    };
    const type = typeOf<Modified>();
    expect(stringifyResolvedType(type)).toBe(`'originalHealth' | 'originalDamage' | 'originalDefense' | 'originalClickRadius'`);
    const attributes = typeOf<Attributes>();
    expect(stringifyResolvedType(attributes)).toBe(`Attributes {
  health: number;
  damage: number;
  defense: number;
  clickRadius: number;
  originalHealth: number;
  originalDamage: number;
  originalDefense: number;
  originalClickRadius: number;
}`);
});
