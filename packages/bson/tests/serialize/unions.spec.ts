/**
 * Serialization tests for union types and literal unions
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MongoId, PrimaryKey, Reference } from '@deepkit/type';

import { SerializeResult, getBSONSerializer } from '../../index.js';

const { ObjectId: OfficialObjectId, deserialize, serialize } = bson;

// Helper to extract buffer from tuple result
function toBuffer(result: SerializeResult): Buffer {
    const [buffer, size] = result;
    return Buffer.from(buffer.subarray(0, size));
}

test('string | number', () => {
    const serializer = getBSONSerializer<{ v: string | number }>();
    expect(toBuffer(serializer({ v: 'abc' }))).toEqual(serialize({ v: 'abc' }));
    expect(toBuffer(serializer({ v: 2 }))).toEqual(serialize({ v: 2 }));
});

test('number | class', () => {
    class MyClass {
        id: number = 0;
    }

    const serializer = getBSONSerializer<{ v: number | MyClass }>();
    expect(toBuffer(serializer({ v: { id: 5 } }))).toEqual(serialize({ v: { id: 5 } }));
    expect(toBuffer(serializer({ v: 2 }))).toEqual(serialize({ v: 2 }));
});

test('MongoId in union', () => {
    type T = { v: (MongoId | string)[] };
    const serializer = getBSONSerializer<T>();
    const bsonData = toBuffer(serializer({ v: ['507f191e810c19729de860ea', 'abc'] }));

    const back = deserialize(bsonData);
    // First element is a valid MongoId (24 hex chars) -> serialized as ObjectId
    expect(back.v[0]).toBeInstanceOf(OfficialObjectId);
    expect(back.v[0].toString()).toBe('507f191e810c19729de860ea');
    // Second element is not a valid MongoId -> serialized as string
    expect(back.v[1]).toBe('abc');
});

describe('literal union serialization', () => {
    test('string literals only', () => {
        const serializer = getBSONSerializer<{ v: 'a' | 'b' | 'c' }>();

        expect(deserialize(toBuffer(serializer({ v: 'a' })))).toEqual({ v: 'a' });
        expect(deserialize(toBuffer(serializer({ v: 'b' })))).toEqual({ v: 'b' });
        expect(deserialize(toBuffer(serializer({ v: 'c' })))).toEqual({ v: 'c' });
    });

    test('number literals only', () => {
        const serializer = getBSONSerializer<{ v: 1 | 2 | 3 }>();

        expect(deserialize(toBuffer(serializer({ v: 1 })))).toEqual({ v: 1 });
        expect(deserialize(toBuffer(serializer({ v: 2 })))).toEqual({ v: 2 });
        expect(deserialize(toBuffer(serializer({ v: 3 })))).toEqual({ v: 3 });
    });

    test('boolean literals only', () => {
        const serializer = getBSONSerializer<{ v: true | false }>();

        expect(deserialize(toBuffer(serializer({ v: true })))).toEqual({ v: true });
        expect(deserialize(toBuffer(serializer({ v: false })))).toEqual({ v: false });
    });

    test('mixed string + number', () => {
        const serializer = getBSONSerializer<{ v: 'a' | 1 }>();

        expect(deserialize(toBuffer(serializer({ v: 'a' })))).toEqual({ v: 'a' });
        expect(deserialize(toBuffer(serializer({ v: 1 })))).toEqual({ v: 1 });
    });

    test('mixed string + number + boolean', () => {
        const serializer = getBSONSerializer<{ v: 'a' | 1 | true }>();

        expect(deserialize(toBuffer(serializer({ v: 'a' })))).toEqual({ v: 'a' });
        expect(deserialize(toBuffer(serializer({ v: 1 })))).toEqual({ v: 1 });
        expect(deserialize(toBuffer(serializer({ v: true })))).toEqual({ v: true });
    });

    test('invalid value throws', () => {
        const serializer = getBSONSerializer<{ v: 'a' | 'b' | 'c' }>();

        expect(() => serializer({ v: 'invalid' as any })).toThrow();
        expect(() => serializer({ v: 123 as any })).toThrow();
    });
});

describe('literal union round-trip', () => {
    test('string literals', () => {
        const serializer = getBSONSerializer<{ status: 'active' | 'inactive' | 'pending' }>();

        for (const status of ['active', 'inactive', 'pending'] as const) {
            const buffer = toBuffer(serializer({ status }));
            expect(deserialize(buffer)).toEqual({ status });
        }
    });

    test('number literals', () => {
        const serializer = getBSONSerializer<{ level: 1 | 2 | 3 | 4 | 5 }>();

        for (const level of [1, 2, 3, 4, 5] as const) {
            const buffer = toBuffer(serializer({ level }));
            expect(deserialize(buffer)).toEqual({ level });
        }
    });

    test('mixed literals', () => {
        type T = { value: 'a' | 'b' | 1 | 2 | true | false };
        const serializer = getBSONSerializer<T>();

        for (const value of ['a', 'b', 1, 2, true, false] as const) {
            const buffer = toBuffer(serializer({ value }));
            expect(deserialize(buffer)).toEqual({ value });
        }
    });

    test('array of literal unions', () => {
        type T = { items: ('x' | 'y' | 'z')[] };
        const serializer = getBSONSerializer<T>();

        const data: T = { items: ['x', 'y', 'z', 'x', 'y'] };
        expect(deserialize(toBuffer(serializer(data)))).toEqual(data);
    });

    test('empty string in literal union', () => {
        type T = { value: '' | 'a' | 'b' };
        const serializer = getBSONSerializer<T>();

        expect(deserialize(toBuffer(serializer({ value: '' })))).toEqual({ value: '' });
    });

    test('negative number literals', () => {
        type T = { value: -1 | 0 | 1 };
        const serializer = getBSONSerializer<T>();

        for (const value of [-1, 0, 1] as const) {
            expect(deserialize(toBuffer(serializer({ value })))).toEqual({ value });
        }
    });
});

describe('literal union contexts', () => {
    test('in nested object', () => {
        type T = { outer: { status: 'x' | 'y' } };
        const serializer = getBSONSerializer<T>();

        const data: T = { outer: { status: 'x' } };
        expect(deserialize(toBuffer(serializer(data)))).toEqual(data);
    });

    test('in deeply nested object', () => {
        type T = { level1: { level2: { level3: { value: 'a' | 'b' | 'c' } } } };
        const serializer = getBSONSerializer<T>();

        const data: T = { level1: { level2: { level3: { value: 'b' } } } };
        expect(deserialize(toBuffer(serializer(data)))).toEqual(data);
    });

    test('multiple literal union properties', () => {
        type T = {
            status: 'active' | 'inactive';
            priority: 1 | 2 | 3;
            enabled: true | false;
        };
        const serializer = getBSONSerializer<T>();

        const data: T = { status: 'active', priority: 2, enabled: true };
        expect(deserialize(toBuffer(serializer(data)))).toEqual(data);
    });

    test('optional literal union property', () => {
        type T = { status?: 'active' | 'inactive' };
        const serializer = getBSONSerializer<T>();

        expect(deserialize(toBuffer(serializer({ status: 'active' })))).toEqual({ status: 'active' });
        expect(deserialize(toBuffer(serializer({})))).toEqual({});
    });
});

describe('large literal unions', () => {
    test('15 members does not cause stack overflow', () => {
        type LargeStringUnion = { v: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' };
        const serializer = getBSONSerializer<LargeStringUnion>();

        const bsonData = toBuffer(serializer({ v: 'o' }));
        expect(deserialize(bsonData)).toEqual({ v: 'o' });
    });

    test('100 number members does not cause stack overflow', () => {
        type HundredUnion = {
            v:
                | 1
                | 2
                | 3
                | 4
                | 5
                | 6
                | 7
                | 8
                | 9
                | 10
                | 11
                | 12
                | 13
                | 14
                | 15
                | 16
                | 17
                | 18
                | 19
                | 20
                | 21
                | 22
                | 23
                | 24
                | 25
                | 26
                | 27
                | 28
                | 29
                | 30
                | 31
                | 32
                | 33
                | 34
                | 35
                | 36
                | 37
                | 38
                | 39
                | 40
                | 41
                | 42
                | 43
                | 44
                | 45
                | 46
                | 47
                | 48
                | 49
                | 50
                | 51
                | 52
                | 53
                | 54
                | 55
                | 56
                | 57
                | 58
                | 59
                | 60
                | 61
                | 62
                | 63
                | 64
                | 65
                | 66
                | 67
                | 68
                | 69
                | 70
                | 71
                | 72
                | 73
                | 74
                | 75
                | 76
                | 77
                | 78
                | 79
                | 80
                | 81
                | 82
                | 83
                | 84
                | 85
                | 86
                | 87
                | 88
                | 89
                | 90
                | 91
                | 92
                | 93
                | 94
                | 95
                | 96
                | 97
                | 98
                | 99
                | 100;
        };

        const serializer = getBSONSerializer<HundredUnion>();

        expect(deserialize(toBuffer(serializer({ v: 1 })))).toEqual({ v: 1 });
        expect(deserialize(toBuffer(serializer({ v: 50 })))).toEqual({ v: 50 });
        expect(deserialize(toBuffer(serializer({ v: 100 })))).toEqual({ v: 100 });
        expect(() => serializer({ v: 101 as any })).toThrow();
    });
});

describe('built-in type unions', () => {
    test('Date | null', () => {
        const serializer = getBSONSerializer<{ v: Date | null }>();

        const date = new Date('2024-01-15T10:30:00.000Z');
        const withDate = deserialize(toBuffer(serializer({ v: date })));
        expect(withDate.v).toBeInstanceOf(Date);
        expect(withDate.v.getTime()).toBe(date.getTime());

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('Date | string', () => {
        const serializer = getBSONSerializer<{ v: Date | string }>();

        const date = new Date('2024-01-15T10:30:00.000Z');
        const withDate = deserialize(toBuffer(serializer({ v: date })));
        expect(withDate.v).toBeInstanceOf(Date);
        expect(withDate.v.getTime()).toBe(date.getTime());

        expect(deserialize(toBuffer(serializer({ v: 'hello' })))).toEqual({ v: 'hello' });
    });

    test('RegExp | null', () => {
        const serializer = getBSONSerializer<{ v: RegExp | null }>();

        const withRegex = deserialize(toBuffer(serializer({ v: /test/gi })));
        expect(withRegex.v).toBeInstanceOf(RegExp);
        expect(withRegex.v.source).toBe('test');

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('RegExp | string', () => {
        const serializer = getBSONSerializer<{ v: RegExp | string }>();

        const withRegex = deserialize(toBuffer(serializer({ v: /pattern/i })));
        expect(withRegex.v).toBeInstanceOf(RegExp);
        expect(withRegex.v.source).toBe('pattern');

        expect(deserialize(toBuffer(serializer({ v: 'plain string' })))).toEqual({ v: 'plain string' });
    });

    test('Uint8Array | null', () => {
        const serializer = getBSONSerializer<{ v: Uint8Array | null }>();

        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const withBytes = deserialize(toBuffer(serializer({ v: bytes })));
        // bson-js deserializes binary as Binary class
        expect(Array.from(withBytes.v.buffer)).toEqual([1, 2, 3, 4, 5]);

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('Map | null', () => {
        const serializer = getBSONSerializer<{ v: Map<string, number> | null }>();

        const map = new Map([
            ['a', 1],
            ['b', 2],
        ]);
        const withMap = deserialize(toBuffer(serializer({ v: map })));
        expect(withMap.v).toEqual({ a: 1, b: 2 });

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('Set | null', () => {
        const serializer = getBSONSerializer<{ v: Set<string> | null }>();

        const set = new Set(['a', 'b', 'c']);
        const withSet = deserialize(toBuffer(serializer({ v: set })));
        expect(withSet.v).toEqual(['a', 'b', 'c']);

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('Date | Uint8Array', () => {
        const serializer = getBSONSerializer<{ v: Date | Uint8Array }>();

        const date = new Date('2024-06-15T12:00:00.000Z');
        const withDate = deserialize(toBuffer(serializer({ v: date })));
        expect(withDate.v).toBeInstanceOf(Date);
        expect(withDate.v.getTime()).toBe(date.getTime());

        const bytes = new Uint8Array([10, 20, 30]);
        const withBytes = deserialize(toBuffer(serializer({ v: bytes })));
        // bson-js deserializes binary as Binary class, not Uint8Array
        expect(Array.from(withBytes.v.buffer)).toEqual([10, 20, 30]);
    });

    test('Map | Set', () => {
        const serializer = getBSONSerializer<{ v: Map<string, number> | Set<number> }>();

        const map = new Map([['x', 100]]);
        const withMap = deserialize(toBuffer(serializer({ v: map })));
        expect(withMap.v).toEqual({ x: 100 });

        const set = new Set([1, 2, 3]);
        const withSet = deserialize(toBuffer(serializer({ v: set })));
        expect(withSet.v).toEqual([1, 2, 3]);
    });

    test('Date | number (timestamp)', () => {
        const serializer = getBSONSerializer<{ v: Date | number }>();

        const date = new Date('2024-01-01T00:00:00.000Z');
        const withDate = deserialize(toBuffer(serializer({ v: date })));
        expect(withDate.v).toBeInstanceOf(Date);

        const withNumber = deserialize(toBuffer(serializer({ v: 42 })));
        expect(withNumber.v).toBe(42);
    });

    test('multiple built-in types: Date | RegExp | Uint8Array | null', () => {
        const serializer = getBSONSerializer<{ v: Date | RegExp | Uint8Array | null }>();

        const date = new Date('2024-03-20T08:00:00.000Z');
        const withDate = deserialize(toBuffer(serializer({ v: date })));
        expect(withDate.v).toBeInstanceOf(Date);
        expect(withDate.v.getTime()).toBe(date.getTime());

        const withRegex = deserialize(toBuffer(serializer({ v: /abc/ })));
        expect(withRegex.v).toBeInstanceOf(RegExp);
        expect(withRegex.v.source).toBe('abc');

        const bytes = new Uint8Array([255, 128, 0]);
        const withBytes = deserialize(toBuffer(serializer({ v: bytes })));
        // bson-js deserializes binary as Binary class
        expect(Array.from(withBytes.v.buffer)).toEqual([255, 128, 0]);

        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('array of built-in union: (Date | string)[]', () => {
        const serializer = getBSONSerializer<{ items: (Date | string)[] }>();

        const date1 = new Date('2024-01-01T00:00:00.000Z');
        const date2 = new Date('2024-12-31T23:59:59.000Z');
        const data = { items: [date1, 'text', date2, 'more text'] };

        const result = deserialize(toBuffer(serializer(data)));
        expect(result.items[0]).toBeInstanceOf(Date);
        expect(result.items[0].getTime()).toBe(date1.getTime());
        expect(result.items[1]).toBe('text');
        expect(result.items[2]).toBeInstanceOf(Date);
        expect(result.items[2].getTime()).toBe(date2.getTime());
        expect(result.items[3]).toBe('more text');
    });

    test('nested object with built-in union', () => {
        interface Config {
            name: string;
            createdAt: Date | null;
            data: Uint8Array | null;
        }
        const serializer = getBSONSerializer<Config>();

        const full: Config = {
            name: 'test',
            createdAt: new Date('2024-05-10T15:30:00.000Z'),
            data: new Uint8Array([1, 2, 3]),
        };
        const result = deserialize(toBuffer(serializer(full)));
        expect(result.name).toBe('test');
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.createdAt.getTime()).toBe(full.createdAt!.getTime());
        // bson-js deserializes binary as Binary class
        expect(Array.from(result.data.buffer)).toEqual([1, 2, 3]);

        const nulls: Config = { name: 'empty', createdAt: null, data: null };
        expect(deserialize(toBuffer(serializer(nulls)))).toEqual(nulls);
    });
});

describe('enum unions', () => {
    enum Status {
        Active = 'active',
        Inactive = 'inactive',
    }

    test('enum | null', () => {
        const serializer = getBSONSerializer<{ v: Status | null }>();
        expect(deserialize(toBuffer(serializer({ v: Status.Active })))).toEqual({ v: 'active' });
        expect(deserialize(toBuffer(serializer({ v: null })))).toEqual({ v: null });
    });

    test('enum | number', () => {
        const serializer = getBSONSerializer<{ v: Status | number }>();
        expect(deserialize(toBuffer(serializer({ v: Status.Active })))).toEqual({ v: 'active' });
        expect(deserialize(toBuffer(serializer({ v: 42 })))).toEqual({ v: 42 });
    });

    enum NumericStatus {
        Off = 0,
        On = 1,
        Standby = 2,
    }

    test('numeric enum | string', () => {
        const serializer = getBSONSerializer<{ v: NumericStatus | string }>();
        expect(deserialize(toBuffer(serializer({ v: NumericStatus.On })))).toEqual({ v: 1 });
        expect(deserialize(toBuffer(serializer({ v: 'hello' })))).toEqual({ v: 'hello' });
    });
});

describe('reference unions', () => {
    class User {
        id: number & PrimaryKey = 0;
        name: string = '';
    }

    test('Reference | null', () => {
        const serializer = getBSONSerializer<{ author: (User & Reference) | null }>();

        // Reference serializes as FK (primary key only)
        const withRef = deserialize(toBuffer(serializer({ author: { id: 5, name: 'Alice' } as User })));
        expect(withRef.author).toBe(5);

        const withNull = deserialize(toBuffer(serializer({ author: null })));
        expect(withNull.author).toBe(null);
    });
});

describe('discriminated union serialization', () => {
    test('3-member discriminated union', () => {
        type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number } | { kind: 'triangle'; base: number; height: number };

        const serializer = getBSONSerializer<{ shape: Shape }>();

        expect(deserialize(toBuffer(serializer({ shape: { kind: 'circle', radius: 5 } })))).toEqual({
            shape: { kind: 'circle', radius: 5 },
        });
        expect(deserialize(toBuffer(serializer({ shape: { kind: 'square', side: 3 } })))).toEqual({
            shape: { kind: 'square', side: 3 },
        });
        expect(deserialize(toBuffer(serializer({ shape: { kind: 'triangle', base: 4, height: 6 } })))).toEqual({
            shape: { kind: 'triangle', base: 4, height: 6 },
        });
    });

    test('numeric discriminated union', () => {
        type Msg = { type: 1; data: string } | { type: 2; count: number } | { type: 3; flag: boolean };
        const serializer = getBSONSerializer<{ msg: Msg }>();

        expect(deserialize(toBuffer(serializer({ msg: { type: 1, data: 'hello' } })))).toEqual({
            msg: { type: 1, data: 'hello' },
        });
        expect(deserialize(toBuffer(serializer({ msg: { type: 2, count: 42 } })))).toEqual({
            msg: { type: 2, count: 42 },
        });
    });
});
