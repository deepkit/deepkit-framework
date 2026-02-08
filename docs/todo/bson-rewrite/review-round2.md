# BSON Review Round 2 — Consolidated Findings

> **Date**: 2026-02-07
> **Reviewers**: 7 agents (architecture, performance, security, clean code, API surface, testing, CTO/CPO)
> **Verdict**: CONDITIONAL GO — fix P0/P1 items, then proceed to consumer migration

---

## P0 — MUST FIX (Blocks Release)

### SEC-C1: Prototype Pollution via `__proto__` Key [CRITICAL]

**Files**: `deserializer.ts:2549`, `parser.ts:185`

When deserializing BSON documents with index signatures (`Record<string, any>`), field names are used directly as property keys on `{}` objects (which have `Object.prototype`). A BSON document with `__proto__` as a field name can pollute `Object.prototype` for the entire Node.js process.

**Affected paths**:
- `buildFieldMatcher` index signature path (`deserializer.ts:2549-2554`)
- `parseDocumentToObject` (`parser.ts:185`) — creates `result` as `{}`, not `Object.create(null)`
- `coerceToType` (`deserializer.ts:1775-1776`) — `Object.assign(instance, value)` copies polluted values

**Fix**: All objects that receive untrusted BSON field names must use `Object.create(null)`. The Builder's `emptyObj()` should produce `Object.create(null)`, or explicitly filter `__proto__`, `constructor`, `__defineGetter__` keys.

- [x] **Status**: DONE — JIT index signature objects now use `Object.create(null)` (deserializer.ts:2038). `parseDocumentToObject` skips `__proto__` keys (parser.ts:185).

### SEC-H1: Missing Bounds Checks on cstring Scans [HIGH]

**Files**: `reader.ts:462-467`, `deserializer.ts:158,438,1533,1567,1837,1815`, `reader.ts:481`

8+ locations where `while(buffer[o++] !== 0)` has no `o < buffer.length` guard. Out-of-bounds reads return `undefined`, and `undefined !== 0` is `true`, causing an infinite CPU loop on malformed BSON.

**Instances**:
- `skipValue` REGEX case (`reader.ts:462-467`)
- `learnShape` field name scan (`deserializer.ts:158`)
- Array element index skip in shape JIT (`deserializer.ts:438`)
- `scanFieldNamesAndTypes` (`deserializer.ts:1533`)
- `deserializeMultiArrayUnion` (`deserializer.ts:1567`)
- `scanObjectFieldNames` (`deserializer.ts:1837`)
- `scanForFieldValue` (`deserializer.ts:1815`)
- `skipField` (`reader.ts:481`)

**Fix**: All cstring scanning loops should include `pos < buffer.length` guard and throw `BSONError` if terminator not found.

- [x] **Status**: DONE — Added bounds checks to: `skipValue` REGEX (reader.ts), `skipField` (reader.ts), `skipBsonValueForShapeLearning` REGEX (deserializer.ts), `scanFieldNamesAndTypes` (deserializer.ts), `deserializeMultiArrayUnion` (deserializer.ts), `scanObjectFieldNames` (deserializer.ts), `scanForFieldValue` (deserializer.ts). Note: `learnShape` (line 158) and shape JIT array skip (line 438) already had `o < end` guards.

### SEC-H2: Missing Bounds Checks on Negative/Overflow Sizes [HIGH]

**Files**: `deserializer.ts:148-150`, `reader.ts:369`

`readInt32LE` can produce negative values from crafted BSON (high bit set in 4-byte size). Negative `docSize` causes `end = offset + docSize - 1` to be before `offset`. Negative string lengths cause `RangeError` in `new Array(-1)`.

**Affected paths**:
- `learnShape` document size (`deserializer.ts:148`)
- `skipBsonValueForShapeLearning` STRING/BINARY/OBJECT/ARRAY sizes (`deserializer.ts:183-196`)
- `readBSONString` string length (`reader.ts:369`)
- `readBinaryValue` binary length (`deserializer.ts:949`)

**Fix**: Validate all sizes read from BSON are non-negative. Add `if (size < 5) throw new BSONError(...)` for document sizes. Add `if (length < 0) throw new BSONError(...)` for string/binary lengths.

- [x] **Status**: DONE — Added negative size validation to: `readBSONString` (reader.ts), `skipValue` STRING/OBJECT/ARRAY/BINARY (reader.ts), `skipBsonValueForShapeLearning` STRING/OBJECT/ARRAY/BINARY (deserializer.ts), `learnShape` docSize (deserializer.ts), `scanFieldNamesAndTypes` docSize (deserializer.ts), `scanObjectFieldNames` docSize (deserializer.ts), `scanForFieldValue` docSize (deserializer.ts), `deserializeMultiArrayUnion` arrSize (deserializer.ts), `readBinaryValue` (deserializer.ts).

### SEC-H3: Unbounded CPU via Crafted BinaryBigInt Size [HIGH]

**Files**: `deserializer.ts:820-827`

`readBinaryBigInt` loops over `size` bytes building a hex string. A crafted size of 2GB = 2 billion iterations. `readSignedBinaryBigInt` has the same issue.

**Fix**: Add maximum size limit for BINARY data (BSON spec limits documents to 16MB).

- [x] **Status**: DONE — Added `MAX_BIGINT_BINARY_SIZE = 16MB` constant. Both `readBinaryBigInt` and `readSignedBinaryBigInt` now validate `size >= 0 && size <= MAX_BIGINT_BINARY_SIZE`.

### API-0: Migrate Consumer Packages [BLOCKING]

5 removed API symbols break 4 consumer packages. Monorepo doesn't compile.

| Removed Symbol | Consumers |
|---|---|
| `Writer` | rpc, mongo, framework-debug-api |
| `getBSONSizer` | rpc, mongo, framework-debug-api |
| `BSONBinarySerializer` | mongo (3 files) |
| `ValueWithBSONSerializer` | mongo |
| `AutoBuffer` | broker-redis |

**Migration order**: broker-redis > framework-debug-api > rpc > mongo

- [ ] **Status**: PENDING (do after P0/P1 fixes)

### API-1: Update README.md [HIGH]

Current README references non-existent APIs (`getBSONDecoder`, `ParserV2/V3`, `parseObject`). Shows old import style `import {t} from '@deepkit/type'`.

- [ ] **Status**: PENDING

---

## P1 — SHOULD FIX (Before GA)

### SEC-H4: ReDoS via Untrusted REGEX Patterns [HIGH]

**Files**: `deserializer.ts:928`, `parser.ts:159`

BSON REGEX values are deserialized into `new RegExp(pattern, flags)`. Crafted regex patterns can cause catastrophic backtracking.

**Fix**: Document that RegExp types should not be used with untrusted BSON. Consider pattern complexity limits.

- [ ] **Status**: PENDING

### SEC-M3: No Maximum Document Nesting Depth [MEDIUM]

**File**: `deserializer.ts` (general)

Extracted deserializers have no runtime depth limit. 10,000-level nesting causes stack overflow. `BSONBuildState.MAX_DEPTH = 3` only limits JIT nesting, not runtime.

**Fix**: Add runtime depth counter, throw BSONError at configurable limit (e.g., 100).

- [ ] **Status**: PENDING

### PERF-P3: `serializeBSONWithoutOptimiser` Allocates 1MB Every Call [MEDIUM]

**File**: `api.ts:91-96`

Creates `new Uint8Array(1024 * 1024)` on every call. Should use shared buffer.

- [x] **Status**: DONE — Uses shared `untypedBuffer`/`untypedView` module-level variables.

### PERF-P1: `serializeAnyPropertyRuntime` Creates TextEncoder Per Call [MEDIUM]

**File**: `serializer.ts:627`

`new TextEncoder().encode(value)` should use module-level `textEncoder` instance. ~30% regression on any-typed string serialization.

- [x] **Status**: DONE — Uses module-level `textEncoder`.

### PERF-P7: No Bounds Checking/Growth for Shared Serializer Buffer [MEDIUM-HIGH]

**File**: `serializer.ts:148`

Serializer writes `buffer[offset++] = ...` without checking `offset < buffer.length`. Documents >1MB cause silent corruption or RangeError. No growth logic.

- [ ] **Status**: PENDING

### API-2: Fix Naming Inconsistency [MEDIUM]

- `getBsonEncoder` should be `getBSONEncoder`
- `BsonStreamReader` should be `BSONStreamReader`

All other symbols use `BSON` prefix.

- [ ] **Status**: PENDING

### API-3: Remove/Fix `BSONSerializer<T>` Type Alias [MEDIUM]

**File**: `types.ts:111`

Defined as `(data: T) => Uint8Array` but actual return is `[Uint8Array, number]`. Unused and misleading.

- [ ] **Status**: PENDING

### API-4: Stop Exporting @internal Symbols [MEDIUM]

~35 `@internal` functions exported via `export *` in `index.ts`. Use explicit named exports instead.

Affected: all `read*`/`write*` from reader.ts/serializer.ts, `hexTable`/`hexTable2`/`hexToByte`/`uuidStringToByte`, `BSONBuildState`, `PropertyName`, `isInt32`, `skipCString`, `skipValue`, `skipField`, `decodeUTF8`.

- [ ] **Status**: PENDING

### CLEAN-1: Remove Dead Code [LOW]

- `scanFieldNames()` — `deserializer.ts:1512` (never called)
- `makeMissingFieldError()` — `deserializer.ts:3945` (never called, unused param)
- ~~`readCStringHelper()` — `deserializer.ts:3907` (trivial wrapper)~~ NOT dead — used by JIT builder at lines 2550, 3292
- Dead `consumed` variables — `deserializer.ts:893-894,915-916`
- Dead `u32` member on BSONWriter — `writer.ts`

- [x] **Status**: DONE (partial) — Removed `scanFieldNames`, `makeMissingFieldError`, dead `consumed` vars. Kept `readCStringHelper` (used by JIT). `u32` on BSONWriter deferred to P2.

### CLEAN-2: Fix Misleading `readBytesAsHex` Length Parameter [LOW]

**File**: `reader.ts:389`

`length` parameter is completely ignored — function always reads exactly 12 bytes. Either rename to `readObjectIdAsHex` or implement the parameter.

- [ ] **Status**: PENDING

### ARCH-1: `circularExit` Not Called on Serialization Error [MEDIUM]

**File**: `serializer.ts:1522-1553`

If serialization throws mid-way through a circular type, `circularExit` is never called (no try/finally). Global Set retains stale entries.

- [ ] **Status**: PENDING

---

## P2 — NICE TO HAVE (Post-Release)

### Architecture
- Shape dispatcher first-byte collision limits optimization for types sharing first field byte
- No plugin/extension mechanism for custom BSON type handlers
- Shape learning never evicts (unbounded for polymorphic collections)
- Split `deserializer.ts` (4,055 lines) — extract shape-learning into own module
- `fnJITTop` separation critical for V8 but undocumented/fragile

### Clean Code
- Eliminate `skipBsonValueForShapeLearning` duplication with `skipValue`
- Consolidate `readObjectIdHex`/`readInt32LE` duplications between deserializer and reader
- Use more specific DK-B error codes (most use default DK-B001)
- Extract `DEFAULT_SHARED_BUFFER_SIZE` constant, document `canUnroll` threshold of 24
- ~25 `as any` from Builder API limitations (index setting)

### Performance
- Add benchmarks for Map/Set, unions, `any` type, Embedded, index signatures
- Shape dispatcher could use multi-byte signature to avoid first-byte collisions
- `learnShape` allocates temporary `nameBytes` arrays (cold path, low impact)

### Testing
- Add tests for deprecated BSON types (TIMESTAMP, DECIMAL128, CODE)
- Add `BSONWriter` unit tests
- Add `reader.ts` boundary tests (decodeUTF8 at 12/13/64/65 byte boundaries)
- Add `ObjectId.generate()` tests
- Add buffer reuse safety test
- Add generic container type tests (`class Box<T> { v: T }`)
- Add error code verification tests
- Consolidate redundant test files (all-primitives vs fixed-size-types vs new-primitives)
- Document shared reader state is not Worker-safe
- Truncate data values in error messages

### API
- Decide on `parser.ts` public API stability (mark parse functions @internal?)
- Add `@example` JSDoc to core API functions
- Consider moving general-purpose utilities (Writer, stringByteLength) to `@deepkit/core`
- Add migration guide document

---

## Performance Baseline (Confirmed)

| Metric | Value |
|---|---|
| int32 deserialization (manual loop) | 34.4M ops/sec |
| int32 deserialization (BenchSuite) | 2.0M ops/sec |
| float64 deserialization | 1.6M ops/sec |
| string short deserialization | 1.4M ops/sec |
| UUID deserialization | 1.3M ops/sec |
| minimal doc (_id only) | 7.7M ops/sec |
| vs bson-js | 50-100x faster |
| Test suite | 490/490 pass, 55.4s |

---

## Review Team Ratings

| Reviewer | Rating | Summary |
|---|---|---|
| Architecture | A- | Sound design, shape learning is novel, some duplication |
| Performance | A+ | Deep V8 knowledge, 34M ops/sec confirmed |
| Security | B- | Critical prototype pollution, multiple bounds check gaps |
| Clean Code | B+ | Very clean after round 1, minor dead code |
| Public API | B | ~35 internal symbols leaked, naming inconsistency |
| Testing | A- | 490 tests, good coverage, gaps in edge cases |
| CTO/CPO | Conditional GO | Core ready, consumer migration blocks release |
