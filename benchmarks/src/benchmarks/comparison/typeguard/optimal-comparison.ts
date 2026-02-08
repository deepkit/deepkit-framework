/**
 * Compare Deepkit JIT against hand-crafted optimal implementations.
 *
 * These represent what the fastest libraries (typia, etc.) would generate.
 * Use this to identify optimization opportunities.
 *
 * Run: node --import @deepkit/run benchmarks/optimal-comparison.ts
 */
import { cast, createTypeGuardFunction, getSerializeFunction, serializer, typeOf } from '@deepkit/type';

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

// Test data
const validateData: ToBeChecked = Object.freeze({
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

// ============================================================
// OPTIMAL IMPLEMENTATIONS (what typia/fastest libs generate)
// ============================================================

// Optimal type guard - pure && chain
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

// Optimal serialize/clone - direct object literal
function optimalSerialize(input: ToBeChecked): ToBeChecked {
    return {
        number: input.number,
        negNumber: input.negNumber,
        maxNumber: input.maxNumber,
        string: input.string,
        longString: input.longString,
        boolean: input.boolean,
        deeplyNested: {
            foo: input.deeplyNested.foo,
            num: input.deeplyNested.num,
            bool: input.deeplyNested.bool,
        },
    };
}

// Optimal deserialize (no coercion, just validation + clone)
function optimalDeserialize(input: unknown): ToBeChecked {
    if (!optimalIs(input)) throw new Error('Invalid input');
    return optimalSerialize(input);
}

// Fairer comparison: deserialize that clones without full upfront validation
// This is closer to what Deepkit does - check root type, then clone
function optimalDeserializeFast(input: unknown): ToBeChecked {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input');
    const i = input as any;
    return {
        number: i.number,
        negNumber: i.negNumber,
        maxNumber: i.maxNumber,
        string: i.string,
        longString: i.longString,
        boolean: i.boolean,
        deeplyNested: {
            foo: i.deeplyNested.foo,
            num: i.deeplyNested.num,
            bool: i.deeplyNested.bool,
        },
    };
}

// ============================================================
// DEEPKIT IMPLEMENTATIONS
// ============================================================

const type = typeOf<ToBeChecked>();
const deepkitIs = createTypeGuardFunction(type, serializer, true);
const deepkitSerialize = getSerializeFunction(type, serializer.serializeRegistry);
const deepkitDeserialize = getSerializeFunction(type, serializer.deserializeRegistry);

// ============================================================
// BENCHMARK
// ============================================================

function benchmark(name: string, fn: () => any, iterations: number = 2_000_000): number {
    const acc: any[] = [];

    // Warmup
    for (let i = 0; i < 50000; i++) acc.push(fn());
    acc.length = 0;

    // Run 3 times, take best
    const runs: number[] = [];
    for (let run = 0; run < 3; run++) {
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

console.log('=== Deepkit vs Optimal Implementation Comparison ===\n');

// Validation
console.log('--- TYPE GUARD (is<T>) ---');
const optIsResult = benchmark('optimal is()', () => optimalIs(validateData));
const dkIsResult = benchmark('deepkit is()', () => deepkitIs(validateData));
console.log(`Optimal:  ${formatOps(optIsResult).padStart(7)} ops/s`);
console.log(`Deepkit:  ${formatOps(dkIsResult).padStart(7)} ops/s (${pct(dkIsResult, optIsResult)} of optimal)`);
console.log(`Gap: ${formatOps(optIsResult - dkIsResult)} ops/s to close\n`);

// Serialize
console.log('--- SERIALIZE ---');
const optSerResult = benchmark('optimal serialize()', () => optimalSerialize(validateData));
const dkSerResult = benchmark('deepkit serialize()', () => deepkitSerialize(validateData, {}));
console.log(`Optimal:  ${formatOps(optSerResult).padStart(7)} ops/s`);
console.log(`Deepkit:  ${formatOps(dkSerResult).padStart(7)} ops/s (${pct(dkSerResult, optSerResult)} of optimal)`);
console.log(`Gap: ${formatOps(optSerResult - dkSerResult)} ops/s to close\n`);

// Deserialize (with validation, no coercion)
console.log('--- DESERIALIZE ---');
const optDesResult = benchmark('optimal (validate+clone)', () => optimalDeserialize(validateData));
const optDesFastResult = benchmark('optimal (clone only)', () => optimalDeserializeFast(validateData));
const dkDesResult = benchmark('deepkit deserialize()', () => deepkitDeserialize(validateData, { loosely: false }));
console.log(`Optimal (validate+clone): ${formatOps(optDesResult).padStart(7)} ops/s`);
console.log(`Optimal (clone only):     ${formatOps(optDesFastResult).padStart(7)} ops/s`);
console.log(
    `Deepkit:                  ${formatOps(dkDesResult).padStart(7)} ops/s (${pct(dkDesResult, optDesFastResult)} of optimal clone)`,
);
console.log(`Gap: ${formatOps(optDesFastResult - dkDesResult)} ops/s to close\n`);

// Full cast (with coercion)
console.log('--- CAST (full deserialize with coercion) ---');
const dkCastResult = benchmark('deepkit cast()', () => cast<ToBeChecked>(validateData));
console.log(`Deepkit:  ${formatOps(dkCastResult).padStart(7)} ops/s`);
console.log(`(No optimal baseline - coercion is Deepkit-unique feature)\n`);

// Show generated code
console.log('=== GENERATED CODE ANALYSIS ===\n');

console.log('--- Deepkit Serialize ---');
console.log(deepkitSerialize.toString());

console.log('\n--- Optimal Serialize ---');
console.log(optimalSerialize.toString());

console.log('\n--- Deepkit Type Guard (loose) ---');
const isStr = deepkitIs.toString();
console.log(isStr.substring(0, 800) + (isStr.length > 800 ? '...' : ''));
console.log(`(${isStr.length} chars total)`);

console.log('\n--- Deepkit Deserialize ---');
const deserializeStr = deepkitDeserialize.toString();
console.log(deserializeStr.substring(0, 500) + '...\n');
console.log(`(${deserializeStr.length} chars total)`);
