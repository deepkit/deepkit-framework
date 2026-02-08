/**
 * feat/next BSON benchmark — uses @deepkit/bench BenchSuite API.
 *
 * Run: cd /Users/marc/bude/deepkit-framework && node --expose-gc --import @deepkit/run packages/bson/benchmarks/compare-bench.ts
 */
import { BenchSuite } from '@deepkit/bench';
import { MongoId, UUID, float64, int32 } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../index.js';

// ============================================================================
// Types
// ============================================================================

interface DocInt32 {
    n: int32;
}
interface DocFloat64 {
    n: float64;
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

interface DocInt32x3 {
    a: int32;
    b: int32;
    c: int32;
}
interface DocMixed {
    a: int32;
    b: float64;
    c: boolean;
}

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

// Sink to prevent V8 dead-code elimination
let sink: any;

const suite = new BenchSuite('bson/compare');

// Serializers
const sInt32 = getBSONSerializer<DocInt32>();
const sFloat64 = getBSONSerializer<DocFloat64>();
const sString = getBSONSerializer<DocString>();
const sBoolean = getBSONSerializer<DocBoolean>();
const sMongoId = getBSONSerializer<DocMongoId>();
const sUUID = getBSONSerializer<DocUUID>();
const sInt32x3 = getBSONSerializer<DocInt32x3>();
const sMixed = getBSONSerializer<DocMixed>();
const sSensor = getBSONSerializer<SensorReading>();
const sApiMeta = getBSONSerializer<ApiMeta>();
const sMinimal = getBSONSerializer<MinimalDoc>();

suite.add('serialize int32', () => {
    sink = sInt32({ n: 42 });
});
suite.add('serialize float64', () => {
    sink = sFloat64({ n: 3.14 });
});
suite.add('serialize string', () => {
    sink = sString({ s: 'hello' });
});
suite.add('serialize boolean', () => {
    sink = sBoolean({ b: true });
});
suite.add('serialize MongoId', () => {
    sink = sMongoId({ id: '507f1f77bcf86cd799439011' });
});
suite.add('serialize UUID', () => {
    sink = sUUID({ id: '550e8400-e29b-41d4-a716-446655440000' });
});
suite.add('serialize int32x3', () => {
    sink = sInt32x3({ a: 1, b: 2, c: 3 });
});
suite.add('serialize mixed', () => {
    sink = sMixed({ a: 1, b: 2.5, c: true });
});
suite.add('serialize sensor', () => {
    sink = sSensor({ sensorId: 42, temperature: 23.5, humidity: 65.2, pressure: 1013.25 });
});
suite.add('serialize apiMeta', () => {
    sink = sApiMeta({ requestId: 'req-abc123', version: '2.1.0', region: 'us-east-1' });
});
suite.add('serialize minimal', () => {
    sink = sMinimal({ _id: '507f1f77bcf86cd799439011' });
});

// Deserializers — must copy buffers because getBSONSerializer reuses a shared buffer
function copyBson(fn: Function, data: any): Uint8Array {
    const [buf, size] = fn(data);
    return buf.slice(0, size);
}
const bsonInt32 = copyBson(sInt32, { n: 42 });
const bsonFloat64 = copyBson(sFloat64, { n: 3.14 });
const bsonString = copyBson(sString, { s: 'hello' });
const bsonBoolean = copyBson(sBoolean, { b: true });
const bsonMongoId = copyBson(sMongoId, { id: '507f1f77bcf86cd799439011' });
const bsonUUID = copyBson(sUUID, { id: '550e8400-e29b-41d4-a716-446655440000' });
const bsonInt32x3 = copyBson(sInt32x3, { a: 1, b: 2, c: 3 });
const bsonMixed = copyBson(sMixed, { a: 1, b: 2.5, c: true });
const bsonSensor = copyBson(sSensor, { sensorId: 42, temperature: 23.5, humidity: 65.2, pressure: 1013.25 });
const bsonApiMeta = copyBson(sApiMeta, { requestId: 'req-abc123', version: '2.1.0', region: 'us-east-1' });
const bsonMinimal = copyBson(sMinimal, { _id: '507f1f77bcf86cd799439011' });

const dInt32 = getBSONDeserializer<DocInt32>();
const dFloat64 = getBSONDeserializer<DocFloat64>();
const dString = getBSONDeserializer<DocString>();
const dBoolean = getBSONDeserializer<DocBoolean>();
const dMongoId = getBSONDeserializer<DocMongoId>();
const dUUID = getBSONDeserializer<DocUUID>();
const dInt32x3 = getBSONDeserializer<DocInt32x3>();
const dMixed = getBSONDeserializer<DocMixed>();
const dSensor = getBSONDeserializer<SensorReading>();
const dApiMeta = getBSONDeserializer<ApiMeta>();
const dMinimal = getBSONDeserializer<MinimalDoc>();

suite.add('deserialize int32', () => {
    sink = dInt32(bsonInt32);
});
suite.add('deserialize float64', () => {
    sink = dFloat64(bsonFloat64);
});
suite.add('deserialize string', () => {
    sink = dString(bsonString);
});
suite.add('deserialize boolean', () => {
    sink = dBoolean(bsonBoolean);
});
suite.add('deserialize MongoId', () => {
    sink = dMongoId(bsonMongoId);
});
suite.add('deserialize UUID', () => {
    sink = dUUID(bsonUUID);
});
suite.add('deserialize int32x3', () => {
    sink = dInt32x3(bsonInt32x3);
});
suite.add('deserialize mixed', () => {
    sink = dMixed(bsonMixed);
});
suite.add('deserialize sensor', () => {
    sink = dSensor(bsonSensor);
});
suite.add('deserialize apiMeta', () => {
    sink = dApiMeta(bsonApiMeta);
});
suite.add('deserialize minimal', () => {
    sink = dMinimal(bsonMinimal);
});

suite.run();
