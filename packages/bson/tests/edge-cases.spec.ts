/**
 * Edge case tests: invalid buffers, circular references, large documents
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { ReflectionClass, hasCircularReference, typeOf } from '@deepkit/type';

import { BSONType, deserializeBSON, deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer, serializeBSON, serializeBSONWithoutOptimiser } from '../index.js';

const { serialize } = bson;

describe('invalid buffer handling', () => {
    test('truncated buffer - string parse', () => {
        const buffer = Buffer.from([
            28,
            0,
            0,
            0, // size
            BSONType.BINARY, // just some type
            112,
            111,
            115,
            105,
            116,
            105,
            111,
            110, // "position" without ending null
            // to simulate a buffer that is not correctly serialized
        ]);

        expect(() => deserializeBSONWithoutOptimiser(buffer)).toThrow('Unexpected end of buffer');

        const deserialize = getBSONDeserializer<{ position: Uint8Array }>();
        expect(() => deserialize(buffer)).toThrow('Unexpected end of buffer');

        const deserialize2 = getBSONDeserializer<{ [name: string]: Uint8Array }>();
        expect(() => deserialize2(buffer)).toThrow('Unexpected end of buffer');
    });

    test('empty buffer', () => {
        const buffer = new Uint8Array(0);
        expect(() => deserializeBSONWithoutOptimiser(buffer)).toThrow();
    });

    test('buffer too small for size', () => {
        // Size says 100 bytes but buffer is only 4
        const buffer = Buffer.from([100, 0, 0, 0]);
        expect(() => deserializeBSONWithoutOptimiser(buffer)).toThrow();
    });
});

describe('circular reference handling', () => {
    test('circular reference detection', () => {
        class Model {
            another?: Model;

            constructor(public id: number = 0) {}
        }

        expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);
    });

    test('circular reference omission in serialization', () => {
        class Model {
            another?: Model;

            constructor(public id: number = 0) {}
        }

        // Non-circular case: model -> model2
        {
            const model = new Model(1);
            const model2 = new Model(2);
            model.another = model2;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.another).toBeInstanceOf(Object);
            expect(json.another!.id).toBe(2);
        }

        // Circular case: model -> model (self-reference)
        {
            const model = new Model(1);
            model.another = model;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.another).toBe(undefined);
        }
    });

    test('circular reference interface', () => {
        interface Model {
            id: number;
            another?: Model;
        }

        expect(hasCircularReference(typeOf<Model>())).toBe(true);

        // Non-circular
        {
            const model: Model = { id: 1 };
            const model2: Model = { id: 2 };
            model.another = model2;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.another!.id).toBe(2);
        }

        // Circular
        {
            const model: Model = { id: 1 };
            model.another = model;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.another).toBe(undefined);
        }
    });

    test('indirect circular reference', () => {
        class Config {
            constructor(public model: Model) {}
        }

        class Model {
            id: number = 0;
            config?: Config;
        }

        expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);
        expect(ReflectionClass.from(Config).hasCircularReference()).toBe(true);

        // Circular: model -> config -> model
        {
            const model = new Model();
            const config = new Config(model);
            model.config = config;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.config).toBeInstanceOf(Object);
            expect(json.config!.model).toBe(undefined); // Circular reference omitted
        }

        // Non-circular: model -> config -> model2
        {
            const model = new Model();
            const model2 = new Model();
            const config = new Config(model2);
            model.config = config;
            const json = deserializeBSONWithoutOptimiser(serializeBSON<Model>(model));
            expect(json.config).toBeInstanceOf(Object);
            expect(json.config!.model).toBeInstanceOf(Object); // Not circular
        }
    });

    test('circular in array', () => {
        class User {
            id: number = 0;
            public images: Image[] = [];

            constructor(public name: string) {}
        }

        class Image {
            id: number = 0;

            constructor(
                public user: User,
                public title: string,
            ) {
                if (user.images && !user.images.includes(this)) {
                    user.images.push(this);
                }
            }
        }

        expect(ReflectionClass.from(User).hasCircularReference()).toBe(true);
        expect(ReflectionClass.from(Image).hasCircularReference()).toBe(true);

        {
            const user = new User('foo');
            const image = new Image(user, 'bar');
            {
                const json = deserializeBSONWithoutOptimiser(serializeBSON<User>(user));
                expect(json.images.length).toBe(1);
                expect(json.images[0]).toBeInstanceOf(Object);
                expect(json.images[0].title).toBe('bar');
            }

            {
                const json = deserializeBSONWithoutOptimiser(serializeBSON<Image>(image));
                expect(json.user).toBeInstanceOf(Object);
                expect(json.user.name).toBe('foo');
            }
        }

        {
            const user = new User('foo');
            const json = deserializeBSONWithoutOptimiser(serializeBSON<User>(user));
            expect(json.images.length).toBe(0);
        }
    });
});

describe('large documents', () => {
    test('large array', () => {
        type T = { v: number[] };
        const data: T = { v: Array.from({ length: 10000 }, (_, i) => i) };

        const bson = serializeBSON<T>(data);
        const back = deserializeBSON<T>(bson);
        expect(back.v.length).toBe(10000);
        expect(back.v[0]).toBe(0);
        expect(back.v[9999]).toBe(9999);
    });

    test('large string', () => {
        type T = { v: string };
        const data: T = { v: 'a'.repeat(100000) };

        const bson = serializeBSON<T>(data);
        const back = deserializeBSON<T>(bson);
        expect(back.v.length).toBe(100000);
    });

    test('deeply nested object', () => {
        interface Node {
            value: number;
            child?: Node;
        }

        // Create a chain of 100 nested objects
        let node: Node = { value: 100 };
        for (let i = 99; i >= 1; i--) {
            node = { value: i, child: node };
        }

        const bson = serializeBSON<Node>(node);
        const back = deserializeBSON<Node>(bson);

        // Verify the chain
        let current: Node | undefined = back;
        for (let i = 1; i <= 100; i++) {
            expect(current).toBeDefined();
            expect(current!.value).toBe(i);
            current = current!.child;
        }
        expect(current).toBeUndefined();
    });
});

describe('empty and minimal documents', () => {
    test('empty object', () => {
        type T = {};

        const bson = serializeBSON<T>({});
        const back = deserializeBSON<T>(bson);
        expect(back).toEqual({});
    });

    test('object with only optional fields missing', () => {
        type T = { a?: number; b?: string };

        const bson = serializeBSON<T>({});
        const back = deserializeBSON<T>(bson);
        expect(back).toEqual({});
    });
});

describe('any type', () => {
    test('any type passthrough', () => {
        // Complex data with any type
        const data = {
            lastErrorObject: { n: 1, updatedExisting: true },
            value: {
                _id: '61df83e58a5e3ba77f8f1c0f',
                id: 'bdcfb3a0-034a-4f07-8aff-b78e2822a5a8',
            },
            ok: 1,
        };

        const bson = serializeBSONWithoutOptimiser(data);
        const deserializer = getBSONDeserializer<{ value: any }>();
        const back: any = deserializer(bson);
        expect(back.value).toEqual(data.value);
    });
});

describe('literal types', () => {
    test('string literal', () => {
        type T = { status: 'active' };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ status: 'active' });
        // Use bson-js to verify serialization is correct
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.status).toBe('active');
    });

    test('number literal - int32', () => {
        type T = { code: 42 };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ code: 42 });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.code).toBe(42);
    });

    test('number literal - float', () => {
        type T = { value: 3.14 };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ value: 3.14 });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.value).toBeCloseTo(3.14);
    });

    test('boolean literal - true', () => {
        type T = { enabled: true };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ enabled: true });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.enabled).toBe(true);
    });

    test('boolean literal - false', () => {
        type T = { disabled: false };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ disabled: false });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.disabled).toBe(false);
    });

    test('bigint literal', () => {
        type T = { big: 9007199254740993n };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ big: 9007199254740993n });
        const back = bson.deserialize(buffer.slice(0, size));
        // bson-js returns Long object for int64, convert to bigint for comparison
        expect(BigInt(back.big.toString())).toBe(9007199254740993n);
    });

    test('multiple literals in object', () => {
        type T = { a: 'foo'; b: 123; c: true };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ a: 'foo', b: 123, c: true });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back).toEqual({ a: 'foo', b: 123, c: true });
    });
});

describe('tuple types', () => {
    test('simple tuple [number, string]', () => {
        type T = { pair: [number, string] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ pair: [42, 'hello'] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.pair).toEqual([42, 'hello']);
    });

    test('tuple with same types [number, number]', () => {
        type T = { coords: [number, number] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ coords: [10, 20] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.coords).toEqual([10, 20]);
    });

    test('mixed type tuple [string, number, boolean]', () => {
        type T = { mixed: [string, number, boolean] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ mixed: ['test', 123, true] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.mixed).toEqual(['test', 123, true]);
    });

    test('tuple with nested object', () => {
        type T = { data: [string, { name: string }] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ data: ['id', { name: 'test' }] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.data).toEqual(['id', { name: 'test' }]);
    });

    test('tuple with nested array', () => {
        type T = { matrix: [number, number[]] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ matrix: [1, [2, 3, 4]] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.matrix).toEqual([1, [2, 3, 4]]);
    });

    test('optional tuple elements', () => {
        type T = { opt: [string, number?] };
        const serializer = getBSONSerializer<T>();

        // With optional element present
        {
            const [buffer, size] = serializer({ opt: ['hello', 42] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.opt[0]).toBe('hello');
            expect(back.opt[1]).toBe(42);
        }

        // With optional element missing
        {
            const [buffer, size] = serializer({ opt: ['hello'] } as any);
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.opt[0]).toBe('hello');
        }
    });

    test('empty tuple', () => {
        type T = { empty: [] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ empty: [] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.empty).toEqual([]);
    });

    test('single element tuple', () => {
        type T = { single: [string] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ single: ['only'] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.single).toEqual(['only']);
    });

    test('long tuple', () => {
        type T = { long: [number, number, number, number, number, number, number, number, number, number] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ long: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.long).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test('tuple with rest elements [string, ...number[]]', () => {
        type T = { data: [string, ...number[]] };
        const serializer = getBSONSerializer<T>();

        // With rest elements
        {
            const [buffer, size] = serializer({ data: ['header', 1, 2, 3, 4, 5] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.data).toEqual(['header', 1, 2, 3, 4, 5]);
        }

        // With no rest elements (just the fixed part)
        {
            const [buffer, size] = serializer({ data: ['header'] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.data).toEqual(['header']);
        }
    });

    test('tuple with rest elements [...number[]]', () => {
        type T = { nums: [...number[]] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ nums: [1, 2, 3, 4, 5] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.nums).toEqual([1, 2, 3, 4, 5]);
    });

    test('tuple with rest in middle [string, ...number[], boolean]', () => {
        type T = { mixed: [string, ...number[], boolean] };
        const serializer = getBSONSerializer<T>();

        // With multiple rest elements
        {
            const [buffer, size] = serializer({ mixed: ['start', 1, 2, 3, true] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.mixed).toEqual(['start', 1, 2, 3, true]);
        }

        // With single rest element
        {
            const [buffer, size] = serializer({ mixed: ['start', 42, false] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.mixed).toEqual(['start', 42, false]);
        }

        // With no rest elements (just fixed parts)
        {
            const [buffer, size] = serializer({ mixed: ['start', true] });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.mixed).toEqual(['start', true]);
        }
    });

    test('tuple with multiple fixed after rest [string, ...number[], string, boolean]', () => {
        type T = { complex: [string, ...number[], string, boolean] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ complex: ['header', 1, 2, 3, 'footer', true] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.complex).toEqual(['header', 1, 2, 3, 'footer', true]);
    });

    test('tuple rest with objects [string, ...{ id: number }[]]', () => {
        type T = { items: [string, ...{ id: number }[]] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ items: ['list', { id: 1 }, { id: 2 }, { id: 3 }] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.items).toEqual(['list', { id: 1 }, { id: 2 }, { id: 3 }]);
    });
});

describe('enum types', () => {
    enum NumericEnum {
        A = 0,
        B = 1,
        C = 2,
    }

    enum StringEnum {
        Red = 'RED',
        Green = 'GREEN',
        Blue = 'BLUE',
    }

    enum MixedEnum {
        NumVal = 0,
        StrVal = 'string',
    }

    test('numeric enum', () => {
        type T = { status: NumericEnum };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ status: NumericEnum.B });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.status).toBe(NumericEnum.B);
        expect(back.status).toBe(1);
    });

    test('string enum', () => {
        type T = { color: StringEnum };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ color: StringEnum.Green });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.color).toBe(StringEnum.Green);
        expect(back.color).toBe('GREEN');
    });

    test('mixed enum - numeric value', () => {
        type T = { value: MixedEnum };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ value: MixedEnum.NumVal });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.value).toBe(MixedEnum.NumVal);
        expect(back.value).toBe(0);
    });

    test('mixed enum - string value', () => {
        type T = { value: MixedEnum };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ value: MixedEnum.StrVal });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.value).toBe(MixedEnum.StrVal);
        expect(back.value).toBe('string');
    });

    test('all numeric enum values', () => {
        type T = { status: NumericEnum };
        const serializer = getBSONSerializer<T>();

        for (const val of [NumericEnum.A, NumericEnum.B, NumericEnum.C]) {
            const [buffer, size] = serializer({ status: val });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.status).toBe(val);
        }
    });

    test('all string enum values', () => {
        type T = { color: StringEnum };
        const serializer = getBSONSerializer<T>();

        for (const val of [StringEnum.Red, StringEnum.Green, StringEnum.Blue]) {
            const [buffer, size] = serializer({ color: val });
            const back = bson.deserialize(buffer.slice(0, size));
            expect(back.color).toBe(val);
        }
    });

    test('enum in array', () => {
        type T = { colors: StringEnum[] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ colors: [StringEnum.Red, StringEnum.Blue] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.colors).toEqual([StringEnum.Red, StringEnum.Blue]);
    });

    test('const enum', () => {
        const enum ConstEnum {
            X = 100,
            Y = 200,
        }

        type T = { val: ConstEnum };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ val: ConstEnum.X });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.val).toBe(100);
    });
});

describe('combined literal, tuple, enum', () => {
    enum Status {
        Active = 'ACTIVE',
        Inactive = 'INACTIVE',
    }

    test('object with all three', () => {
        type T = {
            type: 'user';
            coords: [number, number];
            status: Status;
        };
        const serializer = getBSONSerializer<T>();

        const data: T = {
            type: 'user',
            coords: [10.5, 20.5],
            status: Status.Active,
        };

        const [buffer, size] = serializer(data);
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.type).toBe('user');
        expect(back.coords).toEqual([10.5, 20.5]);
        expect(back.status).toBe('ACTIVE');
    });

    test('tuple containing enum', () => {
        type T = { pair: [Status, number] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ pair: [Status.Inactive, 42] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.pair).toEqual(['INACTIVE', 42]);
    });

    test('tuple containing literal', () => {
        type T = { entry: ['key', number] };
        const serializer = getBSONSerializer<T>();

        const [buffer, size] = serializer({ entry: ['key', 123] });
        const back = bson.deserialize(buffer.slice(0, size));
        expect(back.entry).toEqual(['key', 123]);
    });
});

describe('special number values', () => {
    test('Infinity roundtrip', () => {
        type T = { v: number };
        const data: T = { v: Infinity };
        const bsonBuf = serializeBSON<T>(data);
        const back = deserializeBSON<T>(bsonBuf);
        expect(back.v).toBe(Infinity);
    });

    test('-Infinity roundtrip', () => {
        type T = { v: number };
        const data: T = { v: -Infinity };
        const bsonBuf = serializeBSON<T>(data);
        const back = deserializeBSON<T>(bsonBuf);
        expect(back.v).toBe(-Infinity);
    });

    test('NaN roundtrip deserializes to 0', () => {
        type T = { v: number };
        // BSON stores NaN as double, but deserializer coerces to 0
        const bsonBuf = serialize({ v: NaN });
        const back = deserializeBSON<T>(new Uint8Array(bsonBuf.buffer, bsonBuf.byteOffset, bsonBuf.byteLength));
        expect(back.v).toBe(0);
    });
});

describe('offset parameter', () => {
    test('deserializeBSON with offset', () => {
        type T = { name: string; age: number };
        const data: T = { name: 'Alice', age: 30 };

        // Serialize to get valid BSON
        const bsonBuf = serializeBSON<T>(data);

        // Embed in a larger buffer with prefix bytes
        const prefix = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);
        const combined = new Uint8Array(prefix.length + bsonBuf.length);
        combined.set(prefix, 0);
        combined.set(bsonBuf, prefix.length);

        // Deserialize with offset
        const back = deserializeBSON<T>(combined, prefix.length);
        expect(back.name).toBe('Alice');
        expect(back.age).toBe(30);
    });

    test('getBSONDeserializer with offset', () => {
        type T = { id: number };
        const deserializer = getBSONDeserializer<T>();

        const bsonBuf = serializeBSON<T>({ id: 42 });

        // Embed with 8-byte prefix
        const prefix = new Uint8Array(8);
        const combined = new Uint8Array(prefix.length + bsonBuf.length);
        combined.set(prefix, 0);
        combined.set(bsonBuf, prefix.length);

        const back = deserializer(combined, prefix.length);
        expect(back.id).toBe(42);
    });
});
