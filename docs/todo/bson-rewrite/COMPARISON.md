# BSON Rewrite: Current vs Optimal Implementation Comparison

This document compares the current `@deepkit/bson` implementation against the optimal JIT patterns discovered through extensive benchmarking. This serves as the basis for the rewrite PR.

## Executive Summary

| Operation | Current | Optimal | Improvement |
|-----------|---------|---------|-------------|
| **Serialization (numbers-only)** | ~127M ops/sec | **482M ops/sec** | **3.8x faster** |
| **Int32 reads** | 337M ops/sec | **473M ops/sec** | **1.4x faster** |
| **Property name matching** | 297M ops/sec | **431M ops/sec** | **1.5x faster** |
| **Object property access (downstream)** | ~30M ops/sec | **109M ops/sec** | **3.6x faster** |

---

## Serialization Comparison

### Issue 1: Manual Byte Extraction vs DataView

**Current Implementation** (`bson-serializer.ts:307-312`):
```typescript
export function writeUint32LE(buffer: Uint8Array, offset: number, value: number) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
    buffer[offset + 2] = (value >> 16) & 0xff;
    buffer[offset + 3] = (value >> 24) & 0xff;
}
```

**Benchmark Results**:
```
Manual byte extraction: 313M ops/sec
DataView.setInt32:     1205M ops/sec (3.8x faster)
```

**Optimal Pattern**:
```typescript
view.setInt32(offset, value, true);  // For misaligned writes
```

### Issue 2: No Uint32Array for Aligned Writes

**Current Implementation**: Always uses manual byte extraction or would need DataView.

**Benchmark Results**:
```
u32[i] = value:           1985M ops/sec
view.setInt32(i, v, true):  853M ops/sec
```

**Optimal Pattern**: Use `Uint32Array` for aligned writes (offset % 4 === 0), which is 2.3x faster than DataView:
```typescript
// At offsets 0, 4, 8, 12... use u32
u32[0] = docSize;
u32[1] = HDR_ID;    // pre-computed header constant
u32[2] = data.id;
```

### Issue 3: Property Headers Not Pre-computed

**Current Implementation** (`bson-serializer.ts:748-759`):
```typescript
function getNameWriterCode(name: string): string {
    const nameSetter: string[] = [];
    for (let i = 0; i < name.length; i++) {
        nameSetter.push(`state.writer.buffer[state.writer.offset++] = ${name.charCodeAt(i)};`);
    }
    return `
        ${nameSetter.join('\n')}
        state.writer.writeByte(0); //null
    `;
}
```

This generates byte-by-byte writes at JIT compile time, which is good but not optimal.

**Optimal Pattern**: Pre-compute property headers (type byte + name) as u32 constants:
```typescript
// JIT compile time: compute header constants
const HDR_ID = 0x00646910;    // type(0x10) + "id\0"
const HDR_NAME = 0x6d616e02;  // type(0x02) + "nam"

// Runtime: single u32 write vs multiple byte writes
u32[1] = HDR_ID;  // 1 operation instead of 4
```

### Issue 4: Writer Class Method Call Overhead

**Current Implementation**: Uses `Writer` class with methods like `writeInt32()`, `writeByte()`, etc.

**Optimal Pattern**: Direct buffer/view access in generated code eliminates method call overhead:
```typescript
// Instead of: state.writer.writeInt32(value);
view.setInt32(o, value, true); o += 4;
```

### Serialization Summary

| Pattern | Current | Optimal |
|---------|---------|---------|
| 4-byte aligned writes | Manual byte extraction | `u32[offset >> 2] = value` |
| 4-byte misaligned writes | Manual byte extraction | `view.setInt32(offset, value, true)` |
| Property headers | Byte-by-byte JIT code | Pre-computed u32 constants |
| String encoding | `charCodeAt` loop | `charCodeAt` loop (same) |
| Method calls | Via Writer class | Direct buffer access |

---

## Deserialization Comparison

### Issue 1: Manual Byte Extraction for Reading

**Current Implementation** (`bson-parser.ts:22-28`):
```typescript
export function readInt32LE(buffer: Uint8Array, offset: number): number {
    return buffer[offset] | (buffer[offset + 1] << 8) |
           (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
}
```

**Benchmark Results**:
```
Manual byte extraction: 337M ops/sec
DataView.getInt32:      473M ops/sec (1.4x faster)
```

**Optimal Pattern**:
```typescript
const value = view.getInt32(offset, true);
```

### Issue 2: Property Name Matching

**Current Implementation** (`bson-deserializer-templates.ts:47-56`):
```typescript
function getNameComparator(name: string): string {
    const bufferCompare: string[] = [];
    for (let i = 0; i < name.length; i++) {
        bufferCompare.push(`state.parser.buffer[state.parser.offset + ${i}] === ${name.charCodeAt(i)}`);
    }
    bufferCompare.push(`state.parser.buffer[state.parser.offset + ${name.length}] === 0`);
    return bufferCompare.join(' && ');
}
```

Generates: `buffer[o] === 110 && buffer[o+1] === 97 && buffer[o+2] === 109 && buffer[o+3] === 101 && buffer[o+4] === 0`

**Benchmark Results**:
```
Byte-by-byte comparison: 297M ops/sec
u32 packed comparison:   431M ops/sec (1.45x faster)
```

**Optimal Pattern**:
```typescript
// Pre-compute at JIT time
const PROP_NAME = 0x656d616e;  // "name" as u32 little-endian

// Runtime: single u32 comparison
if (view.getUint32(nameStart, true) === PROP_NAME && buffer[nameStart + 4] === 0x00) {
    // match!
}
```

### Issue 3: Hidden Class Instability (CRITICAL)

**Current Implementation** (`bson-deserializer-templates.ts:939-970`):
```typescript
var object = {};  // or new Class()
// ...loop through BSON fields in whatever order they arrive...
while (state.parser.offset < end) {
    // ...
    if (getNameComparator('id')) {
        object['id'] = view.getInt32(o, true);  // Assignment order varies!
    }
    else if (getNameComparator('name')) {
        object['name'] = parseString();
    }
    // ...
}
${state.setter} = ${object};
```

When BSON fields arrive in different orders (common with MongoDB), objects get different hidden classes.

**Benchmark Results**:
```
Dynamic order assignment:     30M ops/sec property access
Consistent order construction: 109M ops/sec property access (3.6x faster!)
```

**Optimal Pattern**: Read into temp variables, then construct in consistent order:
```typescript
let id = 0, name = '', age = 0;  // temp variables

while (hasMoreFields()) {
    switch (fieldName) {
        case 'id': id = view.getInt32(o, true); break;
        case 'name': name = parseString(); break;
        case 'age': age = view.getInt32(o, true); break;
    }
}

// ALWAYS construct in same property order - stable hidden class
return { id, name, age };
```

### Issue 4: Type Coercion Lookup Tables (Already Optimal)

**Current Implementation** (`bson-deserializer-templates.ts:88-99`):
```typescript
const numberParsers = createParserLookup(
    () => 0,
    [
        [BSONType.INT, parser => parser.parseInt()],
        [BSONType.NUMBER, parser => parser.parseNumber()],
        [BSONType.LONG, parser => Number(parser.parseLong())],
        // ...
    ],
);
```

This is already the ideal pattern - lookup table indexed by BSON type.

### Issue 5: String Decoding

**Current Implementation** (`strings.ts`): Uses custom `decodeUTF8` function.

**Benchmark Results**:
```
Manual fromCharCode loop (≤5 chars): 35M ops/sec
TextDecoder (≥16 chars):             14M ops/sec
```

**Optimal Pattern**:
- Short strings (≤5 chars): Manual `fromCharCode` loop
- Long strings (≥16 chars): `TextDecoder`
- Discriminator fields are typically short - use manual loop

### Deserialization Summary

| Pattern | Current | Optimal |
|---------|---------|---------|
| Int32 reads | Manual byte extraction | `view.getInt32(offset, true)` |
| Property matching | Byte-by-byte comparison | u32 packed comparison |
| Object construction | Dynamic assignment order | Temp vars → consistent order |
| Missing field tracking | Per-field variables | Bitmask (same overhead, cleaner) |
| Type coercion | Lookup table | Lookup table (same) |
| String decode (short) | Custom UTF-8 | Manual `fromCharCode` loop |
| String decode (long) | Custom UTF-8 | `TextDecoder` |

---

## Implementation Checklist

### Serialization
- [ ] Create three buffer views: `Uint8Array`, `DataView`, `Uint32Array`
- [ ] Generate u32 writes for aligned offsets (before variable-length fields)
- [ ] Generate DataView writes for misaligned and dynamic offsets
- [ ] Pre-compute property headers as u32 constants at JIT compile time
- [ ] Remove Writer class method call overhead
- [ ] Keep `charCodeAt` loop for strings (already optimal)

### Deserialization
- [ ] Replace `readInt32LE` with `view.getInt32(offset, true)`
- [ ] Replace `readUint32LE` with `view.getUint32(offset, true)`
- [ ] Replace `readFloat64LE` with `view.getFloat64(offset, true)`
- [ ] Pre-compute property name patterns as u32 constants
- [ ] Use u32 comparison for property matching
- [ ] Generate temp variable reads + consistent-order construction
- [ ] Use bitmask for required field tracking
- [ ] Optimize string decoding: manual loop for short, TextDecoder for long

---

## Architectural Changes

### Removed: Two-Pass Serialization (Sizer + Serializer)

**Current approach:**
```typescript
const sizer = getBSONSizer<T>();
const serializer = getBSONSerializer<T>();

const size = sizer(message);                    // Pass 1: walk object, calculate size
const buffer = Buffer.allocUnsafe(size);
const result = serializer(message);             // Pass 2: walk object, serialize
```

**New approach:**
```typescript
const serializer = getBSONSerializer<T>();

const result = serializer(message);             // Single pass: write-and-expand
```

**Benefits:**
- Eliminates walking object structure twice
- No separate JIT-compiled sizer function needed
- No size estimation or pre-scanning
- Global buffer grows naturally, rarely expands after warmup

**Impact on `@deepkit/mongo`:**
- Remove `getBSONSizer` usage in `connection.ts:966`
- Use `result.byteLength` for message size field

### No AutoBuffer Class - Pass Parameters

**Benchmark Results** (`buffer-indirection.ts`):
```
Pass as parameters:     -8.8% (faster than baseline!)
AutoBuffer class:       16.8% overhead
Module globals:         23.9% overhead
```

**Strategy:**
- JIT generates functions that receive `buffer`, `view`, `offset` as params
- Thin wrapper manages global buffer and expansion
- No class indirection in hot path
- V8 optimizes local parameters better than object properties

**Generated code pattern:**
```typescript
function serialize_User(buffer, view, o, data) {
    view.setInt32(o, 0, true); o += 4;
    // ... inline writes ...
    return o;
}
```

**Expansion** (`write-and-expand.ts`):
- Check before variable-length writes only
- Buffer grows naturally, rarely expands after warmup
- Expansion cost is negligible (~0% amortized)

### Removed: Writer Class Dependency

The `Writer` class is not needed by the serializer. It was only used by mongo for the 21-byte wire protocol header, which can be done with `DataView`.

---

## Expected Performance Improvements

### Serialization

| Document Type | Current (est.) | After Rewrite |
|---------------|----------------|---------------|
| Simple (3 numbers) | ~127M ops/sec | **~480M ops/sec** |
| With strings | ~30M ops/sec | **~100M ops/sec** |
| Complex (8 fields) | ~5M ops/sec | **~18M ops/sec** |

### Deserialization

| Operation | Current | After Rewrite |
|-----------|---------|---------------|
| Number reads | 337M ops/sec | **473M ops/sec** |
| Property matching | 297M ops/sec | **431M ops/sec** |
| Object property access | 30M ops/sec | **109M ops/sec** |

### Downstream Impact

The hidden class stability improvement is particularly important because:
- Deserialization cost is paid **once**
- Property access cost is paid **many times** (ORM queries, API responses)
- A 3.6x improvement in property access compounds across entire applications

---

## Benchmark Files

All benchmarks are in `packages/bson/benchmarks/`:

| File | Purpose |
|------|---------|
| `final-jit-patterns.ts` | Serialization patterns for all types |
| `deserialization-patterns.ts` | Core read patterns comparison |
| `hidden-class-stability.ts` | Object construction impact |
| `string-decode-lengths.ts` | String decoding crossover analysis |
| `u32-vs-dataview-aligned.ts` | Aligned write comparison |
| `alignment-strategies.ts` | Alignment analysis |

Run any benchmark:
```bash
node --import @deepkit/run benchmarks/<filename>.ts
```

---

## Strategy Documents

- `SERIALIZATION-STRATEGY.md` - Complete serialization JIT code generation rules
- `DESERIALIZATION-STRATEGY.md` - Complete deserialization JIT code generation rules
