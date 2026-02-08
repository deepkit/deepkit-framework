/**
 * V8 Nullish Check Patterns
 *
 * Benchmarks the isNullish optimization:
 * OLD: x === undefined || null === x  (two comparisons)
 * NEW: x == null                       (single check)
 *
 * Run: node --expose-gc --import @deepkit/run nullish-check.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Test data - various values to check
const testUndefined = undefined;
const testNull = null;
const testString = 'hello';
const testNumber = 42;
const testObject = { a: 1 };
const testZero = 0;
const testEmptyString = '';
const testFalse = false;

// ═══════════════════════════════════════════════════════════════════════════════
// Nullish check patterns - OLD vs NEW
// ═══════════════════════════════════════════════════════════════════════════════

const nullishSuite = new BenchSuite('nullish check: OLD vs NEW');

// OLD pattern (what we were generating)
nullishSuite.add('OLD: x === undefined || null === x', () => {
    return (
        (testUndefined === undefined || null === testUndefined) &&
        (testNull === undefined || null === testNull) &&
        !(testString === undefined || null === testString) &&
        !(testNumber === undefined || null === testNumber) &&
        !(testObject === undefined || null === testObject) &&
        !(testZero === undefined || null === testZero) &&
        !(testEmptyString === undefined || null === testEmptyString) &&
        !(testFalse === undefined || null === testFalse)
    );
});

// NEW pattern (what we now generate)
nullishSuite.add('NEW: x == null', () => {
    return (
        testUndefined == null &&
        testNull == null &&
        !(testString == null) &&
        !(testNumber == null) &&
        !(testObject == null) &&
        !(testZero == null) &&
        !(testEmptyString == null) &&
        !(testFalse == null)
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Negated nullish check patterns
// ═══════════════════════════════════════════════════════════════════════════════

const notNullishSuite = new BenchSuite('NOT nullish: OLD vs NEW');

// OLD pattern negated
notNullishSuite.add('OLD: !(x === undefined || null === x)', () => {
    return (
        !(testUndefined === undefined || null === testUndefined) ||
        !(testNull === undefined || null === testNull) ||
        !(testString === undefined || null === testString) ||
        !(testNumber === undefined || null === testNumber) ||
        !(testObject === undefined || null === testObject) ||
        !(testZero === undefined || null === testZero) ||
        !(testEmptyString === undefined || null === testEmptyString) ||
        !(testFalse === undefined || null === testFalse)
    );
});

// NEW pattern negated
notNullishSuite.add('NEW: x != null', () => {
    return (
        testUndefined != null ||
        testNull != null ||
        testString != null ||
        testNumber != null ||
        testObject != null ||
        testZero != null ||
        testEmptyString != null ||
        testFalse != null
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Realistic serialization scenario - optional property check
// ═══════════════════════════════════════════════════════════════════════════════

const serializationSuite = new BenchSuite('serialization: optional property check');

// Simulated optional property check - OLD pattern
const optionalCheckOld = new Function(
    'obj',
    `
    let result = true;
    // 5 optional properties - typical object
    const p1 = obj.prop1;
    if (!(p1 === undefined || null === p1)) result = result && typeof p1 === 'string';
    const p2 = obj.prop2;
    if (!(p2 === undefined || null === p2)) result = result && typeof p2 === 'number';
    const p3 = obj.prop3;
    if (!(p3 === undefined || null === p3)) result = result && typeof p3 === 'boolean';
    const p4 = obj.prop4;
    if (!(p4 === undefined || null === p4)) result = result && typeof p4 === 'object';
    const p5 = obj.prop5;
    if (!(p5 === undefined || null === p5)) result = result && typeof p5 === 'string';
    return result;
`,
);

// Simulated optional property check - NEW pattern
const optionalCheckNew = new Function(
    'obj',
    `
    let result = true;
    // 5 optional properties - typical object
    const p1 = obj.prop1;
    if (null != p1) result = result && typeof p1 === 'string';
    const p2 = obj.prop2;
    if (null != p2) result = result && typeof p2 === 'number';
    const p3 = obj.prop3;
    if (null != p3) result = result && typeof p3 === 'boolean';
    const p4 = obj.prop4;
    if (null != p4) result = result && typeof p4 === 'object';
    const p5 = obj.prop5;
    if (null != p5) result = result && typeof p5 === 'string';
    return result;
`,
);

const testObj = {
    prop1: 'hello',
    prop2: 42,
    prop3: true,
    prop4: { nested: true },
    prop5: undefined, // optional not provided
};

serializationSuite.add('OLD: !(p === undefined || null === p)', () => {
    return optionalCheckOld(testObj);
});

serializationSuite.add('NEW: null != p', () => {
    return optionalCheckNew(testObj);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  Nullish Check Optimization Benchmark                                ║');
    console.log('║  Comparing: x === undefined || null === x  vs  x == null             ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    await nullishSuite.runAsync();
    await notNullishSuite.runAsync();
    await serializationSuite.runAsync();

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('Summary: NEW pattern (x == null) uses single JS comparison vs two');
    console.log('═══════════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
