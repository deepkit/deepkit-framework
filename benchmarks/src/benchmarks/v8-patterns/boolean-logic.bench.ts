/**
 * V8 Boolean Logic Patterns
 *
 * Tests AND/OR chain patterns, short-circuit behavior, and nesting depth.
 * Critical for understanding how V8 optimizes guard compositions.
 *
 * Run: node --expose-gc --import @deepkit/run boolean-logic.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Test data - object with multiple properties for realistic checks
const obj = {
    a: 'string',
    b: 42,
    c: true,
    d: { nested: 'value' },
    e: [1, 2, 3],
    f: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// AND chain depth - how does chain length affect performance?
// ═══════════════════════════════════════════════════════════════════════════════

const andChainSuite = new BenchSuite('AND chain depth (all true)');

andChainSuite.add('2 conditions', () => {
    return 'string' === typeof obj.a && 'number' === typeof obj.b;
});

andChainSuite.add('4 conditions', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d
    );
});

andChainSuite.add('6 conditions', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        null === obj.f
    );
});

andChainSuite.add('8 conditions', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        null === obj.f &&
        null !== obj.d &&
        'object' === typeof obj.e
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Short-circuit behavior - early exit vs late exit
// ═══════════════════════════════════════════════════════════════════════════════

const shortCircuitSuite = new BenchSuite('AND short-circuit position');

// First condition fails
shortCircuitSuite.add('fail at position 1 of 6', () => {
    return (
        'number' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        null === obj.f
    );
});

// Third condition fails
shortCircuitSuite.add('fail at position 3 of 6', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'number' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        null === obj.f
    );
});

// Last condition fails
shortCircuitSuite.add('fail at position 6 of 6', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        'string' === typeof obj.f
    );
});

// All pass
shortCircuitSuite.add('all pass (6 conditions)', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d &&
        Array.isArray(obj.e) &&
        null === obj.f
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// OR chains
// ═══════════════════════════════════════════════════════════════════════════════

const orChainSuite = new BenchSuite('OR chain patterns');

// First true
orChainSuite.add('OR: first true of 4', () => {
    return (
        'string' === typeof obj.a || 'string' === typeof obj.b || 'string' === typeof obj.c || 'string' === typeof obj.d
    );
});

// Last true
orChainSuite.add('OR: last true of 4', () => {
    return (
        'number' === typeof obj.a || 'string' === typeof obj.b || 'string' === typeof obj.c || 'object' === typeof obj.d
    );
});

// None true
orChainSuite.add('OR: none true of 4', () => {
    return (
        'number' === typeof obj.a || 'string' === typeof obj.b || 'string' === typeof obj.c || 'string' === typeof obj.d
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Nested vs flat - how does structure affect optimization?
// ═══════════════════════════════════════════════════════════════════════════════

const nestingSuite = new BenchSuite('nested vs flat structure');

// Flat AND chain
nestingSuite.add('flat: a && b && c && d', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d
    );
});

// Right-nested (typical parser output)
nestingSuite.add('nested: a && (b && (c && d))', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d
    );
});

// Left-nested
nestingSuite.add('nested: ((a && b) && c) && d', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d
    );
});

// Balanced
nestingSuite.add('nested: (a && b) && (c && d)', () => {
    return (
        'string' === typeof obj.a &&
        'number' === typeof obj.b &&
        'boolean' === typeof obj.c &&
        'object' === typeof obj.d
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mixed AND/OR patterns (union types)
// ═══════════════════════════════════════════════════════════════════════════════

const mixedSuite = new BenchSuite('mixed AND/OR (union types)');

// string | number check
mixedSuite.add('("string" === typeof x || "number" === typeof x)', () => {
    return 'string' === typeof obj.a || 'number' === typeof obj.a;
});

// Object with union property
mixedSuite.add('object && (prop is string | number)', () => {
    return 'object' === typeof obj && null !== obj && ('string' === typeof obj.a || 'number' === typeof obj.a);
});

// Multiple union checks
mixedSuite.add('(string|number) && (boolean|null)', () => {
    return ('string' === typeof obj.a || 'number' === typeof obj.a) && ('boolean' === typeof obj.c || null === obj.c);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  V8 Boolean Logic Patterns Benchmark                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    await andChainSuite.runAsync();
    await shortCircuitSuite.runAsync();
    await orChainSuite.runAsync();
    await nestingSuite.runAsync();
    await mixedSuite.runAsync();
}

main().catch(console.error);
