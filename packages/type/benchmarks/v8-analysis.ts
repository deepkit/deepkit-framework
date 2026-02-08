/**
 * V8 Deep Analysis: Why is hybrid not faster when optional is set?
 *
 * Run with V8 flags:
 *   node --print-opt-code --trace-opt --trace-deopt --import @deepkit/run benchmarks/v8-analysis.ts
 *   node --allow-natives-syntax --import @deepkit/run benchmarks/v8-analysis.ts
 */

// Test functions
const oldIncremental = new Function(`return function oldIncremental(s0){
var s1={};
if(("ready" in s0)){
s1.ready=(s0.ready??null);
}
s1.tags=s0.tags;
s1.priority=s0.priority;
s1.id=s0.id;
s1.name=s0.name;
return s1;
}`)();

const newHybrid = new Function(`return function newHybrid(s0){
var s1={tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
if(("ready" in s0)){
s1.ready=(s0.ready??null);
}
return s1;
}`)();

// What if we put optional property IN the literal with conditional?
const literalWithConditional = new Function(`return function literalWithConditional(s0){
return {
tags:s0.tags,
priority:s0.priority,
id:s0.id,
name:s0.name,
...( ("ready" in s0) ? {ready: s0.ready??null} : {})
};
}`)();

// What if ready is always in the literal (even if undefined)?
const literalAlwaysReady = new Function(`return function literalAlwaysReady(s0){
return {
tags:s0.tags,
priority:s0.priority,
id:s0.id,
name:s0.name,
ready: ("ready" in s0) ? (s0.ready??null) : undefined
};
}`)();

// What if we define ready first, then required props?
const hybridReadyFirst = new Function(`return function hybridReadyFirst(s0){
var s1={};
if(("ready" in s0)){
s1.ready=(s0.ready??null);
}
s1.tags=s0.tags;
s1.priority=s0.priority;
s1.id=s0.id;
s1.name=s0.name;
return s1;
}`)();

// Object with fixed shape - ready always present
const fixedShape = new Function(`return function fixedShape(s0){
return {
ready: s0.ready,
tags:s0.tags,
priority:s0.priority,
id:s0.id,
name:s0.name
};
}`)();

// Hybrid but with Object.assign for the optional
const hybridAssign = new Function(`return function hybridAssign(s0){
var s1={tags:s0.tags,priority:s0.priority,id:s0.id,name:s0.name};
if(("ready" in s0)){
Object.assign(s1, {ready: s0.ready??null});
}
return s1;
}`)();

// Test inputs
const inputWithReady = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithoutReady = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

function benchmark(name: string, fn: (input: any) => any, input: any, iterations: number = 2_000_000): number {
    // Warmup - ensure JIT compilation
    for (let i = 0; i < 50000; i++) fn(input);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn(input);
    const end = performance.now();

    return Math.round(iterations / ((end - start) / 1000));
}

function formatOps(ops: number): string {
    if (ops >= 1_000_000) return (ops / 1_000_000).toFixed(2) + 'M';
    if (ops >= 1_000) return (ops / 1_000).toFixed(2) + 'K';
    return ops.toString();
}

console.log('V8 Deep Analysis: Object Shape Transitions');
console.log('='.repeat(80));
console.log('');

console.log('HYPOTHESIS: Adding property to object literal causes hidden class transition');
console.log('');

console.log('WITH ready property (optional IS set):');
console.log('-'.repeat(60));

const tests = [
    ['Old incremental (all props added)', oldIncremental],
    ['New hybrid (literal + add ready)', newHybrid],
    ['Literal with spread conditional', literalWithConditional],
    ['Literal always has ready', literalAlwaysReady],
    ['Fixed shape (ready first)', fixedShape],
    ['Hybrid with Object.assign', hybridAssign],
] as const;

for (const [name, fn] of tests) {
    const ops = benchmark(name, fn, inputWithReady);
    console.log(`  ${name.padEnd(35)} ${formatOps(ops).padStart(10)} ops/s`);
}

console.log('');
console.log('WITHOUT ready property (optional NOT set):');
console.log('-'.repeat(60));

for (const [name, fn] of tests) {
    const ops = benchmark(name, fn, inputWithoutReady);
    console.log(`  ${name.padEnd(35)} ${formatOps(ops).padStart(10)} ops/s`);
}

console.log('');
console.log('='.repeat(80));
console.log('');

// Analysis of object shapes
console.log('OBJECT SHAPE ANALYSIS:');
console.log('-'.repeat(60));
console.log('');

const resultOldWithReady = oldIncremental(inputWithReady);
const resultNewWithReady = newHybrid(inputWithReady);
const resultOldWithout = oldIncremental(inputWithoutReady);
const resultNewWithout = newHybrid(inputWithoutReady);

console.log('Old incremental WITH ready - keys order:', Object.keys(resultOldWithReady));
console.log('New hybrid WITH ready - keys order:', Object.keys(resultNewWithReady));
console.log('Old incremental WITHOUT ready - keys order:', Object.keys(resultOldWithout));
console.log('New hybrid WITHOUT ready - keys order:', Object.keys(resultNewWithout));

console.log('');
console.log('INSIGHT: When we add "ready" to hybrid object, V8 must transition');
console.log('from {tags,priority,id,name} shape to {tags,priority,id,name,ready} shape.');
console.log('This transition has overhead similar to building incrementally.');
console.log('');

// Let's test if property order matters
console.log('PROPERTY ORDER TEST:');
console.log('-'.repeat(60));

const orderedLiteral = new Function(`return function orderedLiteral(s0){
return {
id:s0.id,
name:s0.name,
ready:s0.ready,
tags:s0.tags,
priority:s0.priority
};
}`)();

const reverseOrderLiteral = new Function(`return function reverseOrderLiteral(s0){
return {
priority:s0.priority,
tags:s0.tags,
ready:s0.ready,
name:s0.name,
id:s0.id
};
}`)();

console.log(
    '  Ordered (id,name,ready,tags,priority):',
    formatOps(benchmark('ordered', orderedLiteral, inputWithReady)).padStart(10),
    'ops/s',
);
console.log(
    '  Reverse (priority,tags,ready,name,id):',
    formatOps(benchmark('reverse', reverseOrderLiteral, inputWithReady)).padStart(10),
    'ops/s',
);

console.log('');
console.log('='.repeat(80));
console.log('');
console.log('CONCLUSION:');
console.log('The hybrid approach is ~same speed WITH optional because:');
console.log('1. Adding a property triggers hidden class transition');
console.log('2. V8 optimizes both patterns similarly after warmup');
console.log('3. The real win is when optional is ABSENT (no transition needed)');
