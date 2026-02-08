/**
 * V8 Function Creation Patterns
 *
 * Tests static vs dynamic function creation and calling patterns.
 * Critical for validating that Deepkit's JIT approach (new Function)
 * performs equivalently to AOT-compiled code.
 *
 * IMPORTANT: Each function must be benchmarked in isolation to avoid
 * megamorphic call sites which cause V8 deoptimization.
 *
 * Run: node --expose-gc --import @deepkit/run function-creation.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Test data
const testData = {
    number: 1,
    string: 'hello',
    boolean: true,
    nested: { foo: 'bar' },
};

const guardBody = `return "object"===typeof v&&null!==v&&"number"===typeof v.number&&"string"===typeof v.string&&"boolean"===typeof v.boolean&&"object"===typeof v.nested&&null!==v.nested&&"string"===typeof v.nested.foo`;

// ═══════════════════════════════════════════════════════════════════════════════
// Static function patterns
// ═══════════════════════════════════════════════════════════════════════════════

// Static function declaration
const staticFn = function (v: any): boolean {
    return (
        'object' === typeof v &&
        null !== v &&
        'number' === typeof v.number &&
        'string' === typeof v.string &&
        'boolean' === typeof v.boolean &&
        'object' === typeof v.nested &&
        null !== v.nested &&
        'string' === typeof v.nested.foo
    );
};

// Static arrow function
const staticArrow = (v: any): boolean =>
    'object' === typeof v &&
    null !== v &&
    'number' === typeof v.number &&
    'string' === typeof v.string &&
    'boolean' === typeof v.boolean &&
    'object' === typeof v.nested &&
    null !== v.nested &&
    'string' === typeof v.nested.foo;

// Static IIFE pattern (Typia-style)
const staticIife = (() => {
    const checkProps = (v: any): boolean =>
        'number' === typeof v.number &&
        'string' === typeof v.string &&
        'boolean' === typeof v.boolean &&
        'object' === typeof v.nested &&
        null !== v.nested &&
        'string' === typeof v.nested.foo;
    return (v: any): boolean => 'object' === typeof v && null !== v && checkProps(v);
})();

// ═══════════════════════════════════════════════════════════════════════════════
// Dynamic function patterns (new Function)
// ═══════════════════════════════════════════════════════════════════════════════

// Dynamic inline (Deepkit current approach)
const dynamicInline = new Function('v', guardBody) as (v: any) => boolean;

// Dynamic with strict mode
const dynamicStrict = new Function('v', `"use strict";${guardBody}`) as (v: any) => boolean;

// Dynamic IIFE wrapper
const dynamicIife = new Function(`return function(v){${guardBody}}`)() as (v: any) => boolean;

// Dynamic with helper functions (Typia-style)
const dynamicWithHelpers = new Function(`
    const checkProps = (v) =>
        "number"===typeof v.number&&"string"===typeof v.string&&"boolean"===typeof v.boolean&&"object"===typeof v.nested&&null!==v.nested&&"string"===typeof v.nested.foo;
    return (v) => "object"===typeof v&&null!==v&&checkProps(v);
`)() as (v: any) => boolean;

// ═══════════════════════════════════════════════════════════════════════════════
// MONOMORPHIC BENCHMARKS
// Each pattern in its own suite to ensure V8 can optimize independently
// ═══════════════════════════════════════════════════════════════════════════════

const staticFnSuite = new BenchSuite('static function');
staticFnSuite.add('static function', () => staticFn(testData));

const staticArrowSuite = new BenchSuite('static arrow');
staticArrowSuite.add('static arrow', () => staticArrow(testData));

const staticIifeSuite = new BenchSuite('static IIFE (Typia-style)');
staticIifeSuite.add('static IIFE', () => staticIife(testData));

const dynamicInlineSuite = new BenchSuite('dynamic inline (Deepkit)');
dynamicInlineSuite.add('dynamic inline', () => dynamicInline(testData));

const dynamicStrictSuite = new BenchSuite('dynamic strict mode');
dynamicStrictSuite.add('dynamic strict', () => dynamicStrict(testData));

const dynamicIifeSuite = new BenchSuite('dynamic IIFE wrapper');
dynamicIifeSuite.add('dynamic IIFE', () => dynamicIife(testData));

const dynamicHelpersSuite = new BenchSuite('dynamic with helpers');
dynamicHelpersSuite.add('dynamic helpers', () => dynamicWithHelpers(testData));

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites and compare
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  V8 Function Creation Patterns Benchmark                             ║');
    console.log('║                                                                      ║');
    console.log('║  Key insight: new Function() should perform identically to static   ║');
    console.log('║  functions when benchmarked with monomorphic call sites.            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    const results: { name: string; hz: number }[] = [];

    // Run each suite independently
    const suites = [
        { name: 'Static function', suite: staticFnSuite },
        { name: 'Static arrow', suite: staticArrowSuite },
        { name: 'Static IIFE (Typia)', suite: staticIifeSuite },
        { name: 'Dynamic inline (Deepkit)', suite: dynamicInlineSuite },
        { name: 'Dynamic strict', suite: dynamicStrictSuite },
        { name: 'Dynamic IIFE', suite: dynamicIifeSuite },
        { name: 'Dynamic helpers', suite: dynamicHelpersSuite },
    ];

    for (const { name, suite } of suites) {
        const result = await suite.runAsync();
        const hz = Object.values(result)[0]?.hz || 0;
        results.push({ name, hz });
    }

    // Print comparison summary
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  COMPARISON SUMMARY                                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    results.sort((a, b) => b.hz - a.hz);
    const maxHz = results[0].hz;

    console.log('┌────────────────────────────────┬───────────────┬──────────┐');
    console.log('│ Pattern                        │ ops/sec       │ vs best  │');
    console.log('├────────────────────────────────┼───────────────┼──────────┤');

    for (const r of results) {
        const pct = ((r.hz / maxHz) * 100).toFixed(0);
        const hzStr =
            r.hz >= 1e9
                ? (r.hz / 1e9).toFixed(2) + 'B'
                : r.hz >= 1e6
                  ? (r.hz / 1e6).toFixed(1) + 'M'
                  : (r.hz / 1e3).toFixed(1) + 'K';
        console.log(`│ ${r.name.padEnd(30)} │ ${hzStr.padStart(11)} │ ${pct.padStart(6)}% │`);
    }

    console.log('└────────────────────────────────┴───────────────┴──────────┘');

    // Analyze static vs dynamic
    const staticAvg = results.filter(r => r.name.startsWith('Static')).reduce((sum, r) => sum + r.hz, 0) / 3;
    const dynamicAvg = results.filter(r => r.name.startsWith('Dynamic')).reduce((sum, r) => sum + r.hz, 0) / 4;

    const diff = ((staticAvg / dynamicAvg - 1) * 100).toFixed(1);

    console.log('\n=== Analysis ===\n');
    console.log(`Static average:  ${(staticAvg / 1e6).toFixed(1)}M ops/sec`);
    console.log(`Dynamic average: ${(dynamicAvg / 1e6).toFixed(1)}M ops/sec`);
    console.log(`Difference:      ${diff}%`);

    if (Math.abs(parseFloat(diff)) < 5) {
        console.log('\n✅ Static and dynamic functions perform equivalently!');
        console.log('   This confirms new Function() is NOT inherently slower.');
    } else if (parseFloat(diff) > 0) {
        console.log('\n⚠️  Static functions are faster - investigate warmup or call site issues.');
    } else {
        console.log('\n✅ Dynamic functions are faster (unexpected but good).');
    }
}

main().catch(console.error);
