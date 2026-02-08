/**
 * V8 Bytecode and Optimization Analysis
 *
 * Run with:
 *   node --print-bytecode --print-bytecode-filter=* benchmarks/v8-bytecode-analysis.js 2>&1 | head -200
 *   node --trace-opt --trace-deopt benchmarks/v8-bytecode-analysis.js 2>&1
 *   node --allow-natives-syntax benchmarks/v8-bytecode-analysis.js
 */

// Test functions - using plain JS for clean bytecode output
function directReturn(s0) {
    return { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
}

function varThenReturn(s0) {
    var s3 = { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
    return s3;
}

function withOptional(s0) {
    var s3 = { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
    if ('ready' in s0) {
        s3.ready = s0.ready ?? null;
    }
    return s3;
}

// Test inputs
const inputWith = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithout = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

// Force V8 to compile and optimize
function warmup(fn, input, count = 100000) {
    for (let i = 0; i < count; i++) {
        fn(input);
    }
}

// Check optimization status if --allow-natives-syntax is enabled
// Must use eval to avoid parse errors when flag is not set
const checkOptStatus = new Function(
    'fn',
    'name',
    `
    try {
        const status = %GetOptimizationStatus(fn);
        const flags = [];
        if (status & 1) flags.push('is_function');
        if (status & 2) flags.push('never_optimized');
        if (status & 4) flags.push('always_optimized');
        if (status & 8) flags.push('maybe_deopted');
        if (status & 16) flags.push('optimized');
        if (status & 32) flags.push('turbofan');
        if (status & 64) flags.push('interpreted');
        if (status & 128) flags.push('maglev');
        if (status & 256) flags.push('sparkplug');
        console.log(name + ': status=' + status + ' [' + flags.join(', ') + ']');
    } catch(e) {
        console.log(name + ': (natives not available)');
    }
`,
);

console.log('=== V8 Bytecode Analysis ===\n');

// Warmup all functions
console.log('Warming up functions...');
warmup(directReturn, inputWith);
warmup(varThenReturn, inputWith);
warmup(withOptional, inputWith);
warmup(withOptional, inputWithout);

console.log('\n=== Optimization Status ===\n');

try {
    checkOptStatus(directReturn, 'directReturn');
    checkOptStatus(varThenReturn, 'varThenReturn');
    checkOptStatus(withOptional, 'withOptional');
} catch (e) {
    console.log('(Run with --allow-natives-syntax to see optimization status)\n');
}

// Benchmark with result accumulation to prevent DCE
function benchmark(name, fn, input, iterations = 2000000) {
    const results = [];

    // Pre-warmup
    for (let i = 0; i < 50000; i++) results.push(fn(input));
    results.length = 0;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        results.push(fn(input));
    }
    const end = performance.now();

    const opsPerSec = iterations / ((end - start) / 1000);
    console.log(`${name}: ${(opsPerSec / 1000000).toFixed(1)}M ops/s`);

    return results.length; // Use results to prevent elimination
}

console.log('=== Benchmark Results ===\n');

benchmark('directReturn', directReturn, inputWith);
benchmark('varThenReturn', varThenReturn, inputWith);
benchmark('withOptional (has ready)', withOptional, inputWith);
benchmark('withOptional (no ready)', withOptional, inputWithout);

// Mixed input test - this should trigger deoptimization
console.log('\n=== Mixed Input Test (triggers polymorphism) ===\n');

function benchmarkMixed(name, fn, iterations = 2000000) {
    const results = [];

    for (let i = 0; i < 50000; i++) {
        results.push(fn(i % 2 === 0 ? inputWith : inputWithout));
    }
    results.length = 0;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        results.push(fn(i % 2 === 0 ? inputWith : inputWithout));
    }
    const end = performance.now();

    const opsPerSec = iterations / ((end - start) / 1000);
    console.log(`${name} (mixed): ${(opsPerSec / 1000000).toFixed(1)}M ops/s`);

    return results.length;
}

benchmarkMixed('withOptional', withOptional);

console.log('\n=== Object Shape Analysis ===\n');

const r1 = directReturn(inputWith);
const r2 = varThenReturn(inputWith);
const r3 = withOptional(inputWith);
const r4 = withOptional(inputWithout);

console.log('directReturn keys:', Object.keys(r1));
console.log('varThenReturn keys:', Object.keys(r2));
console.log('withOptional(with) keys:', Object.keys(r3));
console.log('withOptional(without) keys:', Object.keys(r4));

console.log('\n=== Done ===');
