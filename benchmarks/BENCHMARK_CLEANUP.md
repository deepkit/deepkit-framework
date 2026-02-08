# Benchmark Cleanup Plan

## Problem Statement

The current benchmarks mix two distinct use cases:

1. **Public Benchmarks** - For CI, documentation, and marketing
2. **Debug Benchmarks** - For local development and profiling

The "fastest" comparison only makes sense when comparing against competitors or meaningful alternatives. Many current benchmarks are internal variations that don't serve the public use case.

---

## Two Benchmark Categories

### 1. Public Benchmarks (`public/`)

**Purpose:** Demonstrate Deepkit's performance characteristics to users and track regressions in CI.

**Requirements:**
- Must compare against real competitors (Zod, Prisma, class-validator, etc.)
- Must represent realistic use cases
- Must be reproducible and stable
- Results are published in documentation/README
- Run in CI on every PR (P0) or nightly (P1/P2)

**Structure:**
```
benchmarks/src/benchmarks/public/
├── validation/
│   ├── vs-zod.bench.ts          # Deepkit vs Zod
│   ├── vs-ajv.bench.ts          # Deepkit vs AJV
│   └── vs-class-validator.bench.ts
├── serialization/
│   ├── vs-class-transformer.bench.ts
│   └── vs-json.bench.ts
├── orm/
│   ├── sqlite-vs-prisma.bench.ts
│   ├── sqlite-vs-drizzle.bench.ts
│   └── sqlite-vs-typeorm.bench.ts
├── rpc/
│   └── vs-grpc.bench.ts
└── bson/
    └── vs-js-bson.bench.ts
```

**Output format:**
- Clear winner/loser labeling
- Percentage faster/slower
- Real ops/sec numbers
- Memory usage where relevant

### 2. Debug Benchmarks (`debug/`)

**Purpose:** Help developers understand performance characteristics during development.

**Use cases:**
- Profile different implementation approaches
- Find performance regressions during refactoring
- Understand V8 optimization behavior
- Test micro-optimizations

**Structure:**
```
benchmarks/src/benchmarks/debug/
├── type/
│   ├── jit-compilation.bench.ts
│   ├── reflection-cache.bench.ts
│   └── serializer-variants.bench.ts
├── injector/
│   ├── resolution-depth.bench.ts
│   └── scope-creation.bench.ts
├── language/
│   ├── string-ops.bench.ts
│   ├── map-vs-object.bench.ts
│   └── prototype-chain.bench.ts
└── bson/
    ├── utf8-decoding.bench.ts
    └── buffer-allocation.bench.ts
```

**Output format:**
- Detailed timing per operation
- Sample distribution visualization (the block bars)
- Memory snapshots
- No "fastest" designation needed (all are Deepkit internals)

---

## Current Benchmarks to Reclassify

### Move to `public/`

| Current Location | New Location | Competitor |
|-----------------|--------------|------------|
| `type/validation.bench.ts` | `public/validation/vs-zod.bench.ts` | Add Zod |
| `type/serialization.bench.ts` | `public/serialization/vs-class-transformer.bench.ts` | Add class-transformer |
| `bson/parser.bench.ts` | `public/bson/vs-js-bson.bench.ts` | Already has js-bson |
| `bson/serializer.bench.ts` | `public/bson/vs-js-bson.bench.ts` | Already has js-bson |

### Move to `debug/`

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `language/*.bench.ts` | `debug/language/` | Internal JS runtime profiling |
| `framework/injector*.bench.ts` | `debug/injector/` | Internal DI profiling |
| `framework/core.bench.ts` | `debug/core/` | Internal async utilities |

### Remove or Merge

| Current | Action | Reason |
|---------|--------|--------|
| BSON UTF-8 size variants | Merge into single | Too granular for public |
| ObjectId.toString() | Move to debug | Internal optimization |
| "baseline" benchmarks | Remove from public | Not meaningful to users |

---

## Implementation Changes

### 1. Update BenchSuite for Different Modes

```typescript
export type BenchmarkMode = 'public' | 'debug';

export class BenchSuite {
    constructor(
        name: string,
        options: {
            mode?: BenchmarkMode;  // 'public' or 'debug'
            competitor?: string;    // For public: name of competitor
        }
    ) { }
}
```

### 2. Update Summary Output

**For public benchmarks (with competitor):**
```
━━━ Validation: Deepkit vs Zod ━━━

  Deepkit    ███████████████  25.4M ops/sec
  Zod        ████             6.2M ops/sec

  Result: Deepkit is 4.1x faster
```

**For debug benchmarks (no competitor):**
```
━━━ Injector Resolution ━━━

  ○ base instantiation     █▂▁▃▂▁▄▂   1.2M ops/sec   ±2.1%
  ○ simple resolver        ▃▂▁▂▃▄▂▁   890K ops/sec   ±1.8%
  ○ scoped get             ▂▂▁▂▂▃▂▁   650K ops/sec   ±3.2%
```

### 3. CI Configuration

```yaml
# P0: Run on every PR (public benchmarks only)
benchmark:p0:
  - public/validation/vs-zod.bench.ts
  - public/serialization/vs-class-transformer.bench.ts
  - public/bson/vs-js-bson.bench.ts

# Nightly: Run all public benchmarks
benchmark:nightly:
  - public/**/*.bench.ts

# Debug: Never run in CI, local only
# debug/**/*.bench.ts
```

---

## Action Items

### Phase 1: Restructure
- [ ] Create `public/` and `debug/` directories
- [ ] Move existing benchmarks to appropriate locations
- [ ] Add competitor comparisons to public benchmarks

### Phase 2: Add Competitors
- [ ] Add Zod to validation benchmark
- [ ] Add class-transformer to serialization benchmark
- [ ] Add Prisma/Drizzle to ORM benchmarks
- [ ] Ensure all public benchmarks have meaningful competitors

### Phase 3: Update Output
- [ ] Modify BenchSuite to support modes
- [ ] Update summary output based on mode
- [ ] Remove "fastest" designation from debug benchmarks

### Phase 4: Documentation
- [ ] Generate public benchmark results for README
- [ ] Create performance comparison charts
- [ ] Document how to run debug benchmarks locally

---

## Guidelines for New Benchmarks

### Adding a Public Benchmark
1. Must include at least one competitor library
2. Must represent a realistic use case
3. Use meaningful data sizes (not micro-benchmarks)
4. Include both simple and complex scenarios
5. Document what's being measured

### Adding a Debug Benchmark
1. Focus on specific implementation details
2. Include sample distribution visualization
3. Can be as granular as needed
4. Don't need competitors
5. Document what you're profiling and why

---

## Example: Proper Public Benchmark

```typescript
// public/validation/vs-zod.bench.ts
import { BenchSuite } from '../../bench';
import { guard } from '@deepkit/type';
import { z } from 'zod';

interface User {
    id: number;
    email: string;
    name: string;
    roles: string[];
    metadata: { lastLogin: Date; preferences: { theme: string } };
}

const zodSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    name: z.string(),
    roles: z.array(z.string()),
    metadata: z.object({
        lastLogin: z.date(),
        preferences: z.object({ theme: z.string() })
    })
});

export default async function() {
    const suite = new BenchSuite('validation/deepkit-vs-zod', {
        mode: 'public',
        competitor: 'Zod'
    });

    const deepkitValidate = guard<User>();
    const zodValidate = (data: unknown) => zodSchema.safeParse(data);

    const validData = { /* ... */ };

    suite.add('Deepkit', () => deepkitValidate(validData), { category: 'p0' });
    suite.add('Zod', () => zodValidate(validData), { category: 'p0' });

    return suite;
}
```

## Example: Proper Debug Benchmark

```typescript
// debug/injector/resolution.bench.ts
import { BenchSuite } from '../../bench';
import { InjectorContext } from '@deepkit/injector';

export default async function() {
    const suite = new BenchSuite('injector/resolution', { mode: 'debug' });

    // Various internal variations to understand performance
    suite.add('depth=1', () => { /* ... */ }, { category: 'p1' });
    suite.add('depth=3', () => { /* ... */ }, { category: 'p1' });
    suite.add('depth=5', () => { /* ... */ }, { category: 'p1' });
    suite.add('with scope', () => { /* ... */ }, { category: 'p1' });

    return suite;
}
```
