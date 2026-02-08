/**
 * JIT vs Exec Mode Performance Comparison
 *
 * Compares performance between:
 * - JIT mode: Compiles to native JavaScript functions (fnJIT)
 * - Exec mode: Interprets expression tree at runtime (fnExec)
 *
 * This shows the performance impact of running in CSP-regulated environments
 * that block new Function() and eval().
 *
 * Run: node --import @deepkit/run benchmarks/jit-vs-exec.ts
 */
import { Builder, Ref, arg, fn, fnExec, fnJIT } from '@deepkit/core';

// ============================================================================
// Test Models
// ============================================================================

interface SimpleModel {
    id: number;
    name: string;
    active: boolean;
}

interface NestedModel {
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

// ============================================================================
// Test Data
// ============================================================================

const simpleData: SimpleModel = {
    id: 1,
    name: 'test',
    active: true,
};

const nestedData: NestedModel = {
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

// ============================================================================
// Build Functions Using JIT and Exec Modes
// ============================================================================

// Simple type guard (3 property checks)
const simpleGuardJIT = fnJIT<boolean>(arg<unknown>(), (b: Builder, input: Ref<unknown>) => {
    return b.and(
        b.and(
            b.and(b.isType(input, 'object'), b.not(b.eq(input, b.lit(null)))),
            b.isType(input.get('id' as any), 'number'),
        ),
        b.and(b.isType(input.get('name' as any), 'string'), b.isType(input.get('active' as any), 'boolean')),
    );
});

const simpleGuardExec = fnExec<boolean>(arg<unknown>(), (b: Builder, input: Ref<unknown>) => {
    return b.and(
        b.and(
            b.and(b.isType(input, 'object'), b.not(b.eq(input, b.lit(null)))),
            b.isType(input.get('id' as any), 'number'),
        ),
        b.and(b.isType(input.get('name' as any), 'string'), b.isType(input.get('active' as any), 'boolean')),
    );
});

// Nested type guard (7 property checks + nested object)
const nestedGuardJIT = fnJIT<boolean>(arg<unknown>(), (b: Builder, input: Ref<unknown>) => {
    const isObj = b.and(b.isType(input, 'object'), b.not(b.eq(input, b.lit(null))));
    const nested = input.get('deeplyNested' as any);
    const nestedIsObj = b.and(b.isType(nested, 'object'), b.not(b.eq(nested, b.lit(null))));

    return b.and(
        b.and(isObj, b.isType(input.get('number' as any), 'number')),
        b.and(
            b.and(b.isType(input.get('negNumber' as any), 'number'), b.isType(input.get('maxNumber' as any), 'number')),
            b.and(
                b.and(
                    b.isType(input.get('string' as any), 'string'),
                    b.isType(input.get('longString' as any), 'string'),
                ),
                b.and(
                    b.isType(input.get('boolean' as any), 'boolean'),
                    b.and(
                        nestedIsObj,
                        b.and(
                            b.isType(nested.get('foo' as any), 'string'),
                            b.and(
                                b.isType(nested.get('num' as any), 'number'),
                                b.isType(nested.get('bool' as any), 'boolean'),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    );
});

const nestedGuardExec = fnExec<boolean>(arg<unknown>(), (b: Builder, input: Ref<unknown>) => {
    const isObj = b.and(b.isType(input, 'object'), b.not(b.eq(input, b.lit(null))));
    const nested = input.get('deeplyNested' as any);
    const nestedIsObj = b.and(b.isType(nested, 'object'), b.not(b.eq(nested, b.lit(null))));

    return b.and(
        b.and(isObj, b.isType(input.get('number' as any), 'number')),
        b.and(
            b.and(b.isType(input.get('negNumber' as any), 'number'), b.isType(input.get('maxNumber' as any), 'number')),
            b.and(
                b.and(
                    b.isType(input.get('string' as any), 'string'),
                    b.isType(input.get('longString' as any), 'string'),
                ),
                b.and(
                    b.isType(input.get('boolean' as any), 'boolean'),
                    b.and(
                        nestedIsObj,
                        b.and(
                            b.isType(nested.get('foo' as any), 'string'),
                            b.and(
                                b.isType(nested.get('num' as any), 'number'),
                                b.isType(nested.get('bool' as any), 'boolean'),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    );
});

// Simple serializer (copy 3 properties)
const simpleSerializeJIT = fnJIT<SimpleModel>(arg<SimpleModel>(), (b: Builder, input: Ref<SimpleModel>) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        active: input.get('active'),
    });
});

const simpleSerializeExec = fnExec<SimpleModel>(arg<SimpleModel>(), (b: Builder, input: Ref<SimpleModel>) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        active: input.get('active'),
    });
});

// Nested serializer (copy 7 properties + nested object)
const nestedSerializeJIT = fnJIT<NestedModel>(arg<NestedModel>(), (b: Builder, input: Ref<NestedModel>) => {
    const nested = input.get('deeplyNested');
    return b.obj({
        number: input.get('number'),
        negNumber: input.get('negNumber'),
        maxNumber: input.get('maxNumber'),
        string: input.get('string'),
        longString: input.get('longString'),
        boolean: input.get('boolean'),
        deeplyNested: b.obj({
            foo: nested.get('foo'),
            num: nested.get('num'),
            bool: nested.get('bool'),
        }),
    });
});

const nestedSerializeExec = fnExec<NestedModel>(arg<NestedModel>(), (b: Builder, input: Ref<NestedModel>) => {
    const nested = input.get('deeplyNested');
    return b.obj({
        number: input.get('number'),
        negNumber: input.get('negNumber'),
        maxNumber: input.get('maxNumber'),
        string: input.get('string'),
        longString: input.get('longString'),
        boolean: input.get('boolean'),
        deeplyNested: b.obj({
            foo: nested.get('foo'),
            num: nested.get('num'),
            bool: nested.get('bool'),
        }),
    });
});

// ============================================================================
// Benchmark Utilities
// ============================================================================

function benchmark(name: string, fn: () => any, iterations: number = 1_000_000): { ops: number; time: number } {
    const acc: any[] = [];

    // Warmup
    for (let i = 0; i < 10000; i++) acc.push(fn());
    acc.length = 0;

    // Run 5 times, take best
    const runs: number[] = [];
    for (let run = 0; run < 5; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) acc.push(fn());
        const end = performance.now();
        runs.push(end - start);
        acc.length = 0;
    }

    runs.sort((a, b) => a - b);
    const bestTime = runs[0];
    const ops = Math.round(iterations / (bestTime / 1000));

    return { ops, time: bestTime };
}

function formatOps(ops: number): string {
    if (ops >= 1e6) return (ops / 1e6).toFixed(2) + 'M';
    if (ops >= 1e3) return (ops / 1e3).toFixed(0) + 'K';
    return ops.toString();
}

function printResults(
    title: string,
    results: Array<{ name: string; jit: { ops: number; time: number }; exec: { ops: number; time: number } }>,
) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(` ${title}`);
    console.log(`${'═'.repeat(80)}`);

    console.log('┌────────────────────┬─────────────────┬─────────────────┬──────────────────┐');
    console.log('│ Model              │ JIT ops/sec     │ Exec ops/sec    │ JIT/Exec Ratio   │');
    console.log('├────────────────────┼─────────────────┼─────────────────┼──────────────────┤');

    for (const r of results) {
        const ratio = (r.jit.ops / r.exec.ops).toFixed(1) + 'x';
        console.log(
            `│ ${r.name.padEnd(18)} │ ${formatOps(r.jit.ops).padStart(13)} │ ${formatOps(r.exec.ops).padStart(13)} │ ${ratio.padStart(14)} │`,
        );
    }

    console.log('└────────────────────┴─────────────────┴─────────────────┴──────────────────┘');
}

// ============================================================================
// Run Benchmarks
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║           JIT vs EXEC Mode Performance Comparison                     ║');
console.log('╠══════════════════════════════════════════════════════════════════════╣');
console.log('║  JIT Mode:  Compiles to native JavaScript (uses new Function())      ║');
console.log('║  Exec Mode: Interprets expression tree (CSP-compliant, no eval)      ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

// Verify correctness first
console.log('\n--- Correctness Check ---');
console.log(`Simple Guard - JIT: ${simpleGuardJIT(simpleData)}, Exec: ${simpleGuardExec(simpleData)}`);
console.log(`Nested Guard - JIT: ${nestedGuardJIT(nestedData)}, Exec: ${nestedGuardExec(nestedData)}`);
console.log(`Simple Serialize - JIT: ${JSON.stringify(simpleSerializeJIT(simpleData))}`);
console.log(`Simple Serialize - Exec: ${JSON.stringify(simpleSerializeExec(simpleData))}`);

// Show generated JIT code
console.log('\n--- Generated JIT Code (Simple Guard) ---');
console.log(simpleGuardJIT.toString());

// Type Guards
const typeGuardResults = [
    {
        name: 'Simple (3 props)',
        jit: benchmark('simple-jit', () => simpleGuardJIT(simpleData)),
        exec: benchmark('simple-exec', () => simpleGuardExec(simpleData)),
    },
    {
        name: 'Nested (10 props)',
        jit: benchmark('nested-jit', () => nestedGuardJIT(nestedData)),
        exec: benchmark('nested-exec', () => nestedGuardExec(nestedData)),
    },
];

printResults('Type Guards', typeGuardResults);

// Serialization
const serializeResults = [
    {
        name: 'Simple (3 props)',
        jit: benchmark('simple-jit', () => simpleSerializeJIT(simpleData)),
        exec: benchmark('simple-exec', () => simpleSerializeExec(simpleData)),
    },
    {
        name: 'Nested (10 props)',
        jit: benchmark('nested-jit', () => nestedSerializeJIT(nestedData)),
        exec: benchmark('nested-exec', () => nestedSerializeExec(nestedData)),
    },
];

printResults('Serialization (object copy)', serializeResults);

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '═'.repeat(80));
console.log(' SUMMARY');
console.log('═'.repeat(80));

const allResults = [...typeGuardResults, ...serializeResults];
const avgRatio = allResults.reduce((sum, r) => sum + r.jit.ops / r.exec.ops, 0) / allResults.length;
const minRatio = Math.min(...allResults.map(r => r.jit.ops / r.exec.ops));
const maxRatio = Math.max(...allResults.map(r => r.jit.ops / r.exec.ops));

console.log(`\nPerformance Impact of CSP-Compliant (Exec) Mode:`);
console.log(`  Average: JIT is ${avgRatio.toFixed(1)}x faster than Exec`);
console.log(`  Range: ${minRatio.toFixed(1)}x - ${maxRatio.toFixed(1)}x`);
console.log(`\nNote: Exec mode is required for CSP-regulated environments that block`);
console.log(`      new Function() and eval(). The performance cost is significant.`);
console.log(`\n      Deepkit uses tiered execution (fn) which starts in exec mode`);
console.log(`      for fast startup, then JIT-compiles hot functions automatically.`);
