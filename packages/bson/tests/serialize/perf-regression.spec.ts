/**
 * BSON Serialization Performance Regression Tests
 *
 * Canonical performance benchmark for the BSON serializer.
 * Each test asserts a minimum ops/sec threshold to catch regressions.
 * All data is pre-allocated outside the bench loop to measure serialization only.
 *
 * Thresholds are conservative minimums (deepkit/bson-js ratio).
 * Typical ratios are 2-10x higher than these floors.
 *
 * Run standalone: node --import @deepkit/run --test tests/serialize/perf-regression.spec.ts
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { BenchSuite } from '@deepkit/bench';
import { expect } from '@deepkit/run/expect';
import { MongoId, UUID, float64, int32 } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';

function assertRatio(name: string, deepkitOps: number, bsonJsOps: number, minRatio: number) {
    const ratio = deepkitOps / bsonJsOps;
    console.log(`${name.padEnd(30)} ${(deepkitOps / 1e6).toFixed(1).padStart(7)}M ops/sec  ${ratio.toFixed(0).padStart(4)}x vs bson-js`);
    if (ratio < minRatio) {
        throw new Error(`${name}: ratio ${ratio.toFixed(0)}x is below minimum ${minRatio}x (deepkit: ${(deepkitOps / 1e6).toFixed(1)}M, bson-js: ${(bsonJsOps / 1e6).toFixed(1)}M)`);
    }
}

describe('Performance Regression', () => {
    describe('Primitive types (single field)', () => {
        test('int32', () => {
            interface Doc {
                n: int32;
            }
            const s = getBSONSerializer<Doc>();
            const data = { n: 42 };

            const suite = new BenchSuite('int32');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('int32 (1 field)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('float64', () => {
            interface Doc {
                n: float64;
            }
            const s = getBSONSerializer<Doc>();
            const data = { n: 3.14 };

            const suite = new BenchSuite('float64');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('float64 (1 field)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('plain number (runtime check)', () => {
            interface Doc {
                n: number;
            }
            const s = getBSONSerializer<Doc>();
            const data = { n: 42 };

            const suite = new BenchSuite('number');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('number (1 field)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('string (short)', () => {
            interface Doc {
                s: string;
            }
            const s = getBSONSerializer<Doc>();
            const data = { s: 'hello' };

            const suite = new BenchSuite('string');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('string short (1 field)', results['deepkit'].hz, results['bson-js'].hz, 10);
        });

        test('boolean', () => {
            interface Doc {
                b: boolean;
            }
            const s = getBSONSerializer<Doc>();
            const data = { b: true };

            const suite = new BenchSuite('boolean');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('boolean (1 field)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('Date', () => {
            interface Doc {
                d: Date;
            }
            const s = getBSONSerializer<Doc>();
            const data = { d: new Date() };

            const suite = new BenchSuite('Date');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('Date (1 field)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('MongoId', () => {
            interface Doc {
                id: MongoId;
            }
            const s = getBSONSerializer<Doc>();
            const data = { id: '507f1f77bcf86cd799439011' };
            const bsonData = { id: new bson.ObjectId('507f1f77bcf86cd799439011') };

            const suite = new BenchSuite('MongoId');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(bsonData));
            const results = suite.run({ verbose: false });

            assertRatio('MongoId (1 field)', results['deepkit'].hz, results['bson-js'].hz, 5);
        });

        test('UUID', () => {
            interface Doc {
                id: UUID;
            }
            const s = getBSONSerializer<Doc>();
            const data = { id: '550e8400-e29b-41d4-a716-446655440000' };
            const bsonData = { id: new bson.UUID('550e8400-e29b-41d4-a716-446655440000') };

            const suite = new BenchSuite('UUID');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(bsonData));
            const results = suite.run({ verbose: false });

            assertRatio('UUID (1 field)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });

        test('Uint8Array (small, pre-allocated)', () => {
            interface Doc {
                b: Uint8Array;
            }
            const s = getBSONSerializer<Doc>();
            const data = { b: new Uint8Array([1, 2, 3, 4, 5]) };

            const suite = new BenchSuite('Uint8Array');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('Uint8Array 5B (1 field)', results['deepkit'].hz, results['bson-js'].hz, 10);
        });
    });

    describe('Multi-field documents', () => {
        test('int32 x3 (fast path)', () => {
            interface Doc {
                a: int32;
                b: int32;
                c: int32;
            }
            const s = getBSONSerializer<Doc>();
            const data = { a: 1, b: 2, c: 3 };

            const suite = new BenchSuite('int32 x3');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('int32 x3', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('number x3 (runtime check)', () => {
            interface Doc {
                a: number;
                b: number;
                c: number;
            }
            const s = getBSONSerializer<Doc>();
            const data = { a: 1, b: 2, c: 3 };

            const suite = new BenchSuite('number x3');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('number x3 (runtime)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('mixed no-string (3 fields)', () => {
            interface Doc {
                a: int32;
                b: float64;
                c: boolean;
            }
            const s = getBSONSerializer<Doc>();
            const data = { a: 1, b: 2.5, c: true };

            const suite = new BenchSuite('mixed x3');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('mixed no-string x3', results['deepkit'].hz, results['bson-js'].hz, 50);
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
            const s = getBSONSerializer<User>();
            const data: User = {
                _id: '507f1f77bcf86cd799439011',
                name: 'Test User',
                age: 30,
                score: 98.5,
                active: true,
                created: new Date('2024-01-15T10:30:00.000Z'),
            };
            const bsonData = { ...data, _id: new bson.ObjectId(data._id) };

            const suite = new BenchSuite('user profile');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(bsonData));
            const results = suite.run({ verbose: false });

            assertRatio('user profile (6 fields)', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('log entry (5 fields)', () => {
            interface LogEntry {
                timestamp: Date;
                level: int32;
                message: string;
                service: string;
                requestId: UUID;
            }
            const s = getBSONSerializer<LogEntry>();
            const data: LogEntry = {
                timestamp: new Date(),
                level: 3,
                message: 'User logged in successfully',
                service: 'auth-service',
                requestId: '550e8400-e29b-41d4-a716-446655440000',
            };
            const bsonData = { ...data, requestId: new bson.UUID(data.requestId) };

            const suite = new BenchSuite('log entry');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(bsonData));
            const results = suite.run({ verbose: false });

            assertRatio('log entry (5 fields)', results['deepkit'].hz, results['bson-js'].hz, 2);
        });

        test('sensor reading (4 fields, all numeric)', () => {
            interface SensorReading {
                sensorId: int32;
                temperature: float64;
                humidity: float64;
                pressure: float64;
            }
            const s = getBSONSerializer<SensorReading>();
            const data: SensorReading = {
                sensorId: 42,
                temperature: 23.5,
                humidity: 65.2,
                pressure: 1013.25,
            };

            const suite = new BenchSuite('sensor');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('sensor (4 numeric)', results['deepkit'].hz, results['bson-js'].hz, 50);
        });

        test('API response metadata (3 fields, strings)', () => {
            interface Meta {
                requestId: string;
                version: string;
                region: string;
            }
            const s = getBSONSerializer<Meta>();
            const data: Meta = {
                requestId: 'req-abc123',
                version: '2.1.0',
                region: 'us-east-1',
            };

            const suite = new BenchSuite('API meta');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('API meta (3 strings)', results['deepkit'].hz, results['bson-js'].hz, 3);
        });

        test('minimal document (_id only)', () => {
            interface Doc {
                _id: MongoId;
            }
            const s = getBSONSerializer<Doc>();
            const data = { _id: '507f1f77bcf86cd799439011' };
            const bsonData = { _id: new bson.ObjectId('507f1f77bcf86cd799439011') };

            const suite = new BenchSuite('minimal');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(bsonData));
            const results = suite.run({ verbose: false });

            assertRatio('minimal (_id only)', results['deepkit'].hz, results['bson-js'].hz, 5);
        });
    });

    describe('Union types', () => {
        test('overlapping object union — { a } | { a, b }', () => {
            type T = { a: number } | { a: number; b: string };
            const s = getBSONSerializer<T>();
            const narrow: T = { a: 1 };
            const wide: T = { a: 1, b: 'hello' };

            const suite = new BenchSuite('overlapping union');
            suite.add('deepkit narrow', () => s(narrow));
            suite.add('deepkit wide', () => s(wide));
            suite.add('bson-js', () => bson.serialize(wide));
            const results = suite.run({ verbose: false });

            assertRatio('union narrow', results['deepkit narrow'].hz, results['bson-js'].hz, 3);
            assertRatio('union wide', results['deepkit wide'].hz, results['bson-js'].hz, 3);
        });

        test('overlapping object union — reversed { a, b } | { a }', () => {
            type T = { a: number; b: string } | { a: number };
            const s = getBSONSerializer<T>();
            const narrow: T = { a: 1 };
            const wide: T = { a: 1, b: 'hello' };

            const suite = new BenchSuite('overlapping rev');
            suite.add('deepkit narrow', () => s(narrow));
            suite.add('deepkit wide', () => s(wide));
            suite.add('bson-js', () => bson.serialize(wide));
            const results = suite.run({ verbose: false });

            assertRatio('union rev narrow', results['deepkit narrow'].hz, results['bson-js'].hz, 3);
            assertRatio('union rev wide', results['deepkit wide'].hz, results['bson-js'].hz, 3);
        });

        test('discriminated union', () => {
            type T = { kind: 'a'; x: number } | { kind: 'b'; y: string };
            const s = getBSONSerializer<T>();
            const dataA: T = { kind: 'a', x: 42 };
            const dataB: T = { kind: 'b', y: 'hello' };

            const suite = new BenchSuite('discriminated');
            suite.add('deepkit A', () => s(dataA));
            suite.add('deepkit B', () => s(dataB));
            suite.add('bson-js', () => bson.serialize(dataA));
            const results = suite.run({ verbose: false });

            assertRatio('disc A', results['deepkit A'].hz, results['bson-js'].hz, 3);
            assertRatio('disc B', results['deepkit B'].hz, results['bson-js'].hz, 3);
        });

        test('simple nullable union (number | null)', () => {
            type T = { v: number | null };
            const s = getBSONSerializer<T>();
            const num: T = { v: 42 };
            const nil: T = { v: null };

            const suite = new BenchSuite('nullable');
            suite.add('deepkit num', () => s(num));
            suite.add('deepkit null', () => s(nil));
            suite.add('bson-js', () => bson.serialize(num));
            const results = suite.run({ verbose: false });

            assertRatio('nullable num', results['deepkit num'].hz, results['bson-js'].hz, 10);
            assertRatio('nullable null', results['deepkit null'].hz, results['bson-js'].hz, 10);
        });

        test('enum union (Status | number)', () => {
            enum Status {
                Active = 'active',
                Inactive = 'inactive',
            }
            type T = { v: Status | number };
            const s = getBSONSerializer<T>();
            const dataEnum: T = { v: Status.Active };
            const dataNum: T = { v: 42 };

            const suite = new BenchSuite('enum union');
            suite.add('deepkit enum', () => s(dataEnum));
            suite.add('deepkit num', () => s(dataNum));
            suite.add('bson-js', () => bson.serialize(dataEnum));
            const results = suite.run({ verbose: false });

            assertRatio('enum str', results['deepkit enum'].hz, results['bson-js'].hz, 3);
            assertRatio('enum num', results['deepkit num'].hz, results['bson-js'].hz, 3);
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
            const items: SensorReading[] = [];
            for (let i = 0; i < 10; i++) items.push({ sensorId: i, temperature: 23.5 + i, humidity: 65.2 - i, pressure: 1013.25 });
            const data: Response = { cursor: { firstBatch: items } };

            const suite = new BenchSuite('sensor arr 10');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('sensor[] 10 cursor', results['deepkit'].hz, results['bson-js'].hz, 20);
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
            const items: SensorReading[] = [];
            for (let i = 0; i < 1000; i++) items.push({ sensorId: i, temperature: 23.5 + i, humidity: 65.2 - i, pressure: 1013.25 });
            const data: Response = { cursor: { firstBatch: items } };

            const suite = new BenchSuite('sensor arr 1000');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('sensor[] 1000 cursor', results['deepkit'].hz, results['bson-js'].hz, 20);
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
            const items: Item[] = [];
            for (let i = 0; i < 10; i++) items.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
            const data: Response = { cursor: { firstBatch: items } };

            const suite = new BenchSuite('mixed arr 10');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('mixed[] 10 cursor', results['deepkit'].hz, results['bson-js'].hz, 5);
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
            const items: Item[] = [];
            for (let i = 0; i < 1000; i++) items.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
            const data: Response = { cursor: { firstBatch: items } };

            const suite = new BenchSuite('mixed arr 1000');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('mixed[] 1000 cursor', results['deepkit'].hz, results['bson-js'].hz, 5);
        });

        test('string array (100 items)', () => {
            interface Doc {
                tags: string[];
            }
            const s = getBSONSerializer<Doc>();
            const data: Doc = { tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`) };

            const suite = new BenchSuite('string array');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('string[] 100', results['deepkit'].hz, results['bson-js'].hz, 1.5);
        });

        test('number array (100 items)', () => {
            interface Doc {
                values: number[];
            }
            const s = getBSONSerializer<Doc>();
            const data: Doc = { values: Array.from({ length: 100 }, (_, i) => i * 1.5) };

            const suite = new BenchSuite('number array');
            suite.add('deepkit', () => s(data));
            suite.add('bson-js', () => bson.serialize(data));
            const results = suite.run({ verbose: false });

            assertRatio('number[] 100', results['deepkit'].hz, results['bson-js'].hz, 3);
        });
    });
});
