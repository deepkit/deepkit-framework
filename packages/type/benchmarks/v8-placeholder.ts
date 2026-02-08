/**
 * V8 Placeholder Pattern: Include optional properties as undefined
 *
 * Hypothesis: If we include optional properties in the literal with undefined,
 * then conditionally set them, we avoid hidden class transitions.
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
    runs.sort((a, b) => a - b);
    return Math.round(runs[1]);
}

function formatOps(ops: number): string {
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(2) + 'M';
    return (ops / 1_000).toFixed(2) + 'K';
}

const inputWith = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithout = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

console.log('V8 Placeholder Pattern Analysis');
console.log('='.repeat(70));
console.log('');

// Current hybrid approach (property added after literal)
const currentHybrid = new Function(
    'input',
    `
var o = {tags:input.tags, priority:input.priority, id:input.id, name:input.name};
if ("ready" in input) {
    o.ready = input.ready ?? null;
}
return o;
`,
);

// Placeholder approach (ready:undefined in literal, then set)
const placeholderApproach = new Function(
    'input',
    `
var o = {ready:undefined, tags:input.tags, priority:input.priority, id:input.id, name:input.name};
if ("ready" in input) {
    o.ready = input.ready ?? null;
}
return o;
`,
);

// Delete undefined (semantic correctness - remove ready if not set)
const placeholderWithDelete = new Function(
    'input',
    `
var o = {ready:undefined, tags:input.tags, priority:input.priority, id:input.id, name:input.name};
if ("ready" in input) {
    o.ready = input.ready ?? null;
} else {
    delete o.ready;
}
return o;
`,
);

// Full literal (theoretical max - includes ready always)
const fullLiteral = new Function(
    'input',
    `
return {ready:input.ready, tags:input.tags, priority:input.priority, id:input.id, name:input.name};
`,
);

// Full literal with nullish coalesce
const fullLiteralNullish = new Function(
    'input',
    `
return {ready:input.ready??null, tags:input.tags, priority:input.priority, id:input.id, name:input.name};
`,
);

// What about ternary in literal?
const literalTernary = new Function(
    'input',
    `
return {
    ready: ("ready" in input) ? (input.ready ?? null) : undefined,
    tags: input.tags,
    priority: input.priority,
    id: input.id,
    name: input.name
};
`,
);

console.log('WITH ready property in input:');
console.log('-'.repeat(70));

const testsWith = [
    ['Current hybrid (literal + add)', currentHybrid],
    ['Placeholder (ready:undefined + set)', placeholderApproach],
    ['Placeholder + delete if not set', placeholderWithDelete],
    ['Full literal (always has ready)', fullLiteral],
    ['Full literal with ??null', fullLiteralNullish],
    ['Literal with ternary', literalTernary],
] as const;

for (const [name, fn] of testsWith) {
    const ops = benchmark(name, () => fn(inputWith));
    console.log(`  ${name.padEnd(40)} ${formatOps(ops).padStart(12)} ops/s`);
}

console.log('');
console.log('WITHOUT ready property in input:');
console.log('-'.repeat(70));

for (const [name, fn] of testsWith) {
    const ops = benchmark(name, () => fn(inputWithout));
    console.log(`  ${name.padEnd(40)} ${formatOps(ops).padStart(12)} ops/s`);
}

console.log('');
console.log('OUTPUT COMPARISON (without ready in input):');
console.log('-'.repeat(70));
console.log('  Current hybrid:', JSON.stringify(currentHybrid(inputWithout)));
console.log('  Placeholder:', JSON.stringify(placeholderApproach(inputWithout)));
console.log('  Placeholder+delete:', JSON.stringify(placeholderWithDelete(inputWithout)));
console.log('  Literal ternary:', JSON.stringify(literalTernary(inputWithout)));

console.log('');
console.log('='.repeat(70));
console.log('');
console.log('SEMANTIC ANALYSIS:');
console.log('-'.repeat(70));
console.log('');
console.log('For serialization, we need:');
console.log('  - ready: true → output has ready: true');
console.log('  - ready: false → output has ready: false');
console.log('  - ready: undefined → output has ready: null (nullable) or omit (optional)');
console.log('  - no ready key → output omits ready');
console.log('');
console.log('The "Literal with ternary" approach:');
console.log('  - Keeps ready:undefined when not in input (may need post-filter)');
console.log('  - Fastest possible for V8 (single object literal)');
console.log('');
console.log('RECOMMENDATION:');
console.log('  For maximum speed: Use full literal with ternary, accept undefined in output');
console.log('  For semantic correctness: Current hybrid is correct but slower');
