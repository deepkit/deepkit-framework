import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind } from '../src/reflection/type.js';
import { deserialize, serialize } from '../src/serializer-facade.js';
import { AutoIncrement, NanoId, PrimaryKey, isNanoIdType } from '../src/type-annotations.js';
import { is } from '../src/typeguard.js';
import { nanoid } from '../src/utils.js';
import { validate } from '../src/validator.js';

test('NanoId type reflection', () => {
    type t = NanoId;
    const type = typeOf<t>();
    expect(type.kind).toBe(ReflectionKind.string);
    expect(isNanoIdType(type)).toBe(true);
});

test('NanoId type reflection with intersection', () => {
    type t = NanoId & PrimaryKey;
    const type = typeOf<t>();
    expect(type.kind).toBe(ReflectionKind.string);
    expect(isNanoIdType(type)).toBe(true);
});

test('NanoId validation - valid 21 character id', () => {
    // Valid 21-char nanoid (standard alphabet: A-Za-z0-9_-)
    expect(is<NanoId>('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
    expect(is<NanoId>('abcdefghijklmnopqrstu')).toBe(true);
    expect(is<NanoId>('ABCDEFGHIJKLMNOPQRSTU')).toBe(true);
    expect(is<NanoId>('01234567890123456789a')).toBe(true);
    expect(is<NanoId>('_____________________')).toBe(true);
    expect(is<NanoId>('---------------------')).toBe(true);
});

test('NanoId validation - invalid length', () => {
    // Invalid: wrong length
    expect(is<NanoId>('tooshort')).toBe(false);
    expect(is<NanoId>('this-is-way-too-long-to-be-valid')).toBe(false);
    expect(is<NanoId>('')).toBe(false);
    expect(is<NanoId>('12345678901234567890')).toBe(false); // 20 chars
    expect(is<NanoId>('1234567890123456789012')).toBe(false); // 22 chars
});

test('NanoId validation - invalid types', () => {
    // Invalid: not a string
    expect(is<NanoId>(12345 as any)).toBe(false);
    expect(is<NanoId>(null as any)).toBe(false);
    expect(is<NanoId>(undefined as any)).toBe(false);
    expect(is<NanoId>({} as any)).toBe(false);
    expect(is<NanoId>([] as any)).toBe(false);
});

test('NanoId validation error messages', () => {
    const errors = validate<NanoId>('tooshort');
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe('type');
    expect(errors[0].message).toBe('Not a valid NanoId');
    expect(errors[0].path).toBe('');
    expect(errors[0].value).toBe('tooshort');
});

test('NanoId deserialization - valid', () => {
    const valid = deserialize<NanoId>('V1StGXR8_Z5jdHi6B-myT');
    expect(valid).toBe('V1StGXR8_Z5jdHi6B-myT');
});

test('NanoId deserialization - invalid throws', () => {
    expect(() => deserialize<NanoId>('invalid')).toThrow('Not a valid NanoId');
    expect(() => deserialize<NanoId>('')).toThrow('Not a valid NanoId');
    expect(() => deserialize<NanoId>('this-is-too-long-to-be-a-valid-nanoid')).toThrow('Not a valid NanoId');
});

test('NanoId serialization', () => {
    const id = 'V1StGXR8_Z5jdHi6B-myT';
    const serialized = serialize<NanoId>(id);
    expect(serialized).toBe(id);
});

test('nanoid generator - default size', () => {
    const id = nanoid();
    expect(id.length).toBe(21);
    expect(typeof id).toBe('string');
    expect(is<NanoId>(id)).toBe(true);
});

test('nanoid generator - custom size', () => {
    const shortId = nanoid(10);
    expect(shortId.length).toBe(10);
    expect(typeof shortId).toBe('string');

    const longId = nanoid(50);
    expect(longId.length).toBe(50);
    expect(typeof longId).toBe('string');
});

test('nanoid generator - uniqueness', () => {
    const id1 = nanoid();
    const id2 = nanoid();
    const id3 = nanoid();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);

    // Generate many IDs and check uniqueness
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
        ids.add(nanoid());
    }
    expect(ids.size).toBe(1000);
});

test('nanoid generator - URL-safe alphabet', () => {
    // Generate many IDs and verify they only contain URL-safe characters
    const urlSafePattern = /^[A-Za-z0-9_-]+$/;
    for (let i = 0; i < 100; i++) {
        const id = nanoid();
        expect(urlSafePattern.test(id)).toBe(true);
    }
});

test('NanoId as primary key in class', () => {
    class User {
        id: NanoId & PrimaryKey = nanoid();
        name: string = '';
    }

    const user = new User();
    expect(user.id.length).toBe(21);
    expect(is<NanoId>(user.id)).toBe(true);

    const reflection = ReflectionClass.from(User);
    const idProperty = reflection.getProperty('id');
    expect(idProperty).toBeDefined();
    expect(isNanoIdType(idProperty.type)).toBe(true);
});

test('NanoId in entity serialization roundtrip', () => {
    class Entity {
        id: NanoId & PrimaryKey = nanoid();
        title: string = '';
    }

    const entity = new Entity();
    entity.title = 'Test Entity';

    const serialized = serialize<Entity>(entity);
    expect(serialized.id).toBe(entity.id);
    expect(serialized.title).toBe('Test Entity');

    const deserialized = deserialize<Entity>(serialized);
    expect(deserialized.id).toBe(entity.id);
    expect(deserialized.title).toBe('Test Entity');
    expect(deserialized).toBeInstanceOf(Entity);
});

test('NanoId optional property', () => {
    class OptionalNanoId {
        id?: NanoId;
    }

    expect(is<OptionalNanoId>({})).toBe(true);
    expect(is<OptionalNanoId>({ id: 'V1StGXR8_Z5jdHi6B-myT' })).toBe(true);
    expect(is<OptionalNanoId>({ id: 'invalid' })).toBe(false);
});

test('NanoId nullable property', () => {
    class NullableNanoId {
        id: NanoId | null = null;
    }

    expect(is<NullableNanoId>({ id: null })).toBe(true);
    expect(is<NullableNanoId>({ id: 'V1StGXR8_Z5jdHi6B-myT' })).toBe(true);
    expect(is<NullableNanoId>({ id: 'invalid' })).toBe(false);
});

test('NanoId in union type', () => {
    type IdType = NanoId | number;

    expect(is<IdType>('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
    expect(is<IdType>(123)).toBe(true);
    expect(is<IdType>('invalid')).toBe(false);
});

test('NanoId array', () => {
    type NanoIdArray = NanoId[];

    const validArray = ['V1StGXR8_Z5jdHi6B-myT', 'abcdefghijklmnopqrstu'];
    expect(is<NanoIdArray>(validArray)).toBe(true);

    const invalidArray = ['V1StGXR8_Z5jdHi6B-myT', 'invalid'];
    expect(is<NanoIdArray>(invalidArray)).toBe(false);

    expect(is<NanoIdArray>([])).toBe(true);
});
