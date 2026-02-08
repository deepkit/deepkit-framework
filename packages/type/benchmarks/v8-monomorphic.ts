/**
 * V8 Monomorphic Pattern: Avoid hidden class polymorphism
 *
 * The deoptimization happens because:
 * - Pattern A creates {tags,priority,id,name} (4 props)
 * - Pattern B creates {tags,priority,id,name,ready} (5 props)
 * - V8 sees two different hidden classes → polymorphic → deopt
 *
 * Solutions:
 * 1. Always include all properties (monomorphic but may include undefined)
 * 2. Use separate functions for each shape (megamorphic avoidance)
 */

function benchmark(name: string, fn: () => void, iterations: number = 3_000_000): number {
    // Heavy warmup
    for (let i = 0; i < 200000; i++) fn();

    // Take best of 3
    const runs: number[] = [];
    for (let r = 0; r < 3; r++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) fn();
        const end = performance.now();
        runs.push(iterations / ((end - start) / 1000));
    }
    runs.sort((a, b) => b - a);
    return Math.round(runs[0]);
}

function formatOps(ops: number): string {
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(1) + 'M';
    return (ops / 1_000).toFixed(1) + 'K';
}

const inputWith = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithout = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

console.log('V8 Monomorphic Pattern Analysis');
console.log('='.repeat(70));
console.log('');
console.log('PROBLEM: Conditional property addition creates polymorphic hidden classes');
console.log('         V8 deoptimizes when it sees different shapes from same code');
console.log('');

// Polymorphic: Same function, different output shapes
function polymorphicPattern(input: any): any {
    const o: any = { tags: input.tags, priority: input.priority, id: input.id, name: input.name };
    if ('ready' in input) {
        o.ready = input.ready ?? null;
    }
    return o;
}

// Monomorphic Option 1: Always include ready (value may be undefined)
function monomorphicAlways(input: any): any {
    return {
        tags: input.tags,
        priority: input.priority,
        id: input.id,
        name: input.name,
        ready: 'ready' in input ? (input.ready ?? null) : undefined,
    };
}

// Monomorphic Option 2: Separate functions for with/without
function monomorphicWith(input: any): any {
    return {
        tags: input.tags,
        priority: input.priority,
        id: input.id,
        name: input.name,
        ready: input.ready ?? null,
    };
}

function monomorphicWithout(input: any): any {
    return {
        tags: input.tags,
        priority: input.priority,
        id: input.id,
        name: input.name,
    };
}

function dispatchedMonomorphic(input: any): any {
    return 'ready' in input ? monomorphicWith(input) : monomorphicWithout(input);
}

console.log('TEST 1: POLYMORPHIC (current hybrid) - same function, mixed inputs');
console.log('-'.repeat(70));

// Mix inputs to trigger polymorphism
let resultPoly: any;
const polyBench = benchmark('polymorphic-mixed', () => {
    resultPoly = polymorphicPattern(inputWith);
    resultPoly = polymorphicPattern(inputWithout);
});
console.log(`  Mixed (with + without each iteration):  ${formatOps(polyBench / 2).padStart(10)} ops/s per call`);

console.log('');
console.log('TEST 2: POLYMORPHIC (current hybrid) - same function, single input type');
console.log('-'.repeat(70));

const polyWithOnly = benchmark('polymorphic-with', () => polymorphicPattern(inputWith));
const polyWithoutOnly = benchmark('polymorphic-without', () => polymorphicPattern(inputWithout));
console.log(`  Only WITH ready inputs:                 ${formatOps(polyWithOnly).padStart(10)} ops/s`);
console.log(`  Only WITHOUT ready inputs:              ${formatOps(polyWithoutOnly).padStart(10)} ops/s`);

console.log('');
console.log('TEST 3: MONOMORPHIC - always include ready (may have undefined)');
console.log('-'.repeat(70));

const monoAlwaysWith = benchmark('mono-always-with', () => monomorphicAlways(inputWith));
const monoAlwaysWithout = benchmark('mono-always-without', () => monomorphicAlways(inputWithout));
console.log(`  WITH ready inputs:                      ${formatOps(monoAlwaysWith).padStart(10)} ops/s`);
console.log(`  WITHOUT ready inputs:                   ${formatOps(monoAlwaysWithout).padStart(10)} ops/s`);

console.log('');
console.log('TEST 4: DISPATCHED - separate functions for each shape');
console.log('-'.repeat(70));

const dispatchWith = benchmark('dispatch-with', () => dispatchedMonomorphic(inputWith));
const dispatchWithout = benchmark('dispatch-without', () => dispatchedMonomorphic(inputWithout));
console.log(`  WITH ready inputs:                      ${formatOps(dispatchWith).padStart(10)} ops/s`);
console.log(`  WITHOUT ready inputs:                   ${formatOps(dispatchWithout).padStart(10)} ops/s`);

console.log('');
console.log('='.repeat(70));
console.log('');

console.log('OUTPUT SEMANTICS:');
console.log('-'.repeat(70));
console.log('');
console.log('Polymorphic (without ready):');
console.log('  ', JSON.stringify(polymorphicPattern(inputWithout)));
console.log('  Keys:', Object.keys(polymorphicPattern(inputWithout)));
console.log('');
console.log('Monomorphic Always (without ready):');
console.log('  ', JSON.stringify(monomorphicAlways(inputWithout)));
console.log('  Keys:', Object.keys(monomorphicAlways(inputWithout)));
console.log('  Has ready key:', 'ready' in monomorphicAlways(inputWithout));
console.log('');
console.log('Dispatched (without ready):');
console.log('  ', JSON.stringify(dispatchedMonomorphic(inputWithout)));
console.log('  Keys:', Object.keys(dispatchedMonomorphic(inputWithout)));

console.log('');
console.log('='.repeat(70));
console.log('');
console.log('CONCLUSION:');
console.log('  - Monomorphic "always include" changes output semantics (has undefined key)');
console.log('  - Dispatched approach keeps semantics but adds function call overhead');
console.log('  - Current polymorphic approach is semantically correct, with some overhead');
