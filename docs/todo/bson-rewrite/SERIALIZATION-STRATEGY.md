# BSON Serialization Strategy - Final Specification

This document defines the optimal JIT code generation strategy for BSON serialization, based on extensive benchmarking.

## Executive Summary

| Approach | Performance |
|----------|-------------|
| **Optimal (u32 + DataView hybrid)** | 500M docs/sec (16.5 GB/sec) for numbers-only |
| Naive (all u8 byte-by-byte) | 127M docs/sec (5.8 GB/sec) |
| **Improvement** | **2.9x faster** |

## Buffer Management

### No AutoBuffer Class - Pass Parameters Instead

**Benchmark Results** (`buffer-indirection.ts`):
| Strategy | ops/sec | Overhead |
|----------|---------|----------|
| **Pass as parameters** | 83M | **-8.8%** (faster!) |
| Inline (JIT-style) | 81M | -6.1% |
| Direct access | 76M | baseline |
| Closure-based | 70M | 8.6% |
| AutoBuffer class | 64M | **16.8%** |
| Module globals | 58M | **23.9%** |

**Key insight**: Class indirection costs 16.8%. Pass buffer/view/offset as parameters instead.

### JIT-Generated Function Pattern

```typescript
// JIT generates functions that receive buffer params
function serialize_User(
    buffer: Uint8Array,
    view: DataView,
    o: number,          // offset
    data: User
): number {
    view.setInt32(o, 0, true); o += 4;    // doc size placeholder
    // ... inline writes using o ...
    view.setInt32(0, o, true);            // backfill doc size
    return o;                              // return final offset
}

// Thin wrapper manages global buffer
let globalBuffer = new Uint8Array(4096);
let globalView = new DataView(globalBuffer.buffer);

function serialize<T>(fn: SerializeFn<T>, data: T): Uint8Array {
    const size = fn(globalBuffer, globalView, 0, data);
    return globalBuffer.subarray(0, size);
}
```

### Expansion Handling

```typescript
// For variable-length fields, check inline:
function serialize_User(buffer: Uint8Array, view: DataView, o: number, data: User): number {
    // Fixed writes - no check (buffer large enough after warmup)
    view.setInt32(o, 0, true); o += 4;
    // ...

    // Variable-length - inline check
    const strLen = data.name.length + 5;
    if (o + strLen > buffer.length) {
        // Signal need for expansion - caller handles it
        return -1;  // or throw, or expand inline
    }
    // write string...
}
```

**Expansion cost is negligible** (`write-and-expand.ts`):
```
First 10K (with expansions): 24.74ms
Next 10K (no expansion):     26.02ms  ← virtually identical
```

### What We DON'T Do

- ❌ AutoBuffer class (16.8% overhead)
- ❌ Module-level globals (23.9% overhead)
- ❌ Pre-scan arrays to calculate total size
- ❌ Estimate string sizes with heuristics
- ❌ Check capacity on every byte write
- ❌ Re-serialize on overflow
- ❌ Use `getBSONSizer` (removed - single pass only)

### Buffer Views

Every serialization function needs three views on the same buffer:

```typescript
const buffer = new Uint8Array(initialSize);
const view = new DataView(buffer.buffer);
const u32 = new Uint32Array(buffer.buffer);
```

- `buffer` (Uint8Array) - for single byte writes
- `view` (DataView) - for misaligned 4-byte writes
- `u32` (Uint32Array) - for aligned 4-byte writes (fastest)

## Write Method Selection

### Decision Table

| Condition | Method | Speed |
|-----------|--------|-------|
| 4 bytes at aligned offset (`offset % 4 === 0`) | `u32[offset >> 2] = value` | ~2000M ops/sec |
| 4 bytes at misaligned offset | `view.setInt32(offset, value, true)` | ~850M ops/sec |
| 1 byte | `buffer[offset] = byte` | ~1500M ops/sec |
| String characters | `charCodeAt` loop | ~100M chars/sec |

### Key Finding: u32 vs DataView

```
u32[i] = value           →  1985M ops/sec (aligned only)
view.setInt32(i, v, true) →   853M ops/sec (any offset)

u32 is 2.3x faster for aligned writes!
```

### Key Finding: Misaligned Writes

For misaligned 4-byte writes, DataView beats manual byte extraction:

```
view.setInt32(offset, value, true)  →  1205M ops/sec ✓
buffer[o] = v & 0xFF; buffer[o+1]...  →   313M ops/sec ✗
```

**Always use DataView for misaligned 4-byte writes, not manual byte shifting.**

## JIT Code Generation Rules

### Rule 1: Pre-compute Headers at Compile Time

Property headers (type byte + property name + null) are static. Pre-compute as u32 constants:

```typescript
// "id" field with int32 type
// type(0x10) + 'i'(0x69) + 'd'(0x64) + '\0'(0x00)
// Little-endian: 0x00646910
const HDR_ID = 0x00646910;

// "name" field with string type
// type(0x02) + 'n'(0x6e) + 'a'(0x61) + 'm'(0x6d)
// Remaining bytes written separately: 'e'(0x65) + '\0'(0x00)
const HDR_NAME = 0x6d616e02;

// "active" field with boolean type (8 bytes - use two u32s)
// type(0x08) + 'a' + 'c' + 't' = 0x74636108
// 'i' + 'v' + 'e' + '\0' = 0x00657669
const HDR_ACTIVE1 = 0x74636108;
const HDR_ACTIVE2 = 0x00657669;
```

### Rule 2: Track Alignment State

Alignment is **compile-time deterministic** until the first variable-length field:

```typescript
// KNOWN OFFSETS (before any string/array)
// offset 0:  document size    → ALIGNED
// offset 4:  first header     → ALIGNED
// offset 8:  first value      → ALIGNED (if int32)
// offset 12: second header    → ALIGNED
// ...pattern depends on field types and name lengths

// UNKNOWN OFFSETS (after string/array)
// Must use DataView for all 4-byte writes
```

### Rule 3: No Runtime Alignment Checks

The JIT compiler decides u32 vs DataView at **compile time**, not runtime:

```typescript
// ✗ BAD - runtime branching
if (offset % 4 === 0) {
    u32[offset >> 2] = value;
} else {
    view.setInt32(offset, value, true);
}

// ✓ GOOD - compile-time decision
// Before strings: JIT generates u32 or DataView based on known offset
// After strings: JIT always generates DataView
```

### Rule 4: Two-Phase Code Structure

```typescript
function serialize_User(data: User): number {
    // ═══════════════════════════════════════════════
    // PHASE 1: Fixed offsets (before variable-length fields)
    // JIT decides u32 vs DataView at compile time
    // ═══════════════════════════════════════════════
    u32[0] = 0;                    // placeholder for size
    u32[1] = HDR_ID;               // offset 4 - aligned
    u32[2] = data.id;              // offset 8 - aligned
    u32[3] = HDR_NAME;             // offset 12 - aligned
    buffer[16] = 0x65;             // 'e' remainder
    buffer[17] = 0x00;             // null terminator
    view.setInt32(18, data.name.length + 1, true);  // misaligned

    // String content
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

    view.setUint32(o, HDR_ACTIVE1, true); o += 4;
    view.setUint32(o, HDR_ACTIVE2, true); o += 4;
    buffer[o++] = data.active ? 1 : 0;

    buffer[o++] = 0x00;  // document terminator

    // Write final document size
    view.setUint32(0, o, true);
    return o;
}
```

## String Handling

### Short Strings (≤4 chars)

Can unroll charCodeAt calls:

```typescript
const name = data.name;
const len = name.length;
if (len > 0) buffer[o++] = name.charCodeAt(0);
if (len > 1) buffer[o++] = name.charCodeAt(1);
if (len > 2) buffer[o++] = name.charCodeAt(2);
if (len > 3) buffer[o++] = name.charCodeAt(3);
```

### Longer Strings

Use simple loop (V8 optimizes this well):

```typescript
for (let i = 0; i < str.length; i++) {
    buffer[o++] = str.charCodeAt(i);
}
```

### Note on TextEncoder

**Do NOT use TextEncoder** - benchmarks show it's slower than charCodeAt loop due to function call overhead:

```
charCodeAt loop:  100M+ strings/sec
TextEncoder:       15M strings/sec
```

## Nested Documents and Arrays

### Embedded Documents

```typescript
// Write header
view.setUint32(o, HDR_USER, true); o += 4;  // type(0x03) + "use"
buffer[o++] = 0x72;  // 'r'
buffer[o++] = 0x00;  // null

// Save position for size, skip 4 bytes
const docStart = o;
o += 4;

// Write embedded document fields...
// ...

// Write terminator and backfill size
buffer[o++] = 0x00;
view.setUint32(docStart, o - docStart, true);
```

### Arrays

Arrays are documents with string indices as keys:

```typescript
// Array header
view.setUint32(o, HDR_TAGS, true); o += 4;
buffer[o++] = 0x73;  // 's'
buffer[o++] = 0x00;

const arrayStart = o;
o += 4;  // placeholder for array size

for (let i = 0; i < data.tags.length; i++) {
    buffer[o++] = 0x02;  // type = string

    // Index as key: "0", "1", "2"...
    if (i < 10) {
        buffer[o++] = 0x30 + i;  // '0'-'9'
        buffer[o++] = 0x00;
    } else {
        const idxStr = i.toString();
        for (let j = 0; j < idxStr.length; j++) {
            buffer[o++] = idxStr.charCodeAt(j);
        }
        buffer[o++] = 0x00;
    }

    // String value
    const tag = data.tags[i];
    view.setInt32(o, tag.length + 1, true); o += 4;
    for (let j = 0; j < tag.length; j++) {
        buffer[o++] = tag.charCodeAt(j);
    }
    buffer[o++] = 0x00;
}

buffer[o++] = 0x00;  // array terminator
view.setUint32(arrayStart, o - arrayStart, true);
```

## Performance Reference

### By Document Type

| Type | ops/sec | Bandwidth |
|------|---------|-----------|
| Simple (3 numbers) | 500M | 16.5 GB/sec |
| With 1 string | 110M | 4.2 GB/sec |
| Nested (2 embedded) | 58M | 3.9 GB/sec |
| Array (3 strings) | 24M | 1.4 GB/sec |
| Complex (8 fields) | 19M | 2.2 GB/sec |

### Optimization Priority

1. **Put numeric fields before string fields** - maximizes u32 usage
2. **Pre-compute all headers as u32 constants** - zero runtime overhead
3. **Use DataView after strings** - no alignment checking needed
4. **Avoid TextEncoder** - charCodeAt is faster

## What NOT to Do

```typescript
// ✗ Don't use TextEncoder
encoder.encodeInto(str, buffer.subarray(o));

// ✗ Don't manually extract bytes for 4-byte values
buffer[o] = value & 0xFF;
buffer[o+1] = (value >> 8) & 0xFF;
buffer[o+2] = (value >> 16) & 0xFF;
buffer[o+3] = (value >> 24) & 0xFF;

// ✗ Don't use set() for small copies (<64 bytes)
buffer.set(smallHeader, o);

// ✗ Don't check alignment at runtime
if ((o & 3) === 0) { u32[o >> 2] = v; } else { view.setInt32(o, v, true); }

// ✗ Don't use BigUint64Array (BigInt conversion overhead)
u64[i] = BigInt(value);
```

## Implementation Checklist

- [ ] Create buffer pool for reusable buffers
- [ ] Generate header constants at JIT compile time
- [ ] Analyze type schema to determine fixed vs dynamic offset regions
- [ ] Generate u32 writes for aligned fixed offsets
- [ ] Generate DataView writes for misaligned and dynamic offsets
- [ ] Generate charCodeAt loops for strings
- [ ] Handle nested documents with size backfilling
- [ ] Handle arrays with index-as-key pattern
- [ ] Benchmark against current implementation

## Files Created During Research

All benchmarks are in `packages/bson/benchmarks/`:

- `u32-vs-u8.ts` - Direct comparison (2.86x speedup)
- `final-jit-patterns.ts` - All type patterns
- `alignment-strategies.ts` - Alignment analysis
- `raw-loop-test.ts` - True performance without framework overhead
- `string-write-speed.ts` - String writing methods
- `variable-strings.ts` - Variable length handling
- `property-name-peter.ts` - Property name encoding

Run any benchmark with:
```bash
node --import @deepkit/run benchmarks/<filename>.ts
```
