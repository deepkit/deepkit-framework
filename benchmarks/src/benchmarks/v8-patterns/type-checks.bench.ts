/**
 * V8 Type Check Patterns
 *
 * Tests various type checking patterns used throughout Deepkit's JIT code.
 * These form the foundation of all validation and serialization guards.
 *
 * Run: node --expose-gc --import @deepkit/run type-checks.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Test data
const testString = 'hello world';
const testNumber = 42.5;
const testObject = { foo: 'bar' };
const testArray = [1, 2, 3];
const testNull = null;
const testUndefined = undefined;

// ═══════════════════════════════════════════════════════════════════════════════
// typeof checks - compare different operand positions
// ═══════════════════════════════════════════════════════════════════════════════

const typeofSuite = new BenchSuite('typeof patterns');

// String type checks
typeofSuite.add('typeof x === "string" (variable-first)', () => {
    return typeof testString === 'string';
});

typeofSuite.add('"string" === typeof x (operand-first)', () => {
    return 'string' === typeof testString;
});

// Number type checks
typeofSuite.add('typeof x === "number" (variable-first)', () => {
    return typeof testNumber === 'number';
});

typeofSuite.add('"number" === typeof x (operand-first)', () => {
    return 'number' === typeof testNumber;
});

// Object type checks
typeofSuite.add('typeof x === "object" (variable-first)', () => {
    return typeof testObject === 'object';
});

typeofSuite.add('"object" === typeof x (operand-first)', () => {
    return 'object' === typeof testObject;
});

// ═══════════════════════════════════════════════════════════════════════════════
// null/undefined checks
// ═══════════════════════════════════════════════════════════════════════════════

const nullSuite = new BenchSuite('null/undefined patterns');

nullSuite.add('x === null', () => {
    return testNull === null;
});

nullSuite.add('null === x', () => {
    return null === testNull;
});

nullSuite.add('x !== null', () => {
    return testObject !== null;
});

nullSuite.add('null !== x', () => {
    return null !== testObject;
});

nullSuite.add('x === undefined', () => {
    return testUndefined === undefined;
});

nullSuite.add('x == null (null or undefined)', () => {
    return testNull == null;
});

nullSuite.add('x === null || x === undefined', () => {
    return testNull === null || testNull === undefined;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Combined object checks (typical guard pattern)
// ═══════════════════════════════════════════════════════════════════════════════

const objectGuardSuite = new BenchSuite('object guard patterns');

objectGuardSuite.add('typeof x === "object" && x !== null', () => {
    return typeof testObject === 'object' && testObject !== null;
});

objectGuardSuite.add('"object" === typeof x && null !== x', () => {
    return 'object' === typeof testObject && null !== testObject;
});

objectGuardSuite.add('x && typeof x === "object"', () => {
    return testObject && typeof testObject === 'object';
});

objectGuardSuite.add('x !== null && typeof x === "object"', () => {
    return testObject !== null && typeof testObject === 'object';
});

// ═══════════════════════════════════════════════════════════════════════════════
// Array checks
// ═══════════════════════════════════════════════════════════════════════════════

const arraySuite = new BenchSuite('array check patterns');

arraySuite.add('Array.isArray(x)', () => {
    return Array.isArray(testArray);
});

arraySuite.add('x instanceof Array', () => {
    return testArray instanceof Array;
});

arraySuite.add('x.constructor === Array', () => {
    return testArray.constructor === Array;
});

arraySuite.add('Object.prototype.toString.call(x) === "[object Array]"', () => {
    return Object.prototype.toString.call(testArray) === '[object Array]';
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  V8 Type Check Patterns Benchmark                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    await typeofSuite.runAsync();
    await nullSuite.runAsync();
    await objectGuardSuite.runAsync();
    await arraySuite.runAsync();
}

main().catch(console.error);
