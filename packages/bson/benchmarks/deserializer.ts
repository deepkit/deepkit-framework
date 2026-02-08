/**
 * BSON Deserializer Benchmarks
 *
 * Uses the same shapes as tests/serialize/perf-regression.spec.ts
 *
 * Run with: cd packages/bson && node --import @deepkit/run benchmarks/deserializer.ts
 */
import { BenchSuite } from '@deepkit/bench';
import { MongoId, UUID, float64, int32 } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../index.js';

// ============================================================================
// Primitive types (single field)
// ============================================================================

interface DocInt32 {
    n: int32;
}

interface DocFloat64 {
    n: float64;
}

interface DocNumber {
    n: number;
}

interface DocString {
    s: string;
}

interface DocBoolean {
    b: boolean;
}

interface DocMongoId {
    id: MongoId;
}

interface DocUUID {
    id: UUID;
}

// ============================================================================
// Multi-field documents
// ============================================================================

interface DocInt32x3 {
    a: int32;
    b: int32;
    c: int32;
}

interface DocNumberx3 {
    a: number;
    b: number;
    c: number;
}

interface DocMixed {
    a: int32;
    b: float64;
    c: boolean;
}

// ============================================================================
// Real-world documents
// ============================================================================

interface SensorReading {
    sensorId: int32;
    temperature: float64;
    humidity: float64;
    pressure: float64;
}

interface ApiMeta {
    requestId: string;
    version: string;
    region: string;
}

interface MinimalDoc {
    _id: MongoId;
}

// ============================================================================
// Benchmark
// ============================================================================

export default async function () {
    const suite = new BenchSuite('bson/deserializer');

    // Primitive types
    const [bsonInt32] = getBSONSerializer<DocInt32>()({ n: 42 });
    const [bsonFloat64] = getBSONSerializer<DocFloat64>()({ n: 3.14 });
    const [bsonNumber] = getBSONSerializer<DocNumber>()({ n: 42 });
    const [bsonString] = getBSONSerializer<DocString>()({ s: 'hello' });
    const [bsonBoolean] = getBSONSerializer<DocBoolean>()({ b: true });
    const [bsonMongoId] = getBSONSerializer<DocMongoId>()({ id: '507f1f77bcf86cd799439011' });
    const [bsonUUID] = getBSONSerializer<DocUUID>()({ id: '550e8400-e29b-41d4-a716-446655440000' });
    // Multi-field
    const [bsonInt32x3] = getBSONSerializer<DocInt32x3>()({ a: 1, b: 2, c: 3 });
    const [bsonNumberx3] = getBSONSerializer<DocNumberx3>()({ a: 1, b: 2, c: 3 });
    const [bsonMixed] = getBSONSerializer<DocMixed>()({ a: 1, b: 2.5, c: true });

    // Real-world
    const [bsonSensor] = getBSONSerializer<SensorReading>()({
        sensorId: 42,
        temperature: 23.5,
        humidity: 65.2,
        pressure: 1013.25,
    });
    const [bsonApiMeta] = getBSONSerializer<ApiMeta>()({
        requestId: 'req-abc123',
        version: '2.1.0',
        region: 'us-east-1',
    });
    const [bsonMinimal] = getBSONSerializer<MinimalDoc>()({ _id: '507f1f77bcf86cd799439011' });

    // Deserializers
    const dInt32 = getBSONDeserializer<DocInt32>();
    const dFloat64 = getBSONDeserializer<DocFloat64>();
    const dNumber = getBSONDeserializer<DocNumber>();
    const dString = getBSONDeserializer<DocString>();
    const dBoolean = getBSONDeserializer<DocBoolean>();
    const dMongoId = getBSONDeserializer<DocMongoId>();
    const dUUID = getBSONDeserializer<DocUUID>();
    const dInt32x3 = getBSONDeserializer<DocInt32x3>();
    const dNumberx3 = getBSONDeserializer<DocNumberx3>();
    const dMixed = getBSONDeserializer<DocMixed>();
    const dSensor = getBSONDeserializer<SensorReading>();
    const dApiMeta = getBSONDeserializer<ApiMeta>();
    const dMinimal = getBSONDeserializer<MinimalDoc>();

    // Primitive types
    suite.add('int32 (1 field)', () => dInt32(bsonInt32));
    suite.add('float64 (1 field)', () => dFloat64(bsonFloat64));
    suite.add('number (1 field)', () => dNumber(bsonNumber));
    suite.add('string short (1 field)', () => dString(bsonString));
    suite.add('boolean (1 field)', () => dBoolean(bsonBoolean));
    suite.add('MongoId (1 field)', () => dMongoId(bsonMongoId));
    suite.add('UUID (1 field)', () => dUUID(bsonUUID));
    // Multi-field
    suite.add('int32 x3', () => dInt32x3(bsonInt32x3));
    suite.add('number x3', () => dNumberx3(bsonNumberx3));
    suite.add('mixed no-string x3', () => dMixed(bsonMixed));

    // Real-world
    suite.add('sensor (4 numeric)', () => dSensor(bsonSensor));
    suite.add('API meta (3 strings)', () => dApiMeta(bsonApiMeta));
    suite.add('minimal (_id only)', () => dMinimal(bsonMinimal));

    return suite;
}

// Run if executed directly
const fn = exports.default;
fn().then((suite: BenchSuite) => suite.run());
