/**
 * BSON Deserialization Performance Regression Tests
 *
 * Canonical performance benchmark for the BSON deserializer.
 * Each test asserts a minimum ops/sec threshold to catch regressions.
 * All BSON buffers are pre-serialized outside the bench loop to measure deserialization only.
 *
 * Thresholds are conservative minimums (deepkit/bson-js ratio).
 * Typical ratios are 2-5x higher than these floors.
 *
 * Run standalone: node --import @deepkit/run --test tests/deserialize/perf-regression.spec.ts
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { BenchSuite } from '@deepkit/bench';
import { MongoId, UUID, float64, int32 } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../../index.js';

function assertRatio(name: string, deepkitOps: number, bsonJsOps: number, minRatio: number) {
    const ratio = deepkitOps / bsonJsOps;
    console.log(`${name.padEnd(30)} ${(deepkitOps / 1e6).toFixed(1).padStart(7)}M ops/sec  ${ratio.toFixed(1).padStart(6)}x vs bson-js`);
    if (ratio < minRatio) {
        throw new Error(`${name}: ratio ${ratio.toFixed(1)}x is below minimum ${minRatio}x (deepkit: ${(deepkitOps / 1e6).toFixed(1)}M, bson-js: ${(bsonJsOps / 1e6).toFixed(1)}M)`);
    }
}

/** Serialize with deepkit and return the Uint8Array buffer. */
function bsonBuffer<T>(serialize: (data: T) => [Uint8Array, number], data: T): Uint8Array {
    const [buf, size] = serialize(data);
    return buf.slice(0, size);
}

describe('Deserialization Performance Regression', () => {
    describe('Primitive types (single field)', () => {
        test('int32', () => {
            interface Doc {
                n: int32;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { n: 42 });

            const suite = new BenchSuite('int32');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('int32 (1 field)', results['deepkit'].hz, results['bson-js'].hz, 10);
        });

        test('float64', () => {
            interface Doc {
                n: float64;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { n: 3.14 });

            const suite = new BenchSuite('float64');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('float64 (1 field)', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('plain number (runtime check)', () => {
            interface Doc {
                n: number;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { n: 42 });

            const suite = new BenchSuite('number');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('number (1 field)', results['deepkit'].hz, results['bson-js'].hz, 1);
        });

        test('string (short)', () => {
            interface Doc {
                s: string;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { s: 'hello' });

            const suite = new BenchSuite('string');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('string short (1 field)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });

        test('boolean', () => {
            interface Doc {
                b: boolean;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { b: true });

            const suite = new BenchSuite('boolean');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('boolean (1 field)', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });

        test('Date', () => {
            interface Doc {
                d: Date;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { d: new Date() });

            const suite = new BenchSuite('Date');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('Date (1 field)', results['deepkit'].hz, results['bson-js'].hz, 5);
        });

        test('MongoId', () => {
            interface Doc {
                id: MongoId;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { id: '507f1f77bcf86cd799439011' });

            const suite = new BenchSuite('MongoId');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('MongoId (1 field)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });

        test('UUID', () => {
            interface Doc {
                id: UUID;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { id: '550e8400-e29b-41d4-a716-446655440000' });

            const suite = new BenchSuite('UUID');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('UUID (1 field)', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });
    });

    describe('Multi-field documents', () => {
        test('int32 x3', () => {
            interface Doc {
                a: int32;
                b: int32;
                c: int32;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { a: 1, b: 2, c: 3 });

            const suite = new BenchSuite('int32 x3');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('int32 x3', results['deepkit'].hz, results['bson-js'].hz, 5);
        });

        test('number x3 (runtime check)', () => {
            interface Doc {
                a: number;
                b: number;
                c: number;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { a: 1, b: 2, c: 3 });

            const suite = new BenchSuite('number x3');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('number x3 (runtime)', results['deepkit'].hz, results['bson-js'].hz, 5);
        });

        test('mixed no-string (3 fields)', () => {
            interface Doc {
                a: int32;
                b: float64;
                c: boolean;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { a: 1, b: 2.5, c: true });

            const suite = new BenchSuite('mixed x3');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('mixed no-string x3', results['deepkit'].hz, results['bson-js'].hz, 3);
        });
    });

    describe('Real-world documents', () => {
        test('user profile (6 fields)', () => {
            interface User {
                _id: MongoId;
                name: string;
                age: int32;
                score: float64;
                active: boolean;
                created: Date;
            }
            const d = getBSONDeserializer<User>();
            const data = {
                _id: '507f1f77bcf86cd799439011',
                name: 'Test User',
                age: 30,
                score: 98.5,
                active: true,
                created: new Date('2024-01-15T10:30:00.000Z'),
            };
            const buf = bsonBuffer(getBSONSerializer<User>(), data);
            const bsonData = { ...data, _id: new bson.ObjectId(data._id) };
            const bsonJsBuf = bson.serialize(bsonData);

            const suite = new BenchSuite('user profile');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('user profile (6 fields)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });

        test('sensor reading (4 fields, all numeric)', () => {
            interface SensorReading {
                sensorId: int32;
                temperature: float64;
                humidity: float64;
                pressure: float64;
            }
            const d = getBSONDeserializer<SensorReading>();
            const buf = bsonBuffer(getBSONSerializer<SensorReading>(), {
                sensorId: 42,
                temperature: 23.5,
                humidity: 65.2,
                pressure: 1013.25,
            });

            const suite = new BenchSuite('sensor');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('sensor (4 numeric)', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('API response metadata (3 fields, strings)', () => {
            interface Meta {
                requestId: string;
                version: string;
                region: string;
            }
            const d = getBSONDeserializer<Meta>();
            const buf = bsonBuffer(getBSONSerializer<Meta>(), {
                requestId: 'req-abc123',
                version: '2.1.0',
                region: 'us-east-1',
            });

            const suite = new BenchSuite('API meta');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('API meta (3 strings)', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });

        test('minimal document (_id only)', () => {
            interface Doc {
                _id: MongoId;
            }
            const d = getBSONDeserializer<Doc>();
            const buf = bsonBuffer(getBSONSerializer<Doc>(), { _id: '507f1f77bcf86cd799439011' });

            const suite = new BenchSuite('minimal');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(buf));
            const results = suite.run({ verbose: false });

            assertRatio('minimal (_id only)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });
    });

    describe('Union types', () => {
        test('nullable union — number | null (nested)', () => {
            interface Doc {
                v: number | null;
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const bufNum = bsonBuffer(s, { v: 42 });
            const bufNull = bsonBuffer(s, { v: null });

            const suite = new BenchSuite('nullable deser');
            suite.add('deepkit num', () => d(bufNum));
            suite.add('deepkit null', () => d(bufNull));
            suite.add('bson-js', () => bson.deserialize(bufNum));
            const results = suite.run({ verbose: false });

            assertRatio('nullable num', results['deepkit num'].hz, results['bson-js'].hz, 1);
            assertRatio('nullable null', results['deepkit null'].hz, results['bson-js'].hz, 1);
        });

        test('overlapping nested union — { a } | { a, b }', () => {
            type Inner = { a: number } | { a: number; b: string };
            interface Doc {
                v: Inner;
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const bufNarrow = bsonBuffer(s, { v: { a: 1 } });
            const bufWide = bsonBuffer(s, { v: { a: 1, b: 'hello' } });

            const suite = new BenchSuite('overlap union deser');
            suite.add('deepkit narrow', () => d(bufNarrow));
            suite.add('deepkit wide', () => d(bufWide));
            suite.add('bson-js', () => bson.deserialize(bufWide));
            const results = suite.run({ verbose: false });

            assertRatio('overlap narrow', results['deepkit narrow'].hz, results['bson-js'].hz, 1);
            assertRatio('overlap wide', results['deepkit wide'].hz, results['bson-js'].hz, 1);
        });

        test('discriminated nested union', () => {
            type Shape = { kind: 'a'; x: number } | { kind: 'b'; y: string };
            interface Doc {
                shape: Shape;
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const bufA = bsonBuffer(s, { shape: { kind: 'a', x: 42 } });
            const bufB = bsonBuffer(s, { shape: { kind: 'b', y: 'hello' } });

            const suite = new BenchSuite('disc union deser');
            suite.add('deepkit A', () => d(bufA));
            suite.add('deepkit B', () => d(bufB));
            suite.add('bson-js', () => bson.deserialize(bufA));
            const results = suite.run({ verbose: false });

            assertRatio('disc union A', results['deepkit A'].hz, results['bson-js'].hz, 1);
            assertRatio('disc union B', results['deepkit B'].hz, results['bson-js'].hz, 1);
        });

        test('3-member discriminated union', () => {
            type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number } | { kind: 'triangle'; base: number; height: number };
            interface Doc {
                shape: Shape;
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const bufCircle = bsonBuffer(s, { shape: { kind: 'circle', radius: 5 } });
            const bufSquare = bsonBuffer(s, { shape: { kind: 'square', side: 3 } });

            const suite = new BenchSuite('3-member disc deser');
            suite.add('deepkit circle', () => d(bufCircle));
            suite.add('deepkit square', () => d(bufSquare));
            suite.add('bson-js', () => bson.deserialize(bufCircle));
            const results = suite.run({ verbose: false });

            assertRatio('3-disc circle', results['deepkit circle'].hz, results['bson-js'].hz, 1);
            assertRatio('3-disc square', results['deepkit square'].hz, results['bson-js'].hz, 1);
        });
    });

    describe('Array types', () => {
        test('sensor array (10 items, all numeric, cursor response)', () => {
            interface SensorReading {
                sensorId: int32;
                temperature: float64;
                humidity: float64;
                pressure: float64;
            }
            interface Response {
                cursor: { firstBatch: SensorReading[] };
            }
            const s = getBSONSerializer<Response>();
            const d = getBSONDeserializer<Response>();
            const items: SensorReading[] = [];
            for (let i = 0; i < 10; i++) items.push({ sensorId: i, temperature: 23.5 + i, humidity: 65.2 - i, pressure: 1013.25 });
            const data: Response = { cursor: { firstBatch: items } };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('sensor arr 10 deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('sensor[] 10 cursor', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('sensor array (1000 items, all numeric, cursor response)', () => {
            interface SensorReading {
                sensorId: int32;
                temperature: float64;
                humidity: float64;
                pressure: float64;
            }
            interface Response {
                cursor: { firstBatch: SensorReading[] };
            }
            const s = getBSONSerializer<Response>();
            const d = getBSONDeserializer<Response>();
            const items: SensorReading[] = [];
            for (let i = 0; i < 1000; i++) items.push({ sensorId: i, temperature: 23.5 + i, humidity: 65.2 - i, pressure: 1013.25 });
            const data: Response = { cursor: { firstBatch: items } };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('sensor arr 1000 deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('sensor[] 1000 cursor', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('mixed items with string[] (10 items, cursor response)', () => {
            interface Item {
                id: number;
                name: string;
                ready: boolean;
                priority: number;
                tags: string[];
            }
            interface Response {
                cursor: { firstBatch: Item[] };
            }
            const s = getBSONSerializer<Response>();
            const d = getBSONDeserializer<Response>();
            const items: Item[] = [];
            for (let i = 0; i < 10; i++) items.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
            const data: Response = { cursor: { firstBatch: items } };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('mixed arr 10 deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('mixed[] 10 cursor', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('mixed items with string[] (1000 items, cursor response)', () => {
            interface Item {
                id: number;
                name: string;
                ready: boolean;
                priority: number;
                tags: string[];
            }
            interface Response {
                cursor: { firstBatch: Item[] };
            }
            const s = getBSONSerializer<Response>();
            const d = getBSONDeserializer<Response>();
            const items: Item[] = [];
            for (let i = 0; i < 1000; i++) items.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
            const data: Response = { cursor: { firstBatch: items } };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('mixed arr 1000 deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('mixed[] 1000 cursor', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('string array (100 items)', () => {
            interface Doc {
                tags: string[];
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const data: Doc = { tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`) };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('string array deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('string[] 100', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });

        test('number array (100 items)', () => {
            interface Doc {
                values: number[];
            }
            const s = getBSONSerializer<Doc>();
            const d = getBSONDeserializer<Doc>();
            const data: Doc = { values: Array.from({ length: 100 }, (_, i) => i * 1.5) };
            const buf = bsonBuffer(s, data);
            const bsonJsBuf = bson.serialize(data);

            const suite = new BenchSuite('number array deser');
            suite.add('deepkit', () => d(buf));
            suite.add('bson-js', () => bson.deserialize(bsonJsBuf));
            const results = suite.run({ verbose: false });

            assertRatio('number[] 100', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });
    });
});
