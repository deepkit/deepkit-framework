/**
 * @deepkit/type Serialization Performance Regression Tests
 *
 * Canonical performance benchmark for the type serializer (JSON <-> runtime).
 * Uses pre-resolved serialize/deserialize functions to measure actual JIT performance.
 * Separate section tracks convenience API (deserialize<T>) overhead.
 *
 * Run standalone: cd packages/type && node --import @deepkit/run --test tests/perf-regression-serialization.spec.ts
 */
import { describe, test } from 'node:test';

import { BenchSuite } from '@deepkit/bench';

import { deserialize, getSerializeFunction, getValidatorFunction, serialize, serializer } from '../index.js';
import { typeOf } from '../src/reflection/reflection.js';

function assertMinOps(name: string, ops: number, minOps: number) {
    const mOps = ops / 1e6;
    const mMin = minOps / 1e6;
    console.log(`${name.padEnd(40)} ${mOps.toFixed(2).padStart(8)}M ops/sec  (min: ${mMin.toFixed(2)}M)`);
    if (ops < minOps) {
        throw new Error(`${name}: ${mOps.toFixed(2)}M ops/sec is below minimum ${mMin.toFixed(2)}M`);
    }
}

// ============================================================================
// Test Models
// ============================================================================

class SmallModel {
    ready?: boolean;
    tags: string[] = [];
    priority: number = 0;

    constructor(
        public id: number,
        public name: string,
    ) {}
}

class SubModel {
    age?: number;
    constructor(public label: string) {}
}

enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

class MediumModel {
    type: number = 0;
    yesNo: boolean = false;
    plan: Plan = Plan.DEFAULT;
    created: Date = new Date();
    types: string[] = [];
    children: SubModel[] = [];
    childrenMap: { [key: string]: SubModel } = {};

    constructor(public name: string) {}
}

interface TextMsg {
    type: 'text';
    content: string;
}
interface ImageMsg {
    type: 'image';
    url: string;
    width: number;
}
type Message = TextMsg | ImageMsg;

// ============================================================================
// Test Data
// ============================================================================

const smallPlain = {
    name: 'Alice',
    id: 42,
    tags: ['a', 'b', 'c'],
    priority: 5,
    ready: true,
};

const mediumPlain = {
    name: 'Bob',
    type: 2,
    plan: Plan.ENTERPRISE,
    created: '2024-01-15T10:30:00.000Z',
    children: [{ label: 'child1' }, { label: 'child2' }],
    childrenMap: { sub1: { label: 'mapped' } },
    types: ['x', 'y', 'z'],
};

const textMsg: Message = { type: 'text', content: 'hello' };
const imageMsg: Message = { type: 'image', url: 'https://example.com/img.jpg', width: 800 };

// ============================================================================
// Pre-resolved functions (measure actual JIT performance)
// ============================================================================

const smallDeserFn = getSerializeFunction(typeOf<SmallModel>(), serializer.deserializeRegistry);
const smallSerFn = getSerializeFunction(typeOf<SmallModel>(), serializer.serializeRegistry);
const mediumDeserFn = getSerializeFunction(typeOf<MediumModel>(), serializer.deserializeRegistry);
const mediumSerFn = getSerializeFunction(typeOf<MediumModel>(), serializer.serializeRegistry);
const unionDeserFn = getSerializeFunction(typeOf<Message>(), serializer.deserializeRegistry);
const unionSerFn = getSerializeFunction(typeOf<Message>(), serializer.serializeRegistry);

// Pre-deserialize for serialize benchmarks
const smallInstance = smallDeserFn(smallPlain);
const mediumInstance = mediumDeserFn(mediumPlain);
const textInstance = unionDeserFn(textMsg);
const imageInstance = unionDeserFn(imageMsg);

// ============================================================================
// Tests — Pre-resolved Functions (JIT Performance)
// ============================================================================

describe('Serialization Performance Regression', () => {
    describe('Small model (5 fields)', () => {
        test('deserialize', () => {
            const suite = new BenchSuite('small deser');
            suite.add('deepkit', () => smallDeserFn(smallPlain));
            const results = suite.run({ verbose: false });
            assertMinOps('small deser', results['deepkit'].hz, 10_000_000);
        });

        test('serialize', () => {
            const suite = new BenchSuite('small ser');
            suite.add('deepkit', () => smallSerFn(smallInstance));
            const results = suite.run({ verbose: false });
            assertMinOps('small ser', results['deepkit'].hz, 10_000_000);
        });
    });

    describe('Medium model (nested, 7 fields)', () => {
        test('deserialize', () => {
            const suite = new BenchSuite('medium deser');
            suite.add('deepkit', () => mediumDeserFn(mediumPlain));
            const results = suite.run({ verbose: false });
            assertMinOps('medium deser', results['deepkit'].hz, 15_000);
        });

        test('serialize', () => {
            const suite = new BenchSuite('medium ser');
            suite.add('deepkit', () => mediumSerFn(mediumInstance));
            const results = suite.run({ verbose: false });
            assertMinOps('medium ser', results['deepkit'].hz, 50_000);
        });
    });

    describe('Union types', () => {
        test('discriminated union deserialize', () => {
            const suite = new BenchSuite('union deser');
            suite.add('text', () => unionDeserFn(textMsg));
            suite.add('image', () => unionDeserFn(imageMsg));
            const results = suite.run({ verbose: false });
            assertMinOps('union text deser', results['text'].hz, 1_000_000);
            assertMinOps('union image deser', results['image'].hz, 1_000_000);
        });

        test('discriminated union serialize', () => {
            const suite = new BenchSuite('union ser');
            suite.add('text', () => unionSerFn(textInstance));
            suite.add('image', () => unionSerFn(imageInstance));
            const results = suite.run({ verbose: false });
            assertMinOps('union text ser', results['text'].hz, 1_000_000);
            assertMinOps('union image ser', results['image'].hz, 1_000_000);
        });
    });

    describe('Arrays', () => {
        test('array of objects (100 items)', () => {
            interface Item {
                id: number;
                name: string;
                active: boolean;
            }

            const fn = getSerializeFunction(typeOf<Item[]>(), serializer.deserializeRegistry);
            const data: Item[] = Array.from({ length: 100 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                active: i % 2 === 0,
            }));
            fn(data);

            const suite = new BenchSuite('array deser');
            suite.add('deepkit', () => fn(data));
            const results = suite.run({ verbose: false });
            assertMinOps('array[100] deser', results['deepkit'].hz, 5_000);
        });
    });

    // ========================================================================
    // Convenience API overhead — tracks resolveReceiveType + cache lookup
    // ========================================================================

    describe('Convenience API overhead', () => {
        test('deserialize<T>() vs pre-resolved fn()', () => {
            // Warm up both paths
            deserialize<SmallModel>(smallPlain);
            smallDeserFn(smallPlain);

            const suite = new BenchSuite('overhead');
            suite.add('deserialize<T>()', () => deserialize<SmallModel>(smallPlain));
            suite.add('fn()', () => smallDeserFn(smallPlain));
            const results = suite.run({ verbose: false });

            const convenienceOps = results['deserialize<T>()'].hz;
            const directOps = results['fn()'].hz;
            const overhead = directOps / convenienceOps;
            console.log(`  Overhead factor: ${overhead.toFixed(1)}x (${(1e9 / convenienceOps - 1e9 / directOps).toFixed(0)}ns per call)`);

            // After Ω optimization + singleton NamingStrategy + fast cache key
            assertMinOps('deserialize<T>()', convenienceOps, 2_000_000);
        });

        test('serialize<T>() vs pre-resolved fn()', () => {
            // Warm up
            serialize<SmallModel>(smallInstance);

            const suite = new BenchSuite('ser overhead');
            suite.add('serialize<T>()', () => serialize<SmallModel>(smallInstance));
            suite.add('fn()', () => smallSerFn(smallInstance));
            const results = suite.run({ verbose: false });

            const convenienceOps = results['serialize<T>()'].hz;
            const directOps = results['fn()'].hz;
            const overhead = directOps / convenienceOps;
            console.log(`  Overhead factor: ${overhead.toFixed(1)}x (${(1e9 / convenienceOps - 1e9 / directOps).toFixed(0)}ns per call)`);

            assertMinOps('serialize<T>()', convenienceOps, 2_000_000);
        });
    });
});
