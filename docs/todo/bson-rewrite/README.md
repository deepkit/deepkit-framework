# @deepkit/bson Rewrite - Clean Slate with jit.ts

## Overview

Complete rewrite of @deepkit/bson using the new `jit.ts` architecture from `@deepkit/core`.
Goal: Optimal binary serialization performance through V8 bytecode analysis and micro-benchmarks.

**Approach:** Delete `src/` entirely, rewrite from scratch. Use `git show HEAD:packages/bson/src/<file>` to reference old implementation when needed.

**NOT a migration** - complete rewrite maintaining public API compatibility.

---

## Document Index

| Document | Purpose |
|----------|---------|
| **README.md** (this file) | Master tracker: phases, status, API baseline, decisions |
| **[SERIALIZATION-STRATEGY.md](./SERIALIZATION-STRATEGY.md)** | JIT code generation rules for serialization |
| **[DESERIALIZATION-STRATEGY.md](./DESERIALIZATION-STRATEGY.md)** | JIT code generation rules for deserialization |
| **[SERIALIZER-REVIEW.md](./SERIALIZER-REVIEW.md)** | Architectural review: gaps vs type serializer, action items |
| **[COMPARISON.md](./COMPARISON.md)** | Current vs optimal implementation comparison (PR description) |
| **[FEATURE-INVENTORY.md](./FEATURE-INVENTORY.md)** | Complete feature catalog to preserve in rewrite |
| **[test-cleanup-plan.md](./test-cleanup-plan.md)** | Test import fixes and internal API cleanup |

**Benchmarks:** `packages/bson/benchmarks/` (40+ files)
Run with: `node --import @deepkit/run benchmarks/<filename>.ts`

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Baseline | ✅ Complete | API documented, benchmarks saved |
| Phase 1: Test Cleanup | ✅ Complete | Imports fixed to use index.js |
| Phase 2: Design | ✅ Complete | See SERIALIZATION-STRATEGY.md, DESERIALIZATION-STRATEGY.md |
| Phase 1b: Test Restructure | ✅ Complete | Tests reorganized, comprehensive coverage written |
| Phase 3: Implementation | ✅ Complete | Rewritten with jit.ts Builder API, zero `new Function()` |
| **Phase 4: Stabilization** | 🔧 **IN PROGRESS** | Fixing remaining test failures, coercion gaps, string perf |

**Implementation complete.** The BSON package has been fully rewritten using the `jit.ts` Builder API from `@deepkit/core`. Source uses `Builder`, `fn()`, `Ref` throughout — zero `new Function()`, zero `CompilerContext`.

**Remaining work (stabilization):**
- 20 type-spec.spec.ts failures (legacy roundtrip tests)
- 13 coercion.spec.ts failures (string→bigint, boolean from string, null/undefined validation, literal defaults)
- encoder.spec.ts: `getBsonEncoder` API not yet implemented
- edge-cases.spec.ts / roundtrip/type-spec.spec.ts: reference APIs not yet wired up
- String deserialization performance (1.2M ops/sec, only 1.1x vs bson-js)
- 1 stream.spec.ts failure

---

## Concrete Workflow

**Before touching `src/` at all:**

1. **Phase 0: Capture baseline** ✓ (done - API documented, benchmarks saved)

2. **Phase 1: Test cleanup** ✓ (mostly done)
   - [x] Analyze test dependencies on internal APIs
   - [x] Fix imports to use public index (`../index.js` instead of `../src/*.js`)
   - [ ] Review AutoBuffer._buffer tests (defer to rewrite - implementation detail)

3. **Phase 2: Design with micro-benchmarks** ✓ (done)
   - [x] Create micro-benchmarks for key decisions (buffer strategy, type dispatch, etc.)
   - [x] Run V8 analysis on patterns
   - [x] Document architecture decisions
   - See SERIALIZATION-STRATEGY.md and DESERIALIZATION-STRATEGY.md

4. **Phase 1b: Test Restructure** ✅ Complete
   - Reorganized `tests/` into `tests/serialize/`, `tests/deserialize/`, and `tests/roundtrip/`
   - Created comprehensive test coverage for all BSON types
   - Tests ready for verification once Phase 3 completes
   - See [Test Restructure Plan](#phase-1b-test-restructure-plan) below

5. **Phase 3: Implementation** ✅ Complete
   - Serializer rewritten with Builder API (`fn()`, `Builder`, `Ref`)
   - Deserializer rewritten with Builder API + shape learning
   - Zero `new Function()`, zero `CompilerContext`
   - Source: 7,844 lines (serializer: 2,595, deserializer: 3,804, supporting: 1,445)

6. **Phase 4: Stabilization** 🔧 IN PROGRESS
   - All tests pass
   - Benchmarks match or beat baseline
   - V8 deoptimization check
   - Memory profiling

---

## Phase 1b: Test Restructure Plan

**Goal:** Reorganize tests before rewrite to:
1. Separate serialization and deserialization concerns
2. Ensure complete coverage for every BSON type
3. Make it easy to verify each piece as we implement

**Proposed structure:**
```
tests/
├── serialize/
│   ├── primitives.spec.ts      # string, number, boolean, null, undefined
│   ├── binary.spec.ts          # Uint8Array, ArrayBuffer, TypedArrays
│   ├── objects.spec.ts         # object literals, classes, nested
│   ├── arrays.spec.ts          # array, tuple, Set
│   ├── maps.spec.ts            # Map, Record, index signatures
│   ├── special-types.spec.ts   # Date, ObjectId, UUID, BigInt, RegExp
│   ├── unions.spec.ts          # discriminated, literal, scored
│   └── references.spec.ts      # Reference, Embedded, Inline
│
├── deserialize/
│   ├── primitives.spec.ts      # string, number, boolean, null, undefined
│   ├── binary.spec.ts          # Uint8Array, ArrayBuffer, TypedArrays
│   ├── objects.spec.ts         # object literals, classes, nested
│   ├── arrays.spec.ts          # array, tuple, Set
│   ├── maps.spec.ts            # Map, Record, index signatures
│   ├── special-types.spec.ts   # Date, ObjectId, UUID, BigInt, RegExp
│   ├── unions.spec.ts          # discriminated, literal, scored
│   ├── references.spec.ts      # Reference, Embedded, Inline
│   └── graceful.spec.ts        # Type coercion, sensible defaults
│
├── roundtrip/
│   └── type-spec.spec.ts       # Full serialize → deserialize roundtrip
│
├── stream.spec.ts              # BsonStreamReader
└── edge-cases.spec.ts          # circular, large, malformed
```

**Steps:**
- [x] Create directory structure (`tests/serialize/`, `tests/deserialize/`, `tests/roundtrip/`)
- [x] Create initial test files with lean API (no getBSONSizer)
- [x] Complete serialize test coverage (see checklist below)
- [x] Complete deserialize test coverage (see checklist below)
- [x] Complete roundtrip test coverage (see checklist below)
- [ ] Verify all tests pass: `npm run test packages/bson/` (blocked on Phase 3)

**Note:** Tests are written and ready but cannot be verified until Phase 3 (rewrite) completes. The current bson source code has breaking API incompatibilities with @deepkit/type (TemplateRegistry → HandlerRegistry migration).

### Test Coverage Checklist

**Files created so far:**
- `tests/serialize/primitives.spec.ts` - basic primitives
- `tests/serialize/binary.spec.ts` - binary types
- `tests/serialize/special-types.spec.ts` - Date, UUID, MongoId, RegExp
- `tests/serialize/objects.spec.ts` - objects, classes
- `tests/serialize/arrays.spec.ts` - arrays, Sets
- `tests/serialize/maps.spec.ts` - Maps, index signatures
- `tests/serialize/unions.spec.ts` - unions, literal unions
- `tests/serialize/references.spec.ts` - Reference type
- `tests/serialize/encoding.spec.ts` - UTF-8, unicode
- `tests/deserialize/primitives.spec.ts` - basic primitives
- `tests/deserialize/special-types.spec.ts` - Date, UUID, MongoId, RegExp
- `tests/deserialize/arrays.spec.ts` - arrays, Sets, tuples
- `tests/deserialize/objects.spec.ts` - objects, classes, Map
- `tests/deserialize/unions.spec.ts` - **NEW** union types comprehensive
- `tests/deserialize/coercion.spec.ts` - **NEW** type coercion tests
- `tests/deserialize/references.spec.ts` - **NEW** Reference deserialization
- `tests/roundtrip/type-spec.spec.ts` - comprehensive roundtrip
- `tests/encoder.spec.ts` - **NEW** getBsonEncoder with validation
- `tests/edge-cases.spec.ts` - **NEW** invalid buffers, circular refs, large docs

---

### Serialize Tests (`tests/serialize/`)

#### primitives.spec.ts
- [x] string (basic)
- [x] number int
- [x] number double
- [x] boolean
- [x] bigint
- [x] BinaryBigInt
- [x] SignedBinaryBigInt
- [x] undefined for required fields throws
- [ ] null type
- [ ] undefined type
- [ ] literal types (string literals, number literals, boolean literals)
- [ ] optional properties (with undefined)
- [ ] hexToByte utility
- [ ] uuidStringToByte utility

#### binary.spec.ts
- [x] Uint8Array
- [x] Uint16Array
- [x] ArrayBuffer
- [x] ArrayBuffer with MongoId
- [x] Uint16Array with MongoId
- [ ] Int8Array, Int16Array, Int32Array
- [ ] Uint32Array
- [ ] Float32Array, Float64Array
- [ ] DataView

#### special-types.spec.ts
- [x] Date (various ranges)
- [x] UUID
- [x] MongoId (ObjectId)
- [x] RegExp (various flags)
- [x] wrapValue
- [x] wrapObjectId
- [x] wrapUUID
- [ ] Date edge cases (epoch, negative timestamps, far future)

#### objects.spec.ts
- [x] nested object
- [x] deeply nested object
- [x] multiple properties
- [x] optional field
- [x] complex optional fields
- [x] Excluded property
- [x] Excluded for bson
- [x] Promise unwrapping
- [x] circular reference detection
- [x] complex recursive
- [ ] class with constructor
- [ ] class with default values
- [ ] class inheritance
- [ ] empty object
- [ ] object with methods (should be ignored)

#### arrays.spec.ts
- [x] string array
- [x] number array
- [x] mixed type array
- [x] Set serializes as array
- [x] Set round-trip
- [x] nested array
- [x] array of objects
- [x] array round-trip
- [ ] empty array
- [ ] large array (1000+ elements)
- [ ] tuple basic
- [ ] tuple with different types
- [ ] tuple with rest elements

#### maps.spec.ts
- [x] Map serializes as array of pairs
- [x] Map with multiple entries
- [x] index signature basic
- [x] index signature with properties
- [x] nested index signature
- [ ] Map with complex key types
- [ ] Map with complex value types
- [ ] index signature with template literal key
- [ ] multiple index signatures

#### unions.spec.ts
- [x] string | number
- [x] number | class
- [x] MongoId in union
- [x] literal union serialization (string, number, boolean)
- [x] literal union round-trip
- [x] literal union contexts (nested, array, optional)
- [x] large literal unions (15, 100 members)
- [ ] union with null
- [ ] union with undefined
- [ ] union with Date
- [ ] union with RegExp
- [ ] union with Uint8Array
- [ ] union with ArrayBuffer
- [ ] discriminated union (type field)
- [ ] scored union (property overlap)

#### references.spec.ts
- [x] reference serializes to primary key
- [x] deep reference
- [x] reference in array
- [ ] optional reference
- [ ] reference in union
- [ ] BackReference handling
- [ ] Embedded type

#### encoding.spec.ts
- [x] utf16 surrogate pair
- [x] utf8 japanese
- [x] emoji string
- [x] special unicode characters
- [x] null byte in string
- [x] very long string
- [ ] empty string
- [ ] string with only whitespace
- [ ] string with control characters
- [ ] string at max BSON size limit

---

### Deserialize Tests (`tests/deserialize/`)

#### primitives.spec.ts
- [x] string
- [x] empty string
- [x] number int
- [x] number double
- [x] number long
- [x] boolean
- [x] null for optional
- [x] NaN deserializes to 0
- [x] undefined for required defaults
- [x] string fallback from number
- [x] **Type coercion: number from string** ← in coercion.spec.ts
- [x] **Type coercion: number from boolean** ← in coercion.spec.ts
- [x] **Type coercion: boolean from number** ← in coercion.spec.ts
- [x] **Type coercion: boolean from string** ← in coercion.spec.ts
- [x] **Type coercion: bigint from number** ← in coercion.spec.ts
- [x] **Type coercion: bigint from string** ← in coercion.spec.ts
- [x] null type (exact) ← in coercion.spec.ts
- [x] undefined type (exact) ← in coercion.spec.ts
- [x] literal type defaults when missing ← in coercion.spec.ts
- [x] BinaryBigInt from binary ← in coercion.spec.ts
- [x] SignedBinaryBigInt from binary ← in coercion.spec.ts

#### special-types.spec.ts
- [x] Date
- [x] UUID
- [x] MongoId (ObjectId)
- [x] RegExp
- [x] optional MongoId
- [x] MongoId round-trip
- [x] UUID round-trip
- [ ] Date from string (ISO format)
- [ ] Date from number (timestamp)
- [ ] UUID validation (invalid throws)
- [ ] MongoId validation (invalid throws)

#### arrays.spec.ts
- [x] string array
- [x] number array
- [x] empty array
- [x] nested array
- [x] array of objects
- [x] Set from array
- [x] tuple
- [x] tuple with different types
- [x] union array
- [x] **Tuple with rest elements** ← added to arrays.spec.ts
- [x] **Tuple [...number[]]** ← added to arrays.spec.ts
- [x] **Tuple [string, ...number[]]** ← added to arrays.spec.ts
- [x] **Tuple [...number[], string]** ← added to arrays.spec.ts
- [x] **Tuple [string, ...number[], boolean]** ← added to arrays.spec.ts
- [ ] Set with type coercion
- [x] array union (number[] | string[]) ← in unions.spec.ts
- [x] class array in union ← in unions.spec.ts

#### objects.spec.ts
- [x] simple object
- [x] nested object
- [x] optional fields
- [x] class instance
- [x] class with defaults
- [x] index signature
- [x] index signature with union value
- [x] recursive object
- [x] Map
- [x] **Class with constructor** ← in references.spec.ts
- [x] **Class no constructor** ← in references.spec.ts
- [x] **Optional property with initializer (default value)** ← in references.spec.ts
- [x] **additional fields are ignored** ← in references.spec.ts
- [ ] index signature with template literal
- [ ] index signature multiple types
- [x] `any` type handling ← in edge-cases.spec.ts

#### unions.spec.ts ✅ CREATED
- [x] **basic union string | number** ← CRITICAL
- [x] **union two objects { a } | { b }** ← CRITICAL
- [x] **union with typed array** ← CRITICAL
- [x] **union with ArrayBuffer** ← CRITICAL
- [x] **union with null** ← CRITICAL
- [x] **union with literals 'a' | 'b'** ← CRITICAL
- [x] **union with template literals** ← CRITICAL
- [x] **union with Date** ← CRITICAL
- [x] **union with RegExp** ← CRITICAL
- [x] **union with UUID** ← CRITICAL
- [x] **union with MongoId** ← CRITICAL
- [x] union almost same members { a } | { a, b }
- [x] union same member optional { a, b? } | { a, b: string }
- [x] union error message includes expected types (#676)
- [x] array unions
- [x] class array in union

#### references.spec.ts ✅ CREATED
- [x] **reference deserializes from primary key** ← CRITICAL
- [x] **reference deserializes from full object** ← CRITICAL
- [x] **reference in union** ← CRITICAL
- [x] constructor parameters
- [x] class with constructor
- [x] class no constructor
- [x] optional property with initializer
- [x] additional fields are ignored
- [x] circular type deserialization

#### coercion.spec.ts ✅ CREATED
- [x] **number from string '123' → 123** ← CRITICAL
- [x] **number from boolean true → 1, false → 0** ← CRITICAL
- [x] **number from object {} → 0** ← CRITICAL
- [x] **bigint from string '123' → 123n** ← CRITICAL
- [x] **bigint from number 123 → 123n** ← CRITICAL
- [x] **bigint from boolean** ← CRITICAL
- [x] **string from number 123 → '123'** ← CRITICAL
- [x] **boolean from number (truthy/falsy)** ← CRITICAL
- [x] **boolean from string (truthy/falsy)** ← CRITICAL
- [x] BinaryBigInt coercion
- [x] SignedBinaryBigInt coercion
- [x] null/undefined type coercion
- [x] literal type defaults
- [x] Date coercion (from string, number)

---

### Roundtrip Tests (`tests/roundtrip/`)

#### type-spec.spec.ts
- [x] primitive round-trips (string, number, boolean, bigint)
- [x] date round-trips
- [x] special types round-trips (UUID, MongoId, RegExp)
- [x] binary round-trips (Uint8Array, ArrayBuffer)
- [x] collection round-trips (array, Set, Map, tuple)
- [x] object round-trips (simple, nested, optional, index signature)
- [x] union round-trips (basic, literal, nullable)
- [x] class round-trips (simple, UUID key, excluded)
- [x] recursive round-trips (self-referential, tree)
- [x] edge cases (empty, deep, large, unicode)
- [x] **Partial types** ← CRITICAL
- [x] **Record types with undefined** ← CRITICAL
- [x] **Reference with FK serialization** ← CRITICAL
- [x] **Embedded types** ← CRITICAL
- [x] **MapName annotation** ← CRITICAL
- [x] **Class inheritance** ← CRITICAL
- [x] **Class with statics** ← CRITICAL
- [x] **Promise unwrapping** ← CRITICAL
- [x] **Circular reference omission** ← CRITICAL
- [x] **nullable containers (string[] | null)** ← CRITICAL

---

### Validation/Encoder Tests ✅ CREATED (`tests/encoder.spec.ts`)

- [x] **getBsonEncoder basic usage** ← CRITICAL
- [x] **encoder.encode validates** ← CRITICAL
- [x] **encoder.decode validates** ← CRITICAL
- [x] **MinLength constraint in union** ← CRITICAL
- [x] **Positive constraint in union** ← CRITICAL
- [x] **nested constraint errors** ← CRITICAL
- [x] **structural errors (missing fields)** ← CRITICAL

---

### Edge Cases ✅ CREATED (`tests/edge-cases.spec.ts`)

- [x] **invalid buffer handling** ← CRITICAL
- [x] **truncated buffer** ← CRITICAL
- [x] **circular reference in serialization** ← CRITICAL
- [x] **very large document** ← CRITICAL
- [x] **max nesting depth** ← CRITICAL
- [x] **empty document** ← CRITICAL
- [x] any type passthrough

---

### Stream Tests (`tests/stream.spec.ts`)

- [ ] Keep existing stream.spec.ts (unchanged)

---

## Phase 0: Baseline Capture

### Public API (must preserve)

**User-Facing Functions:**
```typescript
// Serialization (NO sizer - growing buffer strategy eliminates the overhead)
serializeBSON<T>(data: T, type?: ReceiveType<T>): Uint8Array
getBSONSerializer<T>(type?: ReceiveType<T>): BSONSerializer<T>

// Deserialization
deserializeBSON<T>(buffer: Uint8Array, offset?: number, type?: ReceiveType<T>): T
getBSONDeserializer<T>(type?: ReceiveType<T>): BSONDeserializer<T>

// High-level encoder (type guard + serialize)
getBsonEncoder<T>(type?: ReceiveType<T>): { encode, decode, validate }

// Streaming
BsonStreamReader  // Class for parsing BSON from streams

// Utilities
wrapValue<T>(v: T): { v: T }  // BSON requires object wrapper for primitives
wrapObjectId(v: string): { v: ObjectId }
wrapUUID(v: string): { v: UUID }
```

**Types:**
```typescript
type BSONSerializer<T> = (data: T) => Uint8Array
type BSONDeserializer<T> = (buffer: Uint8Array, offset?: number) => T
```

**Classes:**
```typescript
class ObjectId { ... }  // MongoDB-compatible ObjectId
class BSONError extends DeepkitError { ... }
class BsonStreamReader { ... }
```

**Constants:**
```typescript
enum BSONType { ... }  // BSON wire types
BSON_BINARY_SUBTYPE_*  // Binary subtypes
```

### Benchmark Baseline (Pre-JIT Refactor)

**Saved baseline:** `git show 657442de:benchmarks/src/benchmarks/baselines/baseline-pre-jit-refactor.json`

| Benchmark | ops/sec | Target |
|-----------|---------|--------|
| serialize small object | 6.55 M | ≥6.5 M |
| deserialize small object | 7.29 M | ≥7.0 M |
| serialize object with dates | 5.72 M | ≥5.5 M |
| deserialize object with dates | 4.67 M | ≥4.5 M |
| serialize nested object | 2.61 M | ≥2.5 M |
| deserialize nested object | 3.07 M | ≥3.0 M |
| serialize number array (1000) | 40 K | ≥40 K |
| deserialize number array (1000) | 110 K | ≥100 K |
| serialize complex document | 730 K | ≥700 K |
| deserialize complex document | 810 K | ≥800 K |
| size calculation small object | 17.18 M | ≥17 M |
| size calculation complex | 2.13 M | ≥2.0 M |

**Goal:** Match or beat baseline on all metrics

### Test Expectations

Current test files (preserve all behaviors):
- `bson-serialize.spec.ts` (2,392 lines) - serialization
- `bson-parser.spec.ts` (1,174 lines) - parsing
- `type-spec.spec.ts` (1,105 lines) - roundtrip/types
- `stream.spec.ts` (215 lines) - streaming

---

## Phase 1: Test Cleanup

Goals:
1. Make tests implementation-agnostic (test inputs/outputs only)
2. Organize by BSON type, not by internal function
3. Add missing edge cases if found
4. Create test utilities for consistent patterns

### Proposed Test Structure

```
tests/
├── primitives.spec.ts      # string, number, boolean, null, undefined
├── binary.spec.ts          # Uint8Array, ArrayBuffer, TypedArrays
├── objects.spec.ts         # object literals, classes, nested
├── arrays.spec.ts          # array, tuple, Set
├── maps.spec.ts            # Map, Record, index signatures
├── special-types.spec.ts   # Date, ObjectId, UUID, BigInt, RegExp
├── unions.spec.ts          # discriminated, literal, scored
├── references.spec.ts      # Reference, Embedded, Inline
├── edge-cases.spec.ts      # circular, large, malformed
├── stream.spec.ts          # BsonStreamReader
└── roundtrip.spec.ts       # Full type roundtrip tests
```

---

## Phase 2: Design

### V8 Optimization Goals

1. **Monomorphic functions** - Avoid megamorphic call sites
2. **Hidden class stability** - Don't add/delete properties dynamically
3. **Inline caching friendly** - Predictable object shapes
4. **Avoid deoptimization triggers:**
   - arguments object
   - try/catch in hot paths
   - eval/Function constructor (handled by jit.ts)
   - Changing object prototype

### Buffer Strategy (DECIDED)

**Approach: Single-pass with growing buffer (like std::vector)**

- NO size calculation pass - just write directly
- If buffer too small: allocate larger, copy, continue
- NO buffer reference management (designed for TCP write - kernel copies)
- NO Node.js `Buffer` dependency - pure `Uint8Array` only
- Zero external dependencies

**Benchmarks needed:**
- Growth factor: 2x vs 1.5x vs fixed increment
- Initial size: 64 vs 128 vs 256 vs 512 bytes
- Copy strategy: `TypedArray.set()` vs manual loop

### Type Dispatch Strategy

Options:
1. **Switch on ReflectionKind** - Simple, potentially megamorphic
2. **Handler registry** - Like @deepkit/type serializer
3. **Monomorphic per-type functions** - Generate specific function for each type

### Union Deserialization (CRITICAL - BENCHMARKED)

**Challenge:** Given BSON bytes, identify which union member to deserialize to.

**Benchmark Results (`packages/bson/benchmarks/union-deserialization.ts`):**

| Strategy | Pos 1 | Pos 5 | Pos 10 | Notes |
|----------|-------|-------|--------|-------|
| Type-byte discrimination | 30-35 M | - | - | Only checks BSON type byte |
| Binary probing (pre-computed name) | 26.5 M | 13.2 M | 6.7 M | Fastest for value discrimination |
| Partial parse | 15.6 M | 5.4 M | 2.4 M | Builds string names |
| Full parse then check | 2.0 M | 1.5 M | 0.8 M | Parses all values |

**Key findings:**
1. **Type-byte discrimination is fastest** (~30-35 M ops/sec)
   - Use for type-discriminated unions like `Date | string` or `number | object`
   - Just scan for field, return BSON type byte (0x09 vs 0x02)
2. **Binary probing is 13x faster than full parse** at position 1
3. **Discriminator position matters significantly** - O(n) behavior
4. **Even at position 10, binary probing is 8x faster than full parse**

**JIT Strategy:**
1. **Type-discriminated unions** (different BSON types): Use type-byte discrimination
   - `Date | string` → check if field is 0x09 or 0x02
   - `number | object` → check if field is 0x10/0x01/0x12 vs 0x03
2. **Value-discriminated unions**: Use binary probing with pre-computed field name bytes
   - Pre-compute `TYPE_NAME_BYTES = new Uint8Array([0x74, 0x79, 0x70, 0x65, 0x00])` // "type\0"
   - Scan for match, read string value without full parse
3. **Encourage discriminators first** in type definitions for best performance

**Key insight:** BSON has type information in the wire format!
- Each element has: type byte (1) + name (cstring) + value
- We can probe the type byte without parsing the value

### Micro-benchmarks

Location: `packages/bson/benchmarks/`
Run with: `cd packages/bson && node --import @deepkit/run benchmarks/<file>.ts`

```
packages/bson/benchmarks/
├── buffer-strategies.ts           ✓ Growing buffer vs pre-allocated (2% overhead)
├── buffer-optimized.ts            ✓ Inline check vs batch reserve
├── jit-pattern.ts                 ✓ JIT simulation with reserve + unsafe writes
├── realistic-pattern.ts           ✓ Variable-length string handling
├── fully-inlined.ts               ✓ CRITICAL: Pre-baked property names (+69% faster)
├── union-deserialization.ts       ✓ Binary probing vs full parse (8-13x faster)
├── final-jit-patterns.ts          ✓ Serialization patterns for all doc types
├── u32-vs-u8.ts                   ✓ u32+DataView hybrid is 2.9x faster
├── deserialization-patterns.ts    ✓ DataView read, object construction, property matching
├── string-decode-lengths.ts       ✓ TextDecoder vs manual by string length
├── buffer-skip-patterns.ts        ✓ Field scanning and skipping strategies
├── object-class-construction.ts   ✓ Object literal vs class construction
├── direct-property-read.ts        ✓ Temp vars vs direct property assignment
├── hidden-class-stability.ts      ✓ CRITICAL: Hidden class stability impact
├── missing-field-handling.ts      ✓ Bitmask tracking has zero overhead
├── string-encoding.ts             ⏳ TextEncoder vs manual UTF-8
├── number-writing.ts              ⏳ DataView vs manual byte writing
└── type-dispatch.ts               ⏳ Switch vs monomorphic functions
```

**Completed benchmark summary:**
- Fully inlined code with pre-baked property names: **+69-126% faster** than write* functions
- Binary probing for union discrimination: **8-13x faster** than full parse
- Growing buffer overhead: **~2%** vs pre-allocated (acceptable)
- Type-byte discrimination: **~30-35 M ops/sec** (use for type-discriminated unions)
- JIT direct offset reads: **1220M ops/sec** (31x faster than sequential scan)
- DataView for reading: **1.4x faster** than manual byte extraction
- Object literal construction: **1760M ops/sec** (fastest method)
- String decoding crossover: loop for ≤5 chars, TextDecoder for ≥16 chars
- Hidden class stability: **3x property access speedup** with consistent construction order
- Object literal ≈ class with ctor ≈ class no-ctor + assign (all ~33M ops/sec)
- Bitmask field tracking: **zero overhead** vs no validation (~11M ops/sec both)
- Type coercion via lookup tables (like current implementation)

---

## Phase 3: Implementation

### jit.ts API Reference

**CORE PRINCIPLE:** Precompute everything possible at build/JIT-compile time so the runtime hotpath is minimal and optimal. The generated code should have:
- No type introspection at runtime
- No string comparisons for property names (use pre-computed u32 constants)
- No function calls that could be inlined
- No branches that could be eliminated
- Direct memory operations with known offsets where possible

The goal is that at runtime, the generated function is just a sequence of direct memory reads/writes with no decision-making overhead.

The new BSON implementation will use `@deepkit/core/jit.ts` for code generation. Here's the API:

```typescript
import { fn, fnJIT, fnExec, arg, Builder, Ref } from '@deepkit/core';

// Build a function with tiered execution (Exec mode first, then JIT after threshold)
const serialize = fn(arg<User>(), (b: Builder, input: Ref<User>) => {
    return b.obj({
        name: b.get(input, 'name'),
        age: b.get(input, 'age'),
    });
});

// Force immediate JIT compilation (throws in CSP environments)
const serializeJIT = fnJIT(arg<User>(), (b, input) => { ... });

// Force Exec mode only (no JIT, works in CSP environments)
const serializeExec = fnExec(arg<User>(), (b, input) => { ... });
```

**Builder Methods:**

| Category | Method | Description |
|----------|--------|-------------|
| **Values** | `b.lit(value)` | Literal value |
| | `b.obj({ key: ref })` | Object literal |
| | `b.arr(ref1, ref2, ...)` | Array literal |
| | `b.emptyObj()` | Empty object `{}` |
| | `b.emptyArr()` | Empty array `[]` |
| **Access** | `b.get(obj, 'key')` | Property access `obj.key` |
| | `b.at(arr, 0)` | Array access `arr[0]` |
| | `b.has(obj, 'key')` | Key existence `'key' in obj` |
| | `b.len(value)` | Length `.length` |
| **Mutation** | `b.set(obj, 'key', value)` | Set property (statement) |
| | `b.push(arr, value)` | Push to array (statement) |
| **Variables** | `b.let(expr)` | Bind to variable `let x = expr` |
| | `b.var_(initial)` | Mutable variable |
| | `b.setVar(ref, value)` | Assign to variable |
| | `b.getVar(ref)` | Read variable |
| **Calls** | `b.call(fn, ...args)` | Function call |
| | `b.new_(Ctor, ...args)` | Constructor `new Ctor()` |
| **Comparisons** | `b.eq(a, b)` | `a === b` |
| | `b.neq(a, b)` | `a !== b` |
| | `b.lt(a, b)` | `a < b` |
| | `b.gt(a, b)` | `a > b` |
| | `b.lte(a, b)` | `a <= b` |
| | `b.gte(a, b)` | `a >= b` |
| **Logical** | `b.not(a)` | `!a` |
| | `b.and(a, b)` | `a && b` |
| | `b.or(a, b)` | `a \|\| b` |
| | `b.nullish(a, b)` | `a ?? b` |
| **Type Checks** | `b.isType(v, 'string')` | `typeof v === 'string'` |
| | `b.isNull(v)` | `v === null` |
| | `b.isNullish(v)` | `v == null` |
| | `b.isInstance(v, Date)` | `v instanceof Date` |
| | `b.typeof_(v)` | `typeof v` |
| **Control Flow** | `b.if_(cond, then, else)` | Conditional (statement) |
| | `b.ternary(cond, then, else)` | Ternary expression `?:` |
| **Iteration** | `b.map(arr, (elem, idx) => ...)` | `arr.map((elem, idx) => ...)` |
| | `b.for_(iterable, (elem) => ...)` | For loop (statement) |
| **Strings** | `b.concat(ref1, ref2, ...)` | String concatenation |

**Example: BSON Serializer**

The JIT builds a function at "compile time" (first call or explicit JIT). All type information, property names, and offsets are baked into the generated code:

```typescript
import { fn, arg } from '@deepkit/core';

interface User { id: number; name: string; }

// At JIT compile time: analyze User type, compute property name bytes, calculate offsets
// At runtime: just execute the pre-baked instructions
const serializeUser = fn(arg<User>(), (b, input) => {
    // Pre-computed constants (baked in at compile time):
    // HDR_ID = 0x00646910 (type byte + "id\0" packed as u32)
    // HDR_NAME = 0x6d616e02 (type byte + "nam" packed as u32)

    const buffer = b.call(createBuffer, b.lit(256));
    const view = b.call(getDataView, buffer);
    const u32 = b.call(getUint32Array, buffer);

    // All offsets are KNOWN at compile time for fixed fields
    // u32[0] = 0 (size placeholder, aligned write)
    // u32[1] = HDR_ID (pre-computed header, aligned write)
    // u32[2] = input.id (value, aligned write)
    // ... etc

    return buffer;
});
```

**What gets precomputed at JIT compile time:**
- Property names as packed u32/u64 byte sequences
- Field offsets (until first variable-length field)
- Type dispatch decisions (which serializer to use)
- BSON type bytes for each field
- Buffer size estimates

**What happens at runtime (minimal):**
- Read input values
- Write to pre-calculated offsets
- Handle variable-length strings (offset becomes dynamic after)
- Return buffer

### File Structure (new)

```
src/
├── index.ts              # Public exports
├── types.ts              # BSONType enum, constants, interfaces
├── errors.ts             # BSONError
├── model.ts              # ObjectId class
├── writer.ts             # Buffer writing utilities
├── reader.ts             # Buffer reading utilities
├── serializer.ts         # JIT serializer using jit.ts
├── deserializer.ts       # JIT deserializer using jit.ts
├── handlers/             # Type-specific handlers
│   ├── primitives.ts
│   ├── objects.ts
│   ├── arrays.ts
│   ├── binary.ts
│   ├── special.ts
│   └── unions.ts
├── stream.ts             # BsonStreamReader
└── encoder.ts            # High-level getBsonEncoder
```

### Implementation Order

1. **Core infrastructure**
   - [ ] types.ts (BSONType, constants)
   - [ ] errors.ts (BSONError)
   - [ ] model.ts (ObjectId)
   - [ ] writer.ts (buffer writing)
   - [ ] reader.ts (buffer reading)

2. **Serialization (primitives first)**
   - [ ] null, boolean, number
   - [ ] string (UTF-8 encoding)
   - [ ] binary types
   - [ ] Date, ObjectId, UUID
   - [ ] object literals
   - [ ] arrays
   - [ ] classes
   - [ ] unions
   - [ ] references

3. **Deserialization (same order)**
   - [ ] primitives
   - [ ] strings
   - [ ] binary
   - [ ] special types
   - [ ] objects
   - [ ] arrays
   - [ ] unions
   - [ ] references

4. **Integration**
   - [ ] High-level API (serializeBSON, deserializeBSON)
   - [ ] Encoder wrapper
   - [ ] Streaming support

---

## Phase 4: Verification

### Test Verification
```bash
npm run test packages/bson/
```

### Benchmark Comparison
```bash
cd benchmarks && npm run benchmark -- -f bson --compare-baseline
```

### V8 Deoptimization Check
```bash
node --trace-deopt --trace-ic packages/bson/dist/cjs/index.js
```

### Memory Profiling
```bash
node --expose-gc --inspect packages/bson/dist/cjs/index.js
```

---

## Key Decisions Log

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Buffer strategy | pre-calc, growing, pool | **Growing 2x with inline check** | Only 2% overhead vs pre-allocated (see benchmarks) |
| Capacity check | function call, inline | **Inline** | Avoids function call overhead in common case |
| JIT pattern | write* functions, fully inlined | **Fully inlined with pre-baked property names** | 69% faster than function calls (see benchmarks) |
| Type dispatch | switch, registry, mono | TBD | Need micro-benchmarks |
| String encoding | TextEncoder, manual | TBD | Need micro-benchmarks |

### Fully Inlined Code Generation (CRITICAL FINDING)

**Serialization specification:** [`SERIALIZATION-STRATEGY.md`](./SERIALIZATION-STRATEGY.md)
**Deserialization specification:** [`DESERIALIZATION-STRATEGY.md`](./DESERIALIZATION-STRATEGY.md)

**Summary of extensive benchmarking:**

| Approach | Performance |
|----------|-------------|
| Optimal (u32 + DataView hybrid) | **500M docs/sec** (16.5 GB/sec) |
| Naive (all u8 byte-by-byte) | 127M docs/sec (5.8 GB/sec) |
| **Improvement** | **2.9x faster** |

**Key discoveries:**

1. **u32[] for aligned writes is 2.3x faster than DataView**
   ```
   u32[i] = value           →  1985M ops/sec
   view.setInt32(i, v, true) →   853M ops/sec
   ```

2. **DataView for misaligned writes beats manual byte extraction**
   ```
   view.setInt32(offset, value, true)  →  1205M ops/sec
   buffer[o] = v & 0xFF; ...           →   313M ops/sec
   ```

3. **No runtime alignment checks needed** - JIT decides at compile time

**Write Method Decision Table:**

| Condition | Method |
|-----------|--------|
| 4 bytes at aligned offset (`offset % 4 === 0`) | `u32[offset >> 2] = value` |
| 4 bytes at misaligned offset | `view.setInt32(offset, value, true)` |
| 1 byte | `buffer[offset] = byte` |
| String characters | `charCodeAt` loop |

**Optimal JIT-Generated Code Pattern:**
```typescript
// Buffer setup - THREE views on same buffer
const buffer = new Uint8Array(initialSize);
const view = new DataView(buffer.buffer);
const u32 = new Uint32Array(buffer.buffer);

// Pre-computed headers at JIT compile time
const HDR_ID = 0x00646910;      // type(0x10) + "id\0"
const HDR_NAME = 0x6d616e02;    // type(0x02) + "nam"
const HDR_AGE = 0x65676110;     // type(0x10) + "age"

function serializeUser(data: User): number {
    // ═══════════════════════════════════════════════
    // PHASE 1: Fixed offsets (before variable-length fields)
    // JIT decides u32 vs DataView at compile time
    // ═══════════════════════════════════════════════
    u32[0] = 0;                    // placeholder for size (aligned)
    u32[1] = HDR_ID;               // offset 4 (aligned)
    u32[2] = data.id;              // offset 8 (aligned)
    u32[3] = HDR_NAME;             // offset 12 (aligned)
    buffer[16] = 0x65;             // 'e' remainder
    buffer[17] = 0x00;             // null terminator
    view.setInt32(18, data.name.length + 1, true);  // misaligned

    // String content (charCodeAt loop)
    let o = 22;
    const name = data.name;
    for (let i = 0; i < name.length; i++) {
        buffer[o++] = name.charCodeAt(i);
    }
    buffer[o++] = 0x00;

    // ═══════════════════════════════════════════════
    // PHASE 2: Dynamic offset (after variable-length field)
    // Always use DataView - no alignment assumptions
    // ═══════════════════════════════════════════════
    view.setUint32(o, HDR_AGE, true); o += 4;
    buffer[o++] = 0x00;
    view.setInt32(o, data.age, true); o += 4;

    buffer[o++] = 0x00;  // document terminator

    // Write final document size
    view.setUint32(0, o, true);
    return o;
}
```

**jit.ts code generation rules:**
1. Pre-compute property headers as u32 constants at JIT compile time
2. Use `u32[]` for aligned offsets (0, 4, 8, 12...) before any string field
3. Use `DataView` for misaligned offsets and all offsets after strings
4. Use `buffer[]` for single bytes (nulls, booleans)
5. Use `charCodeAt` loop for strings (NOT TextEncoder - it's slower)
6. No runtime alignment checks - decision is compile-time

### Deserialization Strategy (CRITICAL FINDING)

**See full specification:** [`DESERIALIZATION-STRATEGY.md`](./DESERIALIZATION-STRATEGY.md)

**Key discoveries:**

| Approach | Performance |
|----------|-------------|
| JIT direct offset | **1220M ops/sec** |
| Sequential scan + first-byte switch | 57M ops/sec |
| Sequential scan + string compare | 12M ops/sec |
| **Improvement** | **21-100x faster** with JIT |

**Read method selection:**
- Use `DataView.getInt32()` for numbers (1.4x faster than manual extraction)
- Use manual `fromCharCode` loop for strings ≤5 chars
- Use `TextDecoder` for strings ≥16 chars
- Use object literals for result construction (60x faster than Object.create(null))

**Property matching:**
- Pre-compute property names as u32 constants
- Use switch on first byte for discrimination
- Use u32 packed comparison when first 4 bytes unique

**JIT-Generated Code Pattern (known field order):**
```typescript
function deserialize_User(buffer: Uint8Array): User {
    const view = new DataView(buffer.buffer, buffer.byteOffset);

    // Pre-computed offsets at JIT compile time
    const id = view.getInt32(8, true);

    const nameLen = view.getInt32(18, true) - 1;
    let name = '';
    for (let i = 0; i < nameLen; i++) {
        name += String.fromCharCode(buffer[22 + i]);
    }

    // Dynamic offset after string
    const ageOffset = 22 + nameLen + 1 + 5;  // skip null + type + "age\0"
    const age = view.getInt32(ageOffset, true);

    return { id, name, age };
}
```

**JIT-Generated Code Pattern (unknown field order - MongoDB):**
```typescript
function deserialize_User(buffer: Uint8Array): User {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let id = 0, name = '', age = 0;
    let o = 4;

    while (buffer[o] !== 0x00) {
        const type = buffer[o++];
        const nameStart = o;

        // Switch on first byte of property name
        switch (buffer[nameStart]) {
            case 0x69: // 'i' - likely "id"
                if (buffer[nameStart + 1] === 0x64 && buffer[nameStart + 2] === 0x00) {
                    o += 3;
                    id = view.getInt32(o, true);
                    o += 4;
                    continue;
                }
                break;
            // ... other properties
        }

        // Skip unknown field
        o = skipField(buffer, o, type);
    }

    return { id, name, age };
}
```

### Earlier Buffer Strategy Benchmarks (superseded)

**JIT Pattern (reserve once + direct writes):**
```
JIT exact size calc:    8.35 M/s
JIT static reserve:     8.43 M/s
Fresh writer each call: 3.28 M/s (includes allocation)
```

**Realistic Performance (medium user, typical strings):**
```
Reused writer:     7.18 M/s
Fresh writer:      3.15 M/s
Array of 10:       837 K/s (83.7K users/sec)
```

Note: These results used write* functions. Fully inlined approach is significantly faster.

---

## References

- [BSON Specification](https://bsonspec.org/spec.html)
- [MongoDB BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/)
- [V8 Optimization Tips](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
- Old implementation: `git show HEAD:packages/bson/src/<file>`
