/**
 * Micro-benchmark to identify what makes Typia faster.
 * Tests different code generation patterns.
 */

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

const testData: Model = {
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
};

// ============================================================
// Pattern 1: Typia style (separate functions, flat chains)
// ============================================================
const typiaStyle = (() => {
    const _io0 = (input: any): boolean =>
        'number' === typeof input.number &&
        'number' === typeof input.negNumber &&
        'number' === typeof input.maxNumber &&
        'string' === typeof input.string &&
        'string' === typeof input.longString &&
        'boolean' === typeof input.boolean &&
        'object' === typeof input.deeplyNested &&
        null !== input.deeplyNested &&
        _io1(input.deeplyNested);
    const _io1 = (input: any): boolean =>
        'string' === typeof input.foo && 'number' === typeof input.num && 'boolean' === typeof input.bool;
    return (input: any): input is Model => 'object' === typeof input && null !== input && _io0(input);
})();

// ============================================================
// Pattern 2: Deepkit style (inlined, nested parens)
// ============================================================
const deepkitStyle = (v0: any): v0 is Model =>
    typeof v0 === 'object' &&
    !(v0 === null) &&
    typeof v0.number === 'number' &&
    typeof v0.negNumber === 'number' &&
    typeof v0.maxNumber === 'number' &&
    typeof v0.string === 'string' &&
    typeof v0.longString === 'string' &&
    typeof v0.boolean === 'boolean' &&
    typeof v0.deeplyNested === 'object' &&
    !(v0.deeplyNested === null) &&
    typeof v0.deeplyNested.foo === 'string' &&
    typeof v0.deeplyNested.num === 'number' &&
    typeof v0.deeplyNested.bool === 'boolean';

// ============================================================
// Pattern 3: Flat chain (no nested parens)
// ============================================================
const flatChain = (input: any): input is Model =>
    typeof input === 'object' &&
    input !== null &&
    typeof input.number === 'number' &&
    typeof input.negNumber === 'number' &&
    typeof input.maxNumber === 'number' &&
    typeof input.string === 'string' &&
    typeof input.longString === 'string' &&
    typeof input.boolean === 'boolean' &&
    typeof input.deeplyNested === 'object' &&
    input.deeplyNested !== null &&
    typeof input.deeplyNested.foo === 'string' &&
    typeof input.deeplyNested.num === 'number' &&
    typeof input.deeplyNested.bool === 'boolean';

// ============================================================
// Pattern 4: Operand-first comparison
// ============================================================
const operandFirst = (input: any): input is Model =>
    'object' === typeof input &&
    null !== input &&
    'number' === typeof input.number &&
    'number' === typeof input.negNumber &&
    'number' === typeof input.maxNumber &&
    'string' === typeof input.string &&
    'string' === typeof input.longString &&
    'boolean' === typeof input.boolean &&
    'object' === typeof input.deeplyNested &&
    null !== input.deeplyNested &&
    'string' === typeof input.deeplyNested.foo &&
    'number' === typeof input.deeplyNested.num &&
    'boolean' === typeof input.deeplyNested.bool;

// ============================================================
// Pattern 5: With helper function (like Typia but variable-first)
// ============================================================
const withHelper = (() => {
    const checkNested = (input: any): boolean =>
        typeof input.foo === 'string' && typeof input.num === 'number' && typeof input.bool === 'boolean';
    return (input: any): input is Model =>
        typeof input === 'object' &&
        input !== null &&
        typeof input.number === 'number' &&
        typeof input.negNumber === 'number' &&
        typeof input.maxNumber === 'number' &&
        typeof input.string === 'string' &&
        typeof input.longString === 'string' &&
        typeof input.boolean === 'boolean' &&
        typeof input.deeplyNested === 'object' &&
        input.deeplyNested !== null &&
        checkNested(input.deeplyNested);
})();

// ============================================================
// Pattern 6: Separate functions for each level
// ============================================================
const separateFunctions = (() => {
    const checkRoot = (input: any): boolean =>
        typeof input.number === 'number' &&
        typeof input.negNumber === 'number' &&
        typeof input.maxNumber === 'number' &&
        typeof input.string === 'string' &&
        typeof input.longString === 'string' &&
        typeof input.boolean === 'boolean' &&
        typeof input.deeplyNested === 'object' &&
        input.deeplyNested !== null &&
        checkNested(input.deeplyNested);
    const checkNested = (input: any): boolean =>
        typeof input.foo === 'string' && typeof input.num === 'number' && typeof input.bool === 'boolean';
    return (input: any): input is Model => typeof input === 'object' && input !== null && checkRoot(input);
})();

// ============================================================
// Pattern 7: Same as Deepkit generated (flat, v0!==null)
// ============================================================
const deepkitGenerated = (v0: any): v0 is Model =>
    typeof v0 === 'object' &&
    v0 !== null &&
    typeof v0.number === 'number' &&
    typeof v0.negNumber === 'number' &&
    typeof v0.maxNumber === 'number' &&
    typeof v0.string === 'string' &&
    typeof v0.longString === 'string' &&
    typeof v0.boolean === 'boolean' &&
    typeof v0.deeplyNested === 'object' &&
    v0.deeplyNested !== null &&
    typeof v0.deeplyNested.foo === 'string' &&
    typeof v0.deeplyNested.num === 'number' &&
    typeof v0.deeplyNested.bool === 'boolean';

// ============================================================
// Pattern 8: Typia style with variable-first comparison
// ============================================================
const typiaStyleVarFirst = (() => {
    const _io0 = (input: any): boolean =>
        typeof input.number === 'number' &&
        typeof input.negNumber === 'number' &&
        typeof input.maxNumber === 'number' &&
        typeof input.string === 'string' &&
        typeof input.longString === 'string' &&
        typeof input.boolean === 'boolean' &&
        typeof input.deeplyNested === 'object' &&
        input.deeplyNested !== null &&
        _io1(input.deeplyNested);
    const _io1 = (input: any): boolean =>
        typeof input.foo === 'string' && typeof input.num === 'number' && typeof input.bool === 'boolean';
    return (input: any): input is Model => typeof input === 'object' && input !== null && _io0(input);
})();

// ============================================================
// Benchmark
// ============================================================

function benchmark(name: string, fn: (data: any) => boolean, iterations: number = 1_000_000): number {
    const acc: boolean[] = [];

    // Warmup
    for (let i = 0; i < 50000; i++) acc.push(fn(testData));
    acc.length = 0;

    // Run 5 times, take best
    const runs: number[] = [];
    for (let run = 0; run < 5; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) acc.push(fn(testData));
        runs.push(iterations / ((performance.now() - start) / 1000));
        acc.length = 0;
    }

    runs.sort((a, b) => b - a);
    return Math.round(runs[0]);
}

function formatOps(ops: number): string {
    return (ops / 1e6).toFixed(1) + 'M';
}

// Verify correctness
console.log('=== Correctness Check ===');
console.log('typiaStyle:', typiaStyle(testData));
console.log('typiaStyleVarFirst:', typiaStyleVarFirst(testData));
console.log('deepkitStyle:', deepkitStyle(testData));
console.log('deepkitGenerated:', deepkitGenerated(testData));
console.log('flatChain:', flatChain(testData));
console.log('operandFirst:', operandFirst(testData));
console.log('withHelper:', withHelper(testData));
console.log('separateFunctions:', separateFunctions(testData));

console.log('\n=== Micro-Benchmark ===\n');

const results = [
    { name: 'Typia style (separate fns, operand-first)', ops: benchmark('typiaStyle', typiaStyle) },
    { name: 'Typia style (var-first)', ops: benchmark('typiaStyleVarFirst', typiaStyleVarFirst) },
    { name: 'Deepkit style (inlined, nested parens)', ops: benchmark('deepkitStyle', deepkitStyle) },
    { name: 'Deepkit generated (flat, v0!==null)', ops: benchmark('deepkitGenerated', deepkitGenerated) },
    { name: 'Flat chain (no nesting)', ops: benchmark('flatChain', flatChain) },
    { name: 'Operand-first (flat)', ops: benchmark('operandFirst', operandFirst) },
    { name: 'With helper function', ops: benchmark('withHelper', withHelper) },
    { name: 'Separate functions', ops: benchmark('separateFunctions', separateFunctions) },
];

results.sort((a, b) => b.ops - a.ops);
const maxOps = results[0].ops;

console.log('┌─────────────────────────────────────────────┬───────────────┬──────────┐');
console.log('│ Pattern                                     │ ops/sec       │ vs best  │');
console.log('├─────────────────────────────────────────────┼───────────────┼──────────┤');
for (const r of results) {
    const pct = ((r.ops / maxOps) * 100).toFixed(0) + '%';
    console.log(`│ ${r.name.padEnd(43)} │ ${formatOps(r.ops).padStart(11)} │ ${pct.padStart(8)} │`);
}
console.log('└─────────────────────────────────────────────┴───────────────┴──────────┘');

console.log('\n=== Analysis ===');
console.log(
    'Compare flat vs nested:',
    (
        ((results.find(r => r.name.includes('Flat'))?.ops || 0) /
            (results.find(r => r.name.includes('Deepkit'))?.ops || 1)) *
            100 -
        100
    ).toFixed(1) + '% faster',
);
console.log(
    'Compare operand-first:',
    (
        ((results.find(r => r.name.includes('Operand'))?.ops || 0) /
            (results.find(r => r.name.includes('Flat'))?.ops || 1)) *
            100 -
        100
    ).toFixed(1) + '% difference',
);
console.log(
    'Compare with helper:',
    (
        ((results.find(r => r.name.includes('With helper'))?.ops || 0) /
            (results.find(r => r.name.includes('Flat'))?.ops || 1)) *
            100 -
        100
    ).toFixed(1) + '% difference',
);
