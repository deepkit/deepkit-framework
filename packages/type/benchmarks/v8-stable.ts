/**
 * Stable V8 Benchmark - Uses accumulator to prevent dead code elimination
 */

function benchmark(name: string, fn: (acc: any[]) => void, iterations: number = 5_000_000): number {
    const acc: any[] = [];

    // Warmup with same pattern
    for (let i = 0; i < 100000; i++) fn(acc);
    acc.length = 0;

    // Run 5 times, take median
    const runs: number[] = [];
    for (let r = 0; r < 5; r++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) fn(acc);
        const end = performance.now();
        runs.push(iterations / ((end - start) / 1000));
        acc.length = 0;
    }

    // Prevent optimization by using accumulator
    if (acc.length !== 0) console.log('unexpected');

    runs.sort((a, b) => a - b);
    return Math.round(runs[2]); // median
}

function formatOps(ops: number): string {
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(2) + 'M';
    return (ops / 1_000).toFixed(2) + 'K';
}

const inputWith = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithout = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

console.log('Stable V8 Benchmark (with accumulator to prevent DCE)');
console.log('='.repeat(70));
console.log('');

// Pattern A: Current hybrid (what serializer generates)
function patternHybrid(input: any, acc: any[]): void {
    const o: any = { tags: input.tags, priority: input.priority, id: input.id, name: input.name };
    if ('ready' in input) {
        o.ready = input.ready ?? null;
    }
    acc.push(o);
}

// Pattern B: Full literal always (includes undefined for missing optional)
function patternFullLiteral(input: any, acc: any[]): void {
    const o = {
        ready: 'ready' in input ? (input.ready ?? null) : undefined,
        tags: input.tags,
        priority: input.priority,
        id: input.id,
        name: input.name,
    };
    acc.push(o);
}

// Pattern C: Old incremental (what we had before)
function patternIncremental(input: any, acc: any[]): void {
    const o: any = {};
    if ('ready' in input) {
        o.ready = input.ready ?? null;
    }
    o.tags = input.tags;
    o.priority = input.priority;
    o.id = input.id;
    o.name = input.name;
    acc.push(o);
}

// Pattern D: Full literal, no optional handling (theoretical max)
function patternTheoretical(input: any, acc: any[]): void {
    const o = {
        ready: input.ready,
        tags: input.tags,
        priority: input.priority,
        id: input.id,
        name: input.name,
    };
    acc.push(o);
}

console.log('WITH ready property:');
console.log('-'.repeat(70));

console.log(
    `  Theoretical max (no conditionals)  ${formatOps(benchmark('th', acc => patternTheoretical(inputWith, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Full literal + ternary             ${formatOps(benchmark('full', acc => patternFullLiteral(inputWith, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Current hybrid (literal + add)     ${formatOps(benchmark('hybrid', acc => patternHybrid(inputWith, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Old incremental (empty + add all)  ${formatOps(benchmark('inc', acc => patternIncremental(inputWith, acc))).padStart(12)} ops/s`,
);

console.log('');
console.log('WITHOUT ready property:');
console.log('-'.repeat(70));

console.log(
    `  Theoretical max (no conditionals)  ${formatOps(benchmark('th', acc => patternTheoretical(inputWithout, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Full literal + ternary             ${formatOps(benchmark('full', acc => patternFullLiteral(inputWithout, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Current hybrid (literal + add)     ${formatOps(benchmark('hybrid', acc => patternHybrid(inputWithout, acc))).padStart(12)} ops/s`,
);
console.log(
    `  Old incremental (empty + add all)  ${formatOps(benchmark('inc', acc => patternIncremental(inputWithout, acc))).padStart(12)} ops/s`,
);

console.log('');
console.log('='.repeat(70));
console.log('');

console.log('Output verification:');
console.log('-'.repeat(70));

const acc: any[] = [];
patternHybrid(inputWith, acc);
patternFullLiteral(inputWith, acc);
patternIncremental(inputWith, acc);
console.log('WITH ready:');
console.log('  Hybrid:', JSON.stringify(acc[0]), '- keys:', Object.keys(acc[0]));
console.log('  Full:', JSON.stringify(acc[1]), '- keys:', Object.keys(acc[1]));
console.log('  Incremental:', JSON.stringify(acc[2]), '- keys:', Object.keys(acc[2]));

acc.length = 0;
patternHybrid(inputWithout, acc);
patternFullLiteral(inputWithout, acc);
patternIncremental(inputWithout, acc);
console.log('');
console.log('WITHOUT ready:');
console.log('  Hybrid:', JSON.stringify(acc[0]), '- keys:', Object.keys(acc[0]));
console.log('  Full:', JSON.stringify(acc[1]), '- keys:', Object.keys(acc[1]));
console.log('  Incremental:', JSON.stringify(acc[2]), '- keys:', Object.keys(acc[2]));

console.log('');
console.log('SEMANTIC ISSUE:');
console.log('  Full literal has "ready" key even when not in input (value=undefined)');
console.log('  Hybrid/Incremental correctly omit "ready" when not in input');
