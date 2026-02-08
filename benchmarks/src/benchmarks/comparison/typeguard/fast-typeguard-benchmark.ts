/**
 * Benchmark for the new fast type guard API.
 *
 * Compares:
 * - Optimal hand-crafted type guard (pure && chain)
 * - New Deepkit fast is<T>()
 * - Old Deepkit is() with error collection
 *
 * Run: node --import @deepkit/run benchmarks/fast-typeguard-benchmark.ts
 */
import { jit } from '@deepkit/core';
import { getValidatorFunction, is, serializer, typeGuard, typeOf, validate } from '@deepkit/type';

// Test interface (same as typescript-runtime-type-benchmarks)
interface ToBeChecked {
    number: number;
    negNumber: number;
    maxNumber: number;
    string: string;
    longString: string;
    boolean: boolean;
    deeplyNested: {
        foo: string;
        num: number;
        bool: boolean;
    };
}

// Valid test data
const validData: ToBeChecked = Object.freeze({
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    boolean: true,
    deeplyNested: {
        foo: 'bar',
        num: 1,
        bool: false,
    },
});

// Invalid test data (wrong type in nested object)
const invalidData = Object.freeze({
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString: 'Lorem ipsum dolor sit amet...',
    boolean: true,
    deeplyNested: {
        foo: 123, // wrong type!
        num: 1,
        bool: false,
    },
});

// ============================================================
// OPTIMAL IMPLEMENTATION (what typia generates)
// ============================================================

function optimalIs(input: unknown): input is ToBeChecked {
    return (
        typeof input === 'object' &&
        input !== null &&
        typeof (input as any).number === 'number' &&
        typeof (input as any).negNumber === 'number' &&
        typeof (input as any).maxNumber === 'number' &&
        typeof (input as any).string === 'string' &&
        typeof (input as any).longString === 'string' &&
        typeof (input as any).boolean === 'boolean' &&
        typeof (input as any).deeplyNested === 'object' &&
        (input as any).deeplyNested !== null &&
        typeof (input as any).deeplyNested.foo === 'string' &&
        typeof (input as any).deeplyNested.num === 'number' &&
        typeof (input as any).deeplyNested.bool === 'boolean'
    );
}

// ============================================================
// DEEPKIT IMPLEMENTATIONS
// ============================================================

// New fast type guard (precompiled)
const fastIsPrecompiled = typeGuard<ToBeChecked>();

// Old type guard with error collection (precompiled)
const type = typeOf<ToBeChecked>();
const oldIsPrecompiled = serializer.buildTypeGuard<ToBeChecked>(type, false);

// ============================================================
// BENCHMARK UTILITIES
// ============================================================

function benchmark(name: string, fn: () => any, iterations: number = 2_000_000): number {
    const acc: any[] = [];

    // Warmup - important for JIT
    for (let i = 0; i < 100000; i++) acc.push(fn());
    acc.length = 0;

    // Run 5 times, take best
    const runs: number[] = [];
    for (let run = 0; run < 5; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) acc.push(fn());
        const end = performance.now();
        runs.push(iterations / ((end - start) / 1000));
        acc.length = 0;
    }

    runs.sort((a, b) => b - a);
    return Math.round(runs[0]);
}

function formatOps(ops: number): string {
    return (ops / 1e6).toFixed(1) + 'M';
}

function pct(a: number, b: number): string {
    return ((a / b) * 100).toFixed(0) + '%';
}

// ============================================================
// RUN BENCHMARKS
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║      DEEPKIT FAST TYPE GUARD BENCHMARK                       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Verify correctness first
console.log('--- Correctness Check ---');
console.log(`Optimal   - valid: ${optimalIs(validData)}, invalid: ${optimalIs(invalidData)}`);
console.log(`Fast is() - valid: ${fastIsPrecompiled(validData)}, invalid: ${fastIsPrecompiled(invalidData)}`);
console.log(
    `Old is()  - valid: ${oldIsPrecompiled(validData, { errors: [] })}, invalid: ${oldIsPrecompiled(invalidData, { errors: [] })}`,
);
console.log();

// Valid data benchmarks
console.log('=== VALID DATA (should return true) ===\n');

const optimalValidOps = benchmark('optimal (valid)', () => optimalIs(validData));
const fastValidOps = benchmark('fast is() (valid)', () => fastIsPrecompiled(validData));
const oldValidOps = benchmark('old is() (valid)', () => oldIsPrecompiled(validData, { errors: [] }));

console.log('┌─────────────────────┬───────────────┬──────────────┐');
console.log('│ Implementation      │ ops/sec       │ vs optimal   │');
console.log('├─────────────────────┼───────────────┼──────────────┤');
console.log(`│ Optimal (baseline)  │ ${formatOps(optimalValidOps).padStart(11)} │ 100%         │`);
console.log(
    `│ NEW Fast is<T>()    │ ${formatOps(fastValidOps).padStart(11)} │ ${pct(fastValidOps, optimalValidOps).padStart(4)}         │`,
);
console.log(
    `│ OLD is() + errors   │ ${formatOps(oldValidOps).padStart(11)} │ ${pct(oldValidOps, optimalValidOps).padStart(4)}         │`,
);
console.log('└─────────────────────┴───────────────┴──────────────┘');
console.log();

// Invalid data benchmarks
console.log('=== INVALID DATA (should return false) ===\n');

const optimalInvalidOps = benchmark('optimal (invalid)', () => optimalIs(invalidData));
const fastInvalidOps = benchmark('fast is() (invalid)', () => fastIsPrecompiled(invalidData));
const oldInvalidOps = benchmark('old is() (invalid)', () => oldIsPrecompiled(invalidData, { errors: [] }));

console.log('┌─────────────────────┬───────────────┬──────────────┐');
console.log('│ Implementation      │ ops/sec       │ vs optimal   │');
console.log('├─────────────────────┼───────────────┼──────────────┤');
console.log(`│ Optimal (baseline)  │ ${formatOps(optimalInvalidOps).padStart(11)} │ 100%         │`);
console.log(
    `│ NEW Fast is<T>()    │ ${formatOps(fastInvalidOps).padStart(11)} │ ${pct(fastInvalidOps, optimalInvalidOps).padStart(4)}         │`,
);
console.log(
    `│ OLD is() + errors   │ ${formatOps(oldInvalidOps).padStart(11)} │ ${pct(oldInvalidOps, optimalInvalidOps).padStart(4)}         │`,
);
console.log('└─────────────────────┴───────────────┴──────────────┘');
console.log();

// Improvement summary
console.log('=== IMPROVEMENT SUMMARY ===\n');
const fastImprovement = ((fastValidOps / oldValidOps - 1) * 100).toFixed(0);
console.log(`Fast is<T>() is ${fastImprovement}% faster than old is() with error collection`);
console.log(`Fast is<T>() achieves ${pct(fastValidOps, optimalValidOps)} of optimal performance`);
console.log(`Gap to close: ${formatOps(optimalValidOps - fastValidOps)} ops/s`);
console.log();

// Show generated code
console.log('=== GENERATED CODE ===\n');

console.log('--- Optimal (hand-crafted) ---');
console.log(optimalIs.toString());
console.log(`(${optimalIs.toString().length} chars)\n`);

console.log('--- NEW Fast is<T>() ---');
const fastCode = fastIsPrecompiled.toString();
console.log(fastCode);
console.log(`(${fastCode.length} chars)\n`);

console.log('--- OLD is() with error collection ---');
const oldCode = oldIsPrecompiled.toString();
// Truncate if too long
if (oldCode.length > 1000) {
    console.log(oldCode.substring(0, 1000) + '...');
} else {
    console.log(oldCode);
}
console.log(`(${oldCode.length} chars total)\n`);
