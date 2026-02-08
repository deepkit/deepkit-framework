/**
 * V8 Hidden Class Analysis: Property Order and Transitions
 *
 * Key question: Does adding a property to an object literal cause deoptimization?
 */

function benchmark(name: string, fn: () => void, iterations: number = 5_000_000): number {
    // Warmup
    for (let i = 0; i < 100000; i++) fn();

    // Multiple runs for stability
    const runs: number[] = [];
    for (let run = 0; run < 3; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) fn();
        const end = performance.now();
        runs.push(iterations / ((end - start) / 1000));
    }

    // Return median
    runs.sort((a, b) => a - b);
    return Math.round(runs[1]);
}

function formatOps(ops: number): string {
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(2) + 'M';
    return (ops / 1_000).toFixed(2) + 'K';
}

const input = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };

console.log('V8 Hidden Class Analysis');
console.log('='.repeat(70));
console.log('');

// Test 1: Object literal - all properties at once
const allAtOnce = new Function(
    'input',
    `
return {
    id: input.id,
    name: input.name,
    ready: input.ready,
    tags: input.tags,
    priority: input.priority
};
`,
);

// Test 2: Empty object + add all properties
const emptyPlusAll = new Function(
    'input',
    `
var o = {};
o.id = input.id;
o.name = input.name;
o.ready = input.ready;
o.tags = input.tags;
o.priority = input.priority;
return o;
`,
);

// Test 3: Partial literal + add one property
const partialPlusOne = new Function(
    'input',
    `
var o = {
    id: input.id,
    name: input.name,
    tags: input.tags,
    priority: input.priority
};
o.ready = input.ready;
return o;
`,
);

// Test 4: Partial literal + conditional add
const partialConditional = new Function(
    'input',
    `
var o = {
    id: input.id,
    name: input.name,
    tags: input.tags,
    priority: input.priority
};
if ("ready" in input) {
    o.ready = input.ready;
}
return o;
`,
);

// Test 5: Empty + conditional first + rest
const emptyConditionalFirst = new Function(
    'input',
    `
var o = {};
if ("ready" in input) {
    o.ready = input.ready;
}
o.id = input.id;
o.name = input.name;
o.tags = input.tags;
o.priority = input.priority;
return o;
`,
);

// Test 6: Literal with ready placeholder
const literalWithPlaceholder = new Function(
    'input',
    `
var o = {
    id: input.id,
    name: input.name,
    ready: undefined,
    tags: input.tags,
    priority: input.priority
};
if ("ready" in input) {
    o.ready = input.ready;
}
return o;
`,
);

console.log('All tests use SAME input with ready=true');
console.log('');

const tests = [
    ['1. Full literal {a,b,c,d,e}', () => allAtOnce(input)],
    ['2. Empty {} + add all props', () => emptyPlusAll(input)],
    ['3. Partial {a,b,c,d} + add e', () => partialPlusOne(input)],
    ['4. Partial {a,b,c,d} + if add e', () => partialConditional(input)],
    ['5. Empty + if add e + add rest', () => emptyConditionalFirst(input)],
    ['6. Literal with e:undefined + set', () => literalWithPlaceholder(input)],
] as const;

console.log('Pattern'.padEnd(40) + 'Speed'.padStart(15));
console.log('-'.repeat(55));

const results: Array<[string, number]> = [];
for (const [name, fn] of tests) {
    const ops = benchmark(name, fn);
    results.push([name, ops]);
    console.log(`${name.padEnd(40)} ${formatOps(ops).padStart(15)} ops/s`);
}

console.log('');
console.log('='.repeat(70));
console.log('');

// Find fastest
const sorted = [...results].sort((a, b) => b[1] - a[1]);
console.log('RANKING (fastest to slowest):');
sorted.forEach(([name, ops], i) => {
    const pct = ((ops / sorted[0][1]) * 100).toFixed(0);
    console.log(`  ${i + 1}. ${name} (${pct}%)`);
});

console.log('');
console.log('ANALYSIS:');
console.log('-'.repeat(70));

const fullLiteral = results[0][1];
const partialPlus = results[2][1];
const ratio = ((partialPlus / fullLiteral) * 100).toFixed(0);

console.log(`Full literal vs Partial+add: ${ratio}%`);
console.log('');

if (partialPlus < fullLiteral * 0.9) {
    console.log(
        'FINDING: Adding property to object literal causes ~' +
            Math.round((1 - partialPlus / fullLiteral) * 100) +
            '% slowdown',
    );
    console.log('');
    console.log('This is due to V8 hidden class transitions:');
    console.log('  - Object literal creates object with fixed hidden class');
    console.log('  - Adding property triggers transition to new hidden class');
    console.log('  - This transition has runtime cost');
} else {
    console.log('FINDING: V8 handles property addition efficiently');
}

console.log('');
console.log('Generated code for comparison:');
console.log('');
console.log('Pattern 3 (partial + add):');
console.log(partialPlusOne.toString());
console.log('');
console.log('Pattern 5 (empty + conditional first):');
console.log(emptyConditionalFirst.toString());
