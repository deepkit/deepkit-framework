/**
 * V8 Force Optimization Analysis
 *
 * Run with: node --allow-natives-syntax benchmarks/v8-force-opt.js
 */

function directReturn(s0) {
    return {tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name};
}

function varThenReturn(s0) {
    var s3 = {tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name};
    return s3;
}

function withOptional(s0) {
    var s3 = {tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name};
    if ("ready" in s0) {
        s3.ready = s0.ready ?? null;
    }
    return s3;
}

const inputWith = { id: 1, name: 'test', ready: true, tags: ['a', 'b'], priority: 5 };
const inputWithout = { id: 1, name: 'test', tags: ['a', 'b'], priority: 5 };

function getOptStatusString(status) {
    const flags = [];
    if (status & 1) flags.push('function');
    if (status & 2) flags.push('never_opt');
    if (status & 4) flags.push('always_opt');
    if (status & 8) flags.push('maybe_deopted');
    if (status & 16) flags.push('OPTIMIZED');
    if (status & 32) flags.push('TURBOFAN');
    if (status & 64) flags.push('interpreted');
    if (status & 128) flags.push('MAGLEV');
    if (status & 256) flags.push('sparkplug');
    return `${status} [${flags.join(', ')}]`;
}

console.log('=== Before any calls ===');
console.log('directReturn:', getOptStatusString(%GetOptimizationStatus(directReturn)));
console.log('varThenReturn:', getOptStatusString(%GetOptimizationStatus(varThenReturn)));
console.log('withOptional:', getOptStatusString(%GetOptimizationStatus(withOptional)));

console.log('\n=== Warmup (1000 calls each) ===');
for (let i = 0; i < 1000; i++) {
    directReturn(inputWith);
    varThenReturn(inputWith);
    withOptional(inputWith);
}

console.log('directReturn:', getOptStatusString(%GetOptimizationStatus(directReturn)));
console.log('varThenReturn:', getOptStatusString(%GetOptimizationStatus(varThenReturn)));
console.log('withOptional:', getOptStatusString(%GetOptimizationStatus(withOptional)));

console.log('\n=== Force optimize ===');
%OptimizeFunctionOnNextCall(directReturn);
%OptimizeFunctionOnNextCall(varThenReturn);
%OptimizeFunctionOnNextCall(withOptional);

// Trigger the optimization
directReturn(inputWith);
varThenReturn(inputWith);
withOptional(inputWith);

console.log('directReturn:', getOptStatusString(%GetOptimizationStatus(directReturn)));
console.log('varThenReturn:', getOptStatusString(%GetOptimizationStatus(varThenReturn)));
console.log('withOptional:', getOptStatusString(%GetOptimizationStatus(withOptional)));

console.log('\n=== Heavy warmup (100k calls) ===');
for (let i = 0; i < 100000; i++) {
    directReturn(inputWith);
    varThenReturn(inputWith);
    withOptional(inputWith);
}

console.log('directReturn:', getOptStatusString(%GetOptimizationStatus(directReturn)));
console.log('varThenReturn:', getOptStatusString(%GetOptimizationStatus(varThenReturn)));
console.log('withOptional:', getOptStatusString(%GetOptimizationStatus(withOptional)));

// Benchmark with forced optimization
console.log('\n=== Benchmark (after forced opt) ===');

function bench(name, fn, input, iters = 2000000) {
    const acc = [];
    for (let i = 0; i < 10000; i++) acc.push(fn(input));
    acc.length = 0;

    const start = performance.now();
    for (let i = 0; i < iters; i++) acc.push(fn(input));
    const end = performance.now();

    console.log(`${name}: ${(iters / ((end - start) / 1000) / 1e6).toFixed(1)}M ops/s (len=${acc.length})`);
}

bench('directReturn    ', directReturn, inputWith);
bench('varThenReturn   ', varThenReturn, inputWith);
bench('withOptional(+) ', withOptional, inputWith);
bench('withOptional(-) ', withOptional, inputWithout);

console.log('\n=== Final optimization status ===');
console.log('directReturn:', getOptStatusString(%GetOptimizationStatus(directReturn)));
console.log('varThenReturn:', getOptStatusString(%GetOptimizationStatus(varThenReturn)));
console.log('withOptional:', getOptStatusString(%GetOptimizationStatus(withOptional)));
