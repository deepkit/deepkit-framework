/**
 * Test: Does variable assignment hurt performance vs direct return?
 */

function benchmark(name: string, fn: () => any, iterations: number = 10_000_000): number {
    // Warmup
    for (let i = 0; i < 100000; i++) fn();

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
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(0) + 'M';
    return (ops / 1_000).toFixed(0) + 'K';
}

const input = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

// Pattern 1: Direct return (benchmark's "full literal")
const directReturn = new Function(
    's0',
    `
return {tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
`,
);

// Pattern 2: Variable + return (what we generate)
const varThenReturn = new Function(
    's0',
    `
var s3={tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
return s3;
`,
);

// Pattern 3: Let + return
const letThenReturn = new Function(
    's0',
    `
let s3={tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
return s3;
`,
);

// Pattern 4: Const + return
const constThenReturn = new Function(
    's0',
    `
const s3={tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
return s3;
`,
);

console.log('Variable Assignment vs Direct Return');
console.log('='.repeat(50));
console.log('');

console.log(
    `Direct return {...}:       ${formatOps(benchmark('direct', () => directReturn(input))).padStart(8)} ops/s`,
);
console.log(`var s3={...}; return s3:   ${formatOps(benchmark('var', () => varThenReturn(input))).padStart(8)} ops/s`);
console.log(`let s3={...}; return s3:   ${formatOps(benchmark('let', () => letThenReturn(input))).padStart(8)} ops/s`);
console.log(
    `const s3={...}; return s3: ${formatOps(benchmark('const', () => constThenReturn(input))).padStart(8)} ops/s`,
);

console.log('');
console.log('Generated code:');
console.log('-'.repeat(50));
console.log('Direct:', directReturn.toString().replace(/\n/g, ' '));
console.log('Var:', varThenReturn.toString().replace(/\n/g, ' '));
