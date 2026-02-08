# V8 Pattern Benchmarks

Systematic microbenchmarks for tracking V8 optimization behavior across different code patterns used in Deepkit's JIT-generated code.

## Purpose

1. **Debug optimization approaches** - Identify which code patterns V8 optimizes best
2. **Track V8 behavior over time** - Detect when V8 updates change performance characteristics
3. **Ensure optimal JIT output** - Validate that Deepkit's generated code uses the fastest patterns
4. **Multi-engine preparation** - Future support for JavaScriptCore (Bun), SpiderMonkey, etc.

## Benchmarks

| File                         | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `type-checks.bench.ts`       | `typeof`, `instanceof`, null/undefined checks  |
| `boolean-logic.bench.ts`     | AND/OR chains, short-circuit, nesting patterns |
| `function-creation.bench.ts` | Static vs `new Function()`, IIFE patterns      |
| `property-access.bench.ts`   | Direct, computed, nested, optional chaining    |
| `object-creation.bench.ts`   | Literals, cloning, assignment patterns         |

## Running Benchmarks

```bash
# Single benchmark
cd benchmarks
node --expose-gc --import @deepkit/run src/benchmarks/v8-patterns/type-checks.bench.ts

# All V8 pattern benchmarks
for f in src/benchmarks/v8-patterns/*.bench.ts; do
  echo "=== $f ==="
  node --expose-gc --import @deepkit/run "$f"
done
```

## Key Findings

### Static vs Dynamic Functions

When properly benchmarked with **monomorphic call sites**, `new Function()` performs
**identically** to static functions. Previous benchmarks showing differences were
flawed due to:

1. **Megamorphic call sites** - Testing multiple functions through the same benchmark
   loop causes V8 to deoptimize
2. **Insufficient warmup** - The benchmark loop itself needs to be optimized
3. **IC pollution** - Running different function types causes inline cache misses

### Optimal Patterns for Deepkit

Based on benchmarking:

- **Operand-first comparisons**: `"string" === typeof x` (no difference, but consistent)
- **Flat AND chains**: `a && b && c && d` (no nesting overhead)
- **Inline code**: Flat guards outperform IIFE + helper function patterns by ~4%
- **Direct property access**: `obj.prop` is fastest
- **Object literals**: `{ a: 1, b: 2 }` is faster than sequential assignment

## Methodology

Each benchmark follows these principles:

1. **Monomorphic benchmarks** - Each pattern gets its own dedicated benchmark function
2. **Proper warmup** - Functions are called many times before measurement
3. **DCE prevention** - Results are accumulated and used to prevent dead code elimination
4. **Statistical rigor** - Multiple runs with percentile reporting

## Integration with CI

These benchmarks can be integrated with the existing benchmark infrastructure:

```typescript
import { BenchSuite } from '@deepkit/bench';

import { JsonReporter } from '../reporter/json';

// Set up global reporter
const reporter = new JsonReporter();
BenchSuite.onComplete = (name, results) => {
  reporter.addSuiteResults(name, results);
};

// Run benchmarks...

// Save report
reporter.writeToFile('results/v8-patterns.json');
```

## Adding New Patterns

When adding new benchmarks:

1. Create isolated `BenchSuite` instances for each pattern category
2. Use descriptive names that indicate what's being tested
3. Include both "winning" and "losing" patterns for comparison
4. Document any surprising findings in this README
