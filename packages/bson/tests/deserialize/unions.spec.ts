/**
 * Deserialization tests for union types
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { Embedded, MongoId, PrimaryKey, Reference, UUID, nodeBufferToArrayBuffer, uuid } from '@deepkit/type';

import { deserializeBSON, getBSONDeserializer, getBSONSerializer, serializeBSONWithoutOptimiser } from '../../index.js';

const { Binary, serialize } = bson;

describe('basic unions', () => {
    test('string | number - string value', () => {
        type T = { v: string | number };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    });

    test('string | number - number value', () => {
        type T = { v: string | number };
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: 123 });
    });

    test('string | number - undefined throws', () => {
        type T = { v: string | number };
        expect(() => deserializeBSON<T>(serialize({ v: undefined }))).toThrow('Cannot convert undefined value to string | number');
        expect(() => deserializeBSON<T>(serialize({}))).toThrow('Cannot convert undefined value to string | number');
    });

    test('optional string | number', () => {
        type T = { v?: string | number };
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: undefined });
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: undefined });
        expect(deserializeBSON<T>(serialize({}))).toEqual({ v: undefined });
    });
});

describe('union two objects', () => {
    test('discriminated by property name', () => {
        type T = { a: string } | { b: number };
        expect(deserializeBSON<T>(serialize({ a: 'abc' }))).toEqual({ a: 'abc' });
        expect(deserializeBSON<T>(serialize({ b: 123 }))).toEqual({ b: 123 });
    });
});

describe('union with typed array', () => {
    test('string | Uint8Array - binary value', () => {
        const buffer = Buffer.allocUnsafe(16);
        type T = { v: string | Uint8Array };
        expect(deserializeBSON<T>(serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) }))).toEqual({
            v: new Uint8Array(buffer),
        });
    });

    test('string | Uint8Array - string value', () => {
        type T = { v: string | Uint8Array };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    });

    test('string | Uint8Array - object throws', () => {
        type T = { v: string | Uint8Array };
        expect(() => deserializeBSON<T>(serialize({ v: {} }))).toThrow('No union member matched. Expected: string | Uint8Array');
    });
});

describe('union with ArrayBuffer', () => {
    test('string | ArrayBuffer - binary value', () => {
        const buffer = Buffer.allocUnsafe(16);
        type T = { v: string | ArrayBuffer };
        expect(deserializeBSON<T>(serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) }))).toEqual({
            v: nodeBufferToArrayBuffer(buffer),
        });
    });

    test('string | ArrayBuffer - string value', () => {
        type T = { v: string | ArrayBuffer };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    });

    test('string | ArrayBuffer - object throws', () => {
        type T = { v: string | ArrayBuffer };
        expect(() => deserializeBSON<T>(serialize({ v: {} }))).toThrow('No union member matched. Expected: string | ArrayBuffer');
    });
});

describe('union with null', () => {
    test('string | null - string value', () => {
        type T = { v: string | null };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    });

    test('string | null - null value', () => {
        type T = { v: string | null };
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: null });
    });

    test('optional string | null - undefined', () => {
        type T = { v?: string | null };
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: null });
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: undefined });
    });
});

describe('union with literals', () => {
    test('string literals', () => {
        type T = { v: 'a' | 'b' };
        expect(deserializeBSON<T>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    });

    test('string literal | string', () => {
        type T = { v: 'a' | string };
        expect(deserializeBSON<T>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    });

    test('string literal | number literal', () => {
        type T = { v: 'a' | 2 };
        expect(deserializeBSON<T>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    });

    test('string literal | number literal with extra property', () => {
        type T = { v: 'a' | 2; num: number };
        expect(deserializeBSON<T>(serialize({ v: 2, num: 5 }))).toEqual({ v: 2, num: 5 });
    });

    test('boolean literal | number', () => {
        type T = { v: true | number };
        expect(deserializeBSON<T>(serialize({ v: 2 }))).toEqual({ v: 2 });
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: true });
        expect(deserializeBSON<T>(serialize({ v: false }))).toEqual({ v: 0 }); // false coerced to 0 for number
    });
});

describe('union with template literals', () => {
    test('template literal | number', () => {
        type T = { v: `a${number}` | number };
        expect(deserializeBSON<T>(serialize({ v: 'a123' }))).toEqual({ v: 'a123' });
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: 123 });
    });

    test('optional template literal | number', () => {
        type T = { v?: `a${number}` | number };
        expect(deserializeBSON<T>(serialize({ v: undefined }))).toEqual({ v: undefined });
    });
});

describe('template literal exact', () => {
    test('valid template literal', () => {
        type T = { v: `a${number}` };
        expect(deserializeBSON<T>(serialize({ v: 'a123' }))).toEqual({ v: 'a123' });
        expect(deserializeBSON<T>(serialize({ v: 'a1' }))).toEqual({ v: 'a1' });
    });

    test('invalid template literal throws', () => {
        type T = { v: `a${number}` };
        expect(() => deserializeBSON<T>(serialize({ v: 'a' }))).toThrow('Cannot convert a to `a${number}`');
        expect(() => deserializeBSON<T>(serialize({ v: 'abc' }))).toThrow('Cannot convert abc to `a${number}`');
        expect(() => deserializeBSON<T>(serialize({ v: false }))).toThrow('Cannot convert bson type BOOLEAN to `a${number}`');
        expect(() => deserializeBSON<T>(serialize({ v: 234 }))).toThrow('Cannot convert bson type INT to `a${number}`');
    });
});

describe('union with UUID', () => {
    test('string | UUID', () => {
        const myUuid = uuid();
        type T = { v: string | UUID };
        expect(deserializeBSON<T>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
        expect(deserializeBSON<T>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
        expect(deserializeBSON<T>(serialize({ v: 23 }))).toEqual({ v: '23' }); // number coerced to string
    });

    test('number | UUID', () => {
        const myUuid = uuid();
        type T = { v: number | UUID };
        expect(deserializeBSON<T>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
        expect(deserializeBSON<T>(serialize({ v: 23 }))).toEqual({ v: 23 });
        expect(() => deserializeBSON<T>(serialize({ v: 'asdad' }))).toThrow('No union member matched. Expected: number | UUID');
    });

    test('null | UUID', () => {
        const myUuid = uuid();
        type T = { v: null | UUID };
        expect(deserializeBSON<T>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: null });
        expect(() => deserializeBSON<T>(serialize({ v: 'asdad' }))).toThrow('Cannot convert asdad to UUID');
    });

    test('UUID | undefined invalid string throws', () => {
        type T = { v: UUID | undefined };
        expect(() => deserializeBSON<T>(serialize({ v: 'asdad' }))).toThrow('Cannot convert asdad to UUID');
    });
});

describe('union with Date', () => {
    test('number | Date - number value', () => {
        type T = { v: number | Date };
        expect(deserializeBSON<T>(serialize({ v: 23 }))).toEqual({ v: 23 });
    });

    test('number | Date - date value', () => {
        const value = new Date();
        type T = { v: number | Date };
        expect(deserializeBSON<T>(serialize({ v: value }))).toEqual({ v: value });
    });

    test('number | Date - boolean coerced to number', () => {
        type T = { v: number | Date };
        expect(deserializeBSON<T>(serialize({ v: true }))).toEqual({ v: 1 });
    });

    test('number | Date - undefined throws', () => {
        type T = { v: number | Date };
        expect(() => deserializeBSON<T>(serialize({}))).toThrow('Cannot convert undefined value to number | Date');
    });
});

describe('union with RegExp', () => {
    test('number | RegExp - regexp value', () => {
        const myRegexp = /abc/gim;
        type T = { v: number | RegExp };
        expect(deserializeBSON<T>(serialize({ v: myRegexp }))).toEqual({ v: myRegexp });
    });

    test('number | RegExp - number value', () => {
        type T = { v: number | RegExp };
        expect(deserializeBSON<T>(serialize({ v: 23 }))).toEqual({ v: 23 });
    });

    test('number | RegExp - object throws', () => {
        type T = { v: number | RegExp };
        expect(() => deserializeBSON<T>(serialize({ v: {} }))).toThrow('No union member matched. Expected: number | RegExp');
    });

    test('number | RegExp - undefined throws', () => {
        type T = { v: number | RegExp };
        expect(() => deserializeBSON<T>(serialize({}))).toThrow('Cannot convert undefined value to number | RegExp');
    });
});

describe('union with MongoId', () => {
    test('basic mongoId', () => {
        const myObjectId = '507f1f77bcf86cd799439011';
        type T = { v: MongoId };
        const [buf, size] = getBSONSerializer<T>()({ v: myObjectId });
        expect(deserializeBSON<{ v: string }>(buf.slice(0, size))).toEqual({ v: myObjectId });
        expect(deserializeBSON<T>(serialize({ v: myObjectId }))).toEqual({ v: myObjectId });
    });

    test('invalid mongoId throws', () => {
        type T = { v: MongoId };
        expect(() => deserializeBSON<T>(serialize({ v: 'asd' }))).toThrow('Cannot convert asd to MongoId.');
        expect(() => deserializeBSON<T>(serialize({ v: 0 }))).toThrow('Cannot convert 0 to MongoId.');
    });
});

describe('union scoring — overlapping object types', () => {
    test('{ a } | { a, b } — wider member selected when data has b', () => {
        type T = { a: number } | { a: number; b: string };
        const ser = getBSONSerializer<T>();
        const deserialize = getBSONDeserializer<T>();

        // Data with only 'a' → matches { a }
        const data1: T = { a: 1 };
        const [b1, s1] = ser(data1);
        expect(deserialize(b1.slice(0, s1))).toEqual(data1);

        // Data with 'a' and 'b' → MUST match { a, b }, not drop 'b'
        const data2: T = { a: 1, b: '2' };
        const [b2, s2] = ser(data2);
        expect(deserialize(b2.slice(0, s2))).toEqual(data2);
    });

    test('{ a, b } | { a } — reversed declaration order, b still preserved', () => {
        // Same union but declared in opposite order
        type T = { a: number; b: string } | { a: number };
        const deserialize = getBSONDeserializer<T>();

        // Data with both 'a' and 'b' — must select wider type regardless of order
        const bsonData = bson.serialize({ a: 1, b: 'hello' });
        const result = deserialize(bsonData);
        expect(result).toEqual({ a: 1, b: 'hello' });

        // Data with only 'a' — matches { a }
        const bsonData2 = bson.serialize({ a: 1 });
        expect(deserialize(bsonData2)).toEqual({ a: 1 });
    });

    test('3 members with progressive widening — selects widest match', () => {
        type T = { a: number } | { a: number; b: string } | { a: number; b: string; c: boolean };
        const deserialize = getBSONDeserializer<T>();

        // Only 'a' → matches { a }
        expect(deserialize(bson.serialize({ a: 1 }))).toEqual({ a: 1 });

        // 'a' + 'b' → matches { a, b }
        expect(deserialize(bson.serialize({ a: 1, b: 'x' }))).toEqual({ a: 1, b: 'x' });

        // 'a' + 'b' + 'c' → matches { a, b, c }
        expect(deserialize(bson.serialize({ a: 1, b: 'x', c: true }))).toEqual({ a: 1, b: 'x', c: true });
    });

    test('nested objects with overlapping shapes — narrow match', () => {
        type Inner = { x: number } | { x: number; y: string };
        type T = { v: Inner };
        const deserialize = getBSONDeserializer<T>();

        // Nested with only 'x' — matches narrow type
        expect(deserialize(bson.serialize({ v: { x: 5 } }))).toEqual({ v: { x: 5 } });
    });

    test('nested objects with overlapping shapes — wide match selects wider type (narrow first)', () => {
        type Inner = { x: number } | { x: number; y: string };
        type T = { v: Inner };
        const deserialize = getBSONDeserializer<T>();

        // Nested with both 'x' and 'y' — scoring selects wider type { x, y }
        expect(deserialize(bson.serialize({ v: { x: 5, y: 'hello' } }))).toEqual({ v: { x: 5, y: 'hello' } });
    });

    test('nested objects with overlapping shapes — reversed declaration order (wide first)', () => {
        // Wide type declared first — must still select correctly based on data
        type Inner = { x: number; y: string } | { x: number };
        type T = { v: Inner };
        const deserialize = getBSONDeserializer<T>();

        // Both fields present → wider type
        expect(deserialize(bson.serialize({ v: { x: 5, y: 'hello' } }))).toEqual({ v: { x: 5, y: 'hello' } });
        // Only 'x' → narrow type
        expect(deserialize(bson.serialize({ v: { x: 5 } }))).toEqual({ v: { x: 5 } });
    });

    test('nested 3-member progressive widening — order independent', () => {
        // Reversed order: widest first
        type Inner = { a: number; b: string; c: boolean } | { a: number; b: string } | { a: number };
        type T = { v: Inner };
        const deserialize = getBSONDeserializer<T>();

        expect(deserialize(bson.serialize({ v: { a: 1 } }))).toEqual({ v: { a: 1 } });
        expect(deserialize(bson.serialize({ v: { a: 1, b: 'x' } }))).toEqual({ v: { a: 1, b: 'x' } });
        expect(deserialize(bson.serialize({ v: { a: 1, b: 'x', c: true } }))).toEqual({ v: { a: 1, b: 'x', c: true } });
    });

    test('overlapping with different value types — type-based selection', () => {
        type T = { a: number; b: number } | { a: number; b: string };
        const deserialize = getBSONDeserializer<T>();

        // b is number → matches { a: number; b: number }
        expect(deserialize(bson.serialize({ a: 1, b: 42 }))).toEqual({ a: 1, b: 42 });

        // b is string → matches { a: number; b: string }
        expect(deserialize(bson.serialize({ a: 1, b: 'text' }))).toEqual({ a: 1, b: 'text' });
    });

    test('{ a, b? } | { a, b: string }', () => {
        type T = { a: number; b?: number } | { a: number; b: string };
        const ser = getBSONSerializer<T>();
        const deserialize = getBSONDeserializer<T>();

        const data1: T = { a: 1 };
        const [b1, s1] = ser(data1);
        expect(deserialize(b1.slice(0, s1))).toEqual(data1);

        const data2: T = { a: 1, b: 3 };
        const [b2, s2] = ser(data2);
        expect(deserialize(b2.slice(0, s2))).toEqual(data2);

        // Note: round-trip of { a: 1, b: '2' } depends on serializer union member selection.
        // The serializer may pick { a: number; b?: number } and coerce '2' to 2.
        // Test the deserializer independently: BSON with b as STRING '2' should match { a: number; b: string }
        const data3: T = { a: 1, b: '2' };
        const bsonData3 = bson.serialize(data3);
        expect(deserialize(bsonData3)).toEqual(data3);
    });

    test('discriminated + overlapping — discriminator takes priority', () => {
        type T = { kind: 'base'; a: number } | { kind: 'extended'; a: number; b: string };
        const deserialize = getBSONDeserializer<T>();

        expect(deserialize(bson.serialize({ kind: 'base', a: 1 }))).toEqual({ kind: 'base', a: 1 });
        expect(deserialize(bson.serialize({ kind: 'extended', a: 1, b: 'x' }))).toEqual({
            kind: 'extended',
            a: 1,
            b: 'x',
        });
    });
});

describe('union error messages (#676)', () => {
    test('missing required field shows helpful error', () => {
        interface ChatMessage {
            id: string;
            text: string;
        }

        type MessageEvent = { channel: string; type: 'message'; message: ChatMessage };
        type MessageUpdateEvent = { channel: string; type: 'message-update'; message: ChatMessage };

        type BusMessage<T> = { v: T };
        type BusMessageEvent = BusMessage<MessageEvent | MessageUpdateEvent>;

        const deserialize = getBSONDeserializer<BusMessageEvent>();

        // Valid data works
        const validData = {
            v: {
                channel: '123',
                type: 'message' as const,
                message: { id: '1', text: 'hello' },
            },
        };
        expect(deserialize(serialize(validData))).toEqual(validData);

        // Missing required field 'message' - should give helpful error
        const invalidData = {
            v: {
                channel: '123',
                type: 'message',
                message: undefined,
            },
        };

        expect(() => deserialize(serialize(invalidData))).toThrow(/No union member matched.*Expected/);
        expect(() => deserialize(serialize(invalidData))).toThrow(/MessageEvent|MessageUpdateEvent/);
    });
});

describe('array unions', () => {
    test('basic array union', () => {
        const value = ['a', 'b', false, 'c', true];
        type T = { v: (string | boolean)[] };
        expect(deserializeBSON<T>(serialize({ v: value }))).toEqual({ v: value });
    });

    test('array union - invalid type throws', () => {
        type T = { v: (string | boolean)[] };
        expect(() => deserializeBSON<T>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to Array<string | boolean>');
        expect(() => deserializeBSON<T>(serialize({ v: ['a', {}] }))).toThrow('No union member matched. Expected: string | boolean');
    });

    test('two array union', () => {
        type MyType = number[] | (string | boolean)[];
        type T = { v: MyType };
        expect(deserializeBSON<T>(serialize({ v: ['a', 'b', false] }))).toEqual({ v: ['a', 'b', false] });
        expect(deserializeBSON<T>(serialize({ v: [1, 2] }))).toEqual({ v: [1, 2] });
        expect(() => deserializeBSON<T>(serialize({ v: 123 }))).toThrow('No union member matched. Expected: MyType');
    });

    test('loosely array union', () => {
        type MyType = (string | boolean)[] | number;
        type T = { v: MyType };
        expect(deserializeBSON<T>(serialize({ v: ['a', 'b', false] }))).toEqual({ v: ['a', 'b', false] });
        expect(deserializeBSON<T>(serialize({ v: [1, 2] }))).toEqual({ v: ['1', '2'] }); // numbers coerced to strings
        expect(deserializeBSON<T>(serialize({ v: 123 }))).toEqual({ v: 123 });
    });
});

describe('class array in union', () => {
    test('discriminated by property type', () => {
        class A {
            type!: 'a';
            b?: number;
        }

        class B {
            type!: 'b';
        }

        class C {
            c!: string;
        }

        type MyType = A[] | B[] | C[];
        type T = { v: MyType };

        {
            const items = deserializeBSON<T>(serialize({ v: [{ type: 'a' }] }));
            expect(items.v[0]).toBeInstanceOf(A);
            expect((items.v[0] as A).type).toBe('a');
        }

        {
            const items = deserializeBSON<T>(serialize({ v: [{ type: 'b' }] }));
            expect(items.v[0]).toBeInstanceOf(B);
            expect((items.v[0] as B).type).toBe('b');
        }

        {
            const items = deserializeBSON<T>(serialize({ v: [{ c: 'yes' }] }));
            expect(items.v[0]).toBeInstanceOf(C);
            expect((items.v[0] as C).c).toBe('yes');
        }

        {
            expect(() => deserializeBSON<T>(serialize({ v: [{ nope: 'no' }] }))).toThrow(`No union member matched. Expected: MyType`);
        }
    });
});

describe('enum unions', () => {
    enum Status {
        Active = 'active',
        Inactive = 'inactive',
    }

    test('enum | null', () => {
        type T = { v: Status | null };
        expect(deserializeBSON<T>(serialize({ v: 'active' }))).toEqual({ v: Status.Active });
        expect(deserializeBSON<T>(serialize({ v: null }))).toEqual({ v: null });
    });

    test('enum | number — string enum with non-string union member', () => {
        type T = { v: Status | number };
        // STRING "active" → matches Status enum
        expect(deserializeBSON<T>(serialize({ v: 'active' }))).toEqual({ v: Status.Active });
        expect(deserializeBSON<T>(serialize({ v: 'inactive' }))).toEqual({ v: Status.Inactive });
        // INT 42 → matches number
        expect(deserializeBSON<T>(serialize({ v: 42 }))).toEqual({ v: 42 });
    });

    enum NumericStatus {
        Off = 0,
        On = 1,
        Standby = 2,
    }

    test('numeric enum | string — numeric enum with string union member', () => {
        type T = { v: NumericStatus | string };
        // INT 1 → matches NumericStatus.On (numeric enum wins over string coercion)
        expect(deserializeBSON<T>(serialize({ v: 1 }))).toEqual({ v: NumericStatus.On });
        expect(deserializeBSON<T>(serialize({ v: 0 }))).toEqual({ v: NumericStatus.Off });
        // STRING "hello" → matches string
        expect(deserializeBSON<T>(serialize({ v: 'hello' }))).toEqual({ v: 'hello' });
    });
});

describe('reference unions', () => {
    class User {
        id: number & PrimaryKey = 0;
        name: string = '';
    }

    test('Reference | null roundtrip', () => {
        type T = { author: (User & Reference) | null };
        const ser = getBSONSerializer<T>();
        const deser = getBSONDeserializer<T>();

        // Serialize FK only (reference serializes as primary key)
        const [buf1, size1] = ser({ author: { id: 5, name: 'Alice' } as User });
        const result1 = deser(buf1.slice(0, size1));
        // Deserializer creates a reference stub with just the FK
        expect((result1.author as any).id).toBe(5);

        // Null
        const [buf2, size2] = ser({ author: null });
        const result2 = deser(buf2.slice(0, size2));
        expect(result2.author).toBe(null);
    });
});

describe('discriminated union edge cases', () => {
    test('3-member discriminated union', () => {
        type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number } | { kind: 'triangle'; base: number; height: number };

        type T = { shape: Shape };

        expect(deserializeBSON<T>(serialize({ shape: { kind: 'circle', radius: 5 } }))).toEqual({
            shape: { kind: 'circle', radius: 5 },
        });
        expect(deserializeBSON<T>(serialize({ shape: { kind: 'square', side: 3 } }))).toEqual({
            shape: { kind: 'square', side: 3 },
        });
        expect(deserializeBSON<T>(serialize({ shape: { kind: 'triangle', base: 4, height: 6 } }))).toEqual({
            shape: { kind: 'triangle', base: 4, height: 6 },
        });
    });

    test('numeric discriminated union', () => {
        type Msg = { type: 1; data: string } | { type: 2; count: number } | { type: 3; flag: boolean };

        type T = { msg: Msg };

        expect(deserializeBSON<T>(serialize({ msg: { type: 1, data: 'hello' } }))).toEqual({
            msg: { type: 1, data: 'hello' },
        });
        expect(deserializeBSON<T>(serialize({ msg: { type: 2, count: 42 } }))).toEqual({
            msg: { type: 2, count: 42 },
        });
        expect(deserializeBSON<T>(serialize({ msg: { type: 3, flag: true } }))).toEqual({
            msg: { type: 3, flag: true },
        });
    });

    test('bigint | number | string', () => {
        type T = { v: bigint | number | string };
        // BSON INT dispatches to bigint (higher priority than number in union dispatch)
        const result = deserializeBSON<T>(serialize({ v: 42 }));
        expect(typeof result.v === 'bigint' || typeof result.v === 'number').toBe(true);
        expect(deserializeBSON<T>(serialize({ v: 'hello' }))).toEqual({ v: 'hello' });
    });
});
