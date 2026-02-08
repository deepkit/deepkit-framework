/**
 * Full API benchmark covering all operations from the feature matrix.
 *
 * Maps to typescript-runtime-type-benchmarks categories:
 * - assertLoose  → is<T>() (fast type guard)
 * - assertStrict → isStrict<T>() (reject unknown keys)
 * - parseSafe    → deserialize<T>() without coercion
 * - parseStrict  → isStrict<T>() + deserialize<T>()
 *
 * Run: node --import @deepkit/run benchmarks/full-api-benchmark.ts
 */
import {
    ValidationErrorItem,
    assert,
    cast,
    deserialize,
    getSerializeFunction,
    is,
    serialize,
    serializer,
    typeGuard,
    typeOf,
    validate,
} from '@deepkit/type';

// Test interface (same as typescript-runtime-type-benchmarks)
interface Model {
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
const validData: Model = Object.freeze({
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    boolean: true,
    deeplyNested: Object.freeze({
        foo: 'bar',
        num: 1,
        bool: false,
    }),
});

// JSON data (what you'd get from JSON.parse)
const jsonData = JSON.parse(JSON.stringify(validData));

// ============================================================
// OPTIMAL IMPLEMENTATIONS
// ============================================================

function optimalIs(input: unknown): input is Model {
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

function optimalClone(input: Model): Model {
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

function optimalParse(input: unknown): Model {
    if (!optimalIs(input)) throw new Error('Invalid');
    return optimalClone(input);
}

// ============================================================
// PRECOMPILE DEEPKIT FUNCTIONS
// ============================================================

const type = typeOf<Model>();
const fastIs = typeGuard<Model>();
const oldIs = serializer.buildTypeGuard<Model>(type, false);
const serializeFn = getSerializeFunction(type, serializer.serializeRegistry);
const deserializeFn = getSerializeFunction(type, serializer.deserializeRegistry);

// ============================================================
// BENCHMARK
// ============================================================

function benchmark(name: string, fn: () => any, iterations: number = 1_000_000): number {
    const acc: any[] = [];

    // Warmup
    for (let i = 0; i < 50000; i++) acc.push(fn());
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

function printTable(title: string, rows: Array<{ name: string; ops: number; baseline?: number }>) {
    console.log(`\n=== ${title} ===\n`);
    console.log('┌────────────────────────────┬───────────────┬──────────────┐');
    console.log('│ Operation                  │ ops/sec       │ vs optimal   │');
    console.log('├────────────────────────────┼───────────────┼──────────────┤');

    const baseline = rows[0].ops;
    for (const row of rows) {
        const pctStr = row.baseline !== undefined ? pct(row.ops, row.baseline) : pct(row.ops, baseline);
        console.log(`│ ${row.name.padEnd(26)} │ ${formatOps(row.ops).padStart(11)} │ ${pctStr.padStart(5)}        │`);
    }
    console.log('└────────────────────────────┴───────────────┴──────────────┘');
}

// ============================================================
// RUN ALL BENCHMARKS
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║      DEEPKIT FULL API BENCHMARK (Feature Matrix)                 ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║  Mapping to typescript-runtime-type-benchmarks:                  ║');
console.log('║  • assertLoose  → is<T>() fast type guard                        ║');
console.log('║  • parseSafe    → deserialize<T>()                               ║');
console.log('║  • serialize    → serialize<T>()                                 ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

// 1. Type Guard (assertLoose)
const optIsOps = benchmark('optimal is()', () => optimalIs(validData));
const fastIsOps = benchmark('fast is<T>()', () => fastIs(validData));
const oldIsOps = benchmark('old is() + errors', () => oldIs(validData, { errors: [] }));

printTable('TYPE GUARD (assertLoose)', [
    { name: 'Optimal (baseline)', ops: optIsOps },
    { name: 'NEW is<T>() fast', ops: fastIsOps },
    { name: 'OLD is() + errors', ops: oldIsOps },
]);

// 2. Serialize
const optSerOps = benchmark('optimal clone()', () => optimalClone(validData as any));
const dkSerOps = benchmark('serialize<T>()', () => serializeFn(validData, {}));

printTable('SERIALIZE', [
    { name: 'Optimal clone (baseline)', ops: optSerOps },
    { name: 'serialize<T>()', ops: dkSerOps },
]);

// 3. Deserialize (parseSafe equivalent)
const optParseOps = benchmark('optimal parse()', () => optimalParse(jsonData));
const dkDesOps = benchmark('deserialize<T>()', () => deserializeFn(jsonData, {}));

printTable('DESERIALIZE (parseSafe)', [
    { name: 'Optimal parse (baseline)', ops: optParseOps },
    { name: 'deserialize<T>()', ops: dkDesOps },
]);

// 4. Cast (deserialize + validate)
const dkCastOps = benchmark('cast<T>()', () => cast<Model>(jsonData));

printTable('CAST (deserialize + validate)', [
    { name: 'Optimal parse (baseline)', ops: optParseOps },
    { name: 'cast<T>()', ops: dkCastOps },
]);

// 5. Validate with error collection (returns errors array)
const validateOps = benchmark('validate<T>()', () => {
    const errors = validate<Model>(validData);
    return errors.length === 0;
});

printTable('VALIDATE (with error collection)', [
    { name: 'Optimal is (baseline)', ops: optIsOps },
    { name: 'validate<T>() + errors', ops: validateOps },
]);

// Summary
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║                         SUMMARY                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

console.log('Performance vs Optimal:');
console.log(`  • Type Guard (is):     ${pct(fastIsOps, optIsOps)} (was ${pct(oldIsOps, optIsOps)} before)`);
console.log(`  • Serialize:           ${pct(dkSerOps, optSerOps)}`);
console.log(`  • Deserialize:         ${pct(dkDesOps, optParseOps)}`);
console.log();

console.log('Improvement from new API:');
console.log(`  • is<T>() is ${((fastIsOps / oldIsOps - 1) * 100).toFixed(0)}% faster than old is() with errors`);
console.log();

console.log('Absolute Performance:');
console.log(`  • is<T>():           ${formatOps(fastIsOps)} ops/s`);
console.log(`  • serialize<T>():    ${formatOps(dkSerOps)} ops/s`);
console.log(`  • deserialize<T>():  ${formatOps(dkDesOps)} ops/s`);
console.log(`  • cast<T>():         ${formatOps(dkCastOps)} ops/s`);
console.log(`  • validate<T>():     ${formatOps(validateOps)} ops/s`);
