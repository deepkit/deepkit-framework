# Deepkit Benchmark Infrastructure

Performance benchmarking infrastructure for Deepkit Framework.

## Directory Structure

```
benchmarks/
├── src/
│   ├── runner.ts             # Main benchmark runner and CLI
│   └── reporter/
│       ├── json.ts           # JSON output for CI/CD integration
│       ├── comparison.ts     # Baseline comparison for regression detection
│       ├── markdown.ts       # Markdown report generation
│       └── svg.ts            # SVG chart generation
├── baselines/                # Stored baseline results for comparison
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
cd benchmarks
npm install
```

## Writing Benchmarks

Create a file with `.bench.ts` extension:

```typescript
import { BenchSuite, warmup } from '@deepkit/bench';

export default function() {
    const suite = new BenchSuite('My Benchmark');

    // Warmup the function before benchmarking
    const myFunction = () => { /* ... */ };
    warmup(myFunction);

    // Add synchronous benchmark
    suite.add('sync operation', () => {
        myFunction();
    });

    // Add async benchmark (auto-detected)
    suite.add('async operation', async () => {
        await someAsyncFunction();
    });

    return suite;
}
```

## Running Benchmarks

```bash
# Run core benchmarks (default, for CI)
npm run benchmark

# Run comparison benchmarks (vs external libs)
npm run benchmark:comparison

# Run debug benchmarks (local profiling)
npm run benchmark:debug

# Run all benchmarks
npm run benchmark:all

# Filter benchmarks by name
npm run benchmark -- -f "serialize"

# Output JSON results
npm run benchmark -- -j results.json

# Verbose output
npm run benchmark -- -v
```

## Baseline Comparison

```bash
# Save current results as baseline
npm run benchmark -- --save-baseline

# Compare against baseline (fails if regressions > 20%)
npm run benchmark -- --compare-baseline
```

## CLI Options

```
Options:
  -d, --dir <path>          Directory containing benchmark files
  -p, --pattern <glob>      Glob pattern for benchmark files (default: **/*.bench.ts)
  -j, --json <path>         Output results to JSON file
  -f, --filter <regex>      Filter benchmarks by name
  -t, --max-time <sec>      Maximum time per benchmark in seconds
  -v, --verbose             Verbose output
  --save-baseline           Save results as a new baseline
  --compare-baseline        Compare results against latest baseline
  --baseline-dir <path>     Directory for baseline files
  -h, --help                Show help message
```

## API Reference

### BenchSuite (from @deepkit/bench)

```typescript
import { BenchSuite } from '@deepkit/bench';

class BenchSuite {
    static onComplete?: (name: string, result: BenchSuiteResult) => void;

    constructor(
        name: string,
        defaultMaxTime?: number,  // Default: 1 second
        showSummary?: boolean     // Default: false
    );

    add(name: string, fn: () => void | Promise<void>, options?: BenchmarkOptions): this;
    run(options?: { verbose?: boolean }): void;
    runAsync(options?: { verbose?: boolean }): Promise<BenchSuiteResult>;
    getResults(): BenchSuiteResult;
}
```

### Utilities (from @deepkit/bench)

```typescript
import { warmup, warmupAsync, forceGC, getHeapUsage, formatHz, formatMean } from '@deepkit/bench';

// Warmup functions for V8 optimization
warmup(fn: () => unknown, times?: number): void;
warmupAsync(fn: () => Promise<unknown>, times?: number): Promise<void>;

// Memory utilities (requires --expose-gc)
forceGC(): void;
getHeapUsage(): number;

// Formatting utilities
formatHz(ops: number): string;        // "1.00M"
formatHzFull(ops: number): string;    // "1,000,000.00"
formatMean(ms: number): string;       // "1.000 µs"
formatRme(rme: number): string;       // "±1.50%"
formatBytes(bytes: number): string;   // "1.00 KB"
```

## Benchmark Categories

Benchmarks are organized into categories:

- **core/** - Benchmarks for Deepkit packages (type, bson, injector, etc.)
- **comparison/** - Comparison benchmarks vs external libraries (zod, class-transformer, etc.)
- **debug/** - Debug/profiling benchmarks for internal use

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Run Benchmarks
  run: |
    cd benchmarks
    npm install
    npm run benchmark -- --compare-baseline -j results.json

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: benchmark-results
    path: benchmarks/results.json
```

## Output Example

```
╔════════════════════════════════════════════════════════════╗
║                  DEEPKIT BENCHMARKS                        ║
╚════════════════════════════════════════════════════════════╝

  Node v20.10.0 | darwin arm64
  Found 5 benchmark file(s)

━━━ type/serialization ━━━

  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁   32,456,789.12 ops/sec    30.821 ns/op   ±1.23%  deepkit small serialize
  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁   28,123,456.78 ops/sec    35.557 ns/op   ±0.98%  deepkit small deserialize

All benchmarks complete.
```
