# Handover

*Updated 2026-02-08 (Gen 71)*

## Init Checklist
<!-- Next agent: complete these steps IN ORDER before doing anything else. -->
1. Read this entire handover document
2. Read `CLAUDE.md` for project rules
3. Read `docs/pr-description.md` — comprehensive PR description with all changes cataloged (now titled "Deepkit v2")
4. Run the verification command (below) to confirm expected state
5. Recreate tasks from the Tasks section via `TaskCreate`
6. Check the Suppressed Issues section — do not re-suppress these without noting it

## Architecture Snapshot

```
@deepkit/type-spec       → ReflectionOp bytecode definitions
@deepkit/type-compiler   → TS transformer (compile-time), DeepkitLoader (bundlers)
@deepkit/run             → TS loader (node --import), expect.ts test shim
@deepkit/type            → Runtime types, validation, serialization
@deepkit/core            → Utilities, CompilerContext, DeepkitError base
@deepkit/bson            → BSON serializer/deserializer

Pipeline: TS types → type-compiler → ReflectionOp bytecode → processor VM → Type objects → JIT serialization/validation

Test migration: Jest → node:test + @deepkit/run/expect shim
  bson ✅ | type-compiler ✅ | type ✅
```

## Current State
- **Branch**: `feat/next`
- **Backup branch**: `feat/next-backup` (points to pre-perf-fix state, 306+ messy commits)
- **Active plan**: none
- **Working on**: BSON deserialize performance investigation (user wants >13x vs bson-js)
- **Dirty files**: uncommitted — bson v7 upgrade, PR description update (29 files, see git diff --stat)
- **Failing tests**: none known for bson/type/type-compiler. Consumer packages (rpc, mongo, broker, framework-debug-api) have broken BSON imports (deferred to separate session).
- **Master worktree**: `/Users/marc/bude/deepkit-master` — fully built, has compiled benchmarks (`packages/bson/tsconfig.bench.json` → `dist/bench/`)
- **Verification command**: `git diff --stat` (expect: 29 files changed — bson v7 upgrade + PR description updates)

## Next Steps
1. **Investigate BSON deserialize performance ceiling** — Currently only 5–13x faster than bson-js v7 for deserialization. User considers this insufficient. Compare against manually-written optimal deserializer to find bottleneck. Key benchmarks: `packages/bson/tests/deserialize/perf-regression.spec.ts`. Profile shape JIT code path for overhead.
2. **Fix consumer package BSON imports** — Key broken packages: rpc, mongo, broker, broker-redis, framework-debug-api. See Suppressed Issues for file locations. See `docs/pr-description.md` "Open TODOs" for migration details. (User said: do in separate session)
3. **Commit the dirty files** — bson v7 upgrade + PR description updates need to be committed.

## Alignment Check
- **Goal**: Get feat/next branch ready as Deepkit v2 — all tests passing, performance maximized, clean history
- **Scope boundary**: Consumer package migration is deferred. Do NOT re-squash commits. Focus is on (a) deserialize perf investigation, (b) eventually fixing consumer imports.
- **Plan file**: none
- **Recovery**: `git reset --hard feat/next-backup` restores the 306+ commit history (loses clean squash)

## Tasks
- [ ] **Investigate BSON deserialize perf ceiling** — Deserialize is only 5–13x vs bson-js v7 (serialize is 2–224x). Write a manually-optimized deserializer for a sensor doc to find theoretical max, then compare with generated JIT code. Identify specific overhead sources. [status: pending]
- [ ] **Commit bson v7 upgrade + PR description updates** — 29 dirty files. bson ^4.4.0 → ^7.2.0, 26 test import fixes, 4 threshold adjustments, PR description rewrite. [status: pending]
- [ ] **Fix consumer BSON imports (rpc)** — `packages/rpc/src/protocol.ts` uses Writer, getBSONSizer, BsonStreamReader. HIGH complexity. [status: pending]
- [ ] **Fix consumer BSON imports (mongo)** — `packages/mongo/src/client/connection.ts` uses BSONBinarySerializer, Writer, getBSONSizer. HIGH complexity. [status: pending]
- [ ] **Fix consumer BSON imports (broker + broker-redis)** — broker: tuple destructure, renamed encoder. broker-redis: remove AutoBuffer, fix case. LOW-MEDIUM complexity. [status: pending]
- [ ] **Fix consumer BSON imports (framework-debug-api)** — `packages/framework-debug-api/src/stopwatch-encoding.ts` uses Writer, BaseParser, getBSONSizer, stringByteLength. MEDIUM complexity. [status: pending]

## Benchmark Data

### Fresh clean-run numbers (Gen 71, sequential, bson-js 7.x)

**BSON Serialize (key benchmarks):**

| Benchmark | v2 ops/sec | vs v1 | vs bson-js 7.x |
|-----------|-----------|-------|----------------|
| int32 | 1,198M | 63x | 203x |
| sensor (4 numeric) | 342M | 46x | 153x |
| user profile (6 fields) | 16.8M | 3.4x | 10x |
| API meta (3 strings) | 16.0M | 3.3x | 7x |
| UUID | 24.9M | 4.0x | 6x |
| sensor[] 10 cursor | 8.7M | 11.6x | 39x |
| string[] 100 | 700K | — | 2x |

**BSON Deserialize (key benchmarks):**

| Benchmark | v2 ops/sec | vs v1 | vs bson-js 7.x |
|-----------|-----------|-------|----------------|
| int32 | 186M | 6.5x | 13x |
| sensor (4 numeric) | 23.3M | 1.8x | 10x |
| user profile (6 fields) | 11.6M | — | 7x |
| API meta (3 strings) | 12.7M | 3.4x | 6x |
| UUID | 17.6M | 3.5x | 5x |
| sensor[] 10 cursor | 1.7M | 1.1x | 7.5x |
| string[] 100 | 500K | — | 2.5x |

**Type (fn() API, all 12 beat v1):**

| Benchmark | v2 | v1 | Change |
|-----------|------|------|--------|
| Small serialize | 135.6M | 19.0M | +614% |
| Union serialize | 34.0M | 2.4M | +1317% |
| Small validate | 64.8M | 20.4M | +218% |
| Union validate | 8.4M | 0.5M | +1580% |
| Small is() | 374.2M | 21.1M | +1674% |

## Learnings
- ✅ [2026-02-06] **Type compiler resolves `T | undefined` as optional T, not union** — `prop.optional = true` and `prop.type = UUID`.
- ✅ [2026-02-07] **`isBsonTypeCompatible` must handle union types** — Returning false for ALL unions disabled shape JIT.
- ✅ [2026-02-08] **Always use `@deepkit/bench` (`BenchSuite`)** for benchmarks.
- ✅ [2026-02-08] **Type serializer perf regressions: 3 unbounded fn() rebuilds** — Fix: cache at JIT time.
- ✅ [2026-02-08] **`getBSONSerializer` returns `[sharedBuffer, size]` — buffer is reused across ALL serializers globally**. Callers must copy with `buf.slice(0, size)`.
- ✅ [2026-02-08] **BSONBuildState `forIndex()` must NOT increment depth** — Incrementing depth caused extraction at MAX_DEPTH=3, 60-90x slower for cursor responses.
- ✅ [2026-02-08] **Shape JIT must handle primitive arrays** — Without inline, documents with `string[]`/`number[]` cause shape JIT BAILOUT.
- ✅ [2026-02-08] **BSON array deserialize improvement limited at scale** — Per-element cost ~55-60ns on both branches. Setup overhead amortized across 1000 elements.
- ⚠️ [2026-02-08] **bson-js v7 dropped default export** — Must use `import * as bson from 'bson'` instead of `import bson from 'bson'`. Also removed `@types/bson` (v7 ships own types).
- ⚠️ [2026-02-08] **bson-js v7 is 2–5x faster than v4** — Our absolute perf unchanged, but comparison ratios drop. Thresholds in perf-regression tests adjusted.
- ⚠️ [2026-02-08] **bson-js has no pre-allocated buffer API** — `serialize()` always allocates `Buffer.allocUnsafe()`. No `serializeInto()`. Buffer alloc + GC is their top overhead for small docs (~50-80ns).

## Dead Ends
- [2026-02-04] **"Assumed order" fast-path** — WRONG for MongoDB which returns arbitrary field order.
- [2026-02-07] **Blanket `return false` for unions in `isBsonTypeCompatible`** — Disabled shape JIT for ALL documents with union properties.
- [2026-02-08] **Eager pre-building union guards at JIT time** — Causes infinite recursion for recursive union types. Must use lazy caching.

## Suppressed Issues
- [2026-02-07] `packages/rpc/src/protocol.ts:10-17` — Imports `Writer`, `getBSONSizer`, `BsonStreamReader` (all removed/renamed). Will fail at compile.
- [2026-02-07] `packages/mongo/src/client/connection.ts:13` — Imports `BSONBinarySerializer`, `BsonStreamReader`, `Writer`, `getBSONSizer`. Will fail at compile.
- [2026-02-07] `packages/mongo/src/mongo-serializer.ts:10` — Imports `BSONBinarySerializer`, `ValueWithBSONSerializer`. Will fail at compile.
- [2026-02-07] `packages/mongo/src/client/client.ts:10` — Imports `BSONBinarySerializer`. Will fail at compile.
- [2026-02-07] `packages/broker-redis/src/broker-redis.ts:13` — Imports `AutoBuffer`, uses `getBsonEncoder` (renamed). Will fail at compile.
- [2026-02-07] `packages/framework-debug-api/src/stopwatch-encoding.ts:1-9` — Imports `Writer`, `BaseParser`, `getBSONSizer`, `stringByteLength`. Will fail at compile.
- [2026-02-07] `packages/broker/src/snapshot.ts` — Uses `getBSONSerializer` return as `Uint8Array` (actually `[Uint8Array, number]`). Will fail at runtime.
- [2026-02-07] `packages/broker/src/adapters/deepkit-adapter.ts` — Uses `getBsonEncoder` (renamed). Will fail at compile.
- [2026-02-08] `packages/type/tests/serializer.spec.ts:1153,1180,1204,1363` — 4 tests skipped (`test.skip`): onLoad call (x3), extend with custom type. Pre-existing Jest skips.
- [2026-02-08] `packages/bson/tests/deserialize/perf-regression.spec.ts` — 4 thresholds lowered for bson v7: boolean 5→1.5, number 2→1, UUID (ser) 5→2, string[] (ser) 3→1.5. Not regressions — bson-js v7 is faster.

## Open Questions
- **Why is BSON deserialize only 5–13x vs bson-js v7?** — Serialize is 2–224x faster, but deserialize ceiling is 13x. User considers this unacceptable. Need to profile the generated JIT code against a hand-written optimal deserializer to identify specific bottlenecks. Potential areas: shape JIT overhead, field name parsing, object allocation, property assignment.

## Generation Log
- [2026-02-04] Gen 1-35: BSON rewrite foundations
- [2026-02-06] Gen 36-40: BinaryBigInt, union coercion, constructor properties, Map/Set, embedded
- [2026-02-07] Gen 41-55: BSON rewrite complete — API cleanup, Jest→node:test, perf optimization, union fixes
- [2026-02-08] Gen 56: Created @deepkit/type perf regression tests. Discovered union validation 1000x slower.
- [2026-02-08] Gen 57: Fixed union validation perf — O(1) discriminator dispatch.
- [2026-02-08] Gen 58: ReceiveType overhead optimizations.
- [2026-02-08] Gen 59: Hybrid direct argument passing for ReceiveType.
- [2026-02-08] Gen 60: Node:test migration — bson, type-compiler, type.
- [2026-02-08] Gen 61: Fixed serialize/null issue — `useDefineForClassFields: false`.
- [2026-02-08] Gen 62: Created PR description and commit cleanup plan.
- [2026-02-08] Gen 63: Discovered catastrophic perf regression for nested class types.
- [2026-02-08] Gen 64: Fixed perf regressions (3 bugs in state.ts + handlers.ts).
- [2026-02-08] Gen 65: Handover — perf fix uncommitted.
- [2026-02-08] Gen 66: Benchmarked both branches. Fixed 9 uncached guard rebuilds. Medium validate/is still slow.
- [2026-02-08] Gen 67: Inlined index signatures. ALL 12 type benchmarks beat master.
- [2026-02-08] Gen 68: Ran BSON benchmarks. Found shared-buffer corruption bug in benchmarks. Fixed: all 22 BSON benchmarks beat master. Fixed bson-js comparison benchmark for new API.
- [2026-02-08] Gen 69: Fixed BSON array perf — 60-90x improvement. Deepkit 6-12x faster than bson-js at ALL sizes.
- [2026-02-08] Gen 70: Executed commit plan — squashed 306+ commits into 21 clean semantic commits.
- [2026-02-08] Gen 71: Updated bson-js v4→v7. Fixed 26 test imports, adjusted 4 thresholds. Rewrote PR description as "Deepkit v2" with performance summary. All benchmarks re-run sequentially with clean numbers. User flagged deserialize perf ceiling for investigation.

---
*End of handover. Next: investigate BSON deserialize perf ceiling, then fix consumer BSON imports.*
