# BSON Deserialization Strategy - Final Specification

This document defines the optimal JIT code generation strategy for BSON deserialization, based on extensive benchmarking.

## Executive Summary

| Approach | Performance | Use Case |
|----------|-------------|----------|
| **JIT direct offset** | 1220M ops/sec | Known schema + known field order |
| **Sequential scan + first-byte switch** | 57M ops/sec | Known schema + unknown field order |
| **Sequential scan + string compare** | 12M ops/sec | Runtime/schema-less |
| **Improvement** | **21-100x faster** with JIT |

## Buffer Setup

Every deserialization function needs these views:

```typescript
const buffer: Uint8Array;
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
```

**Note:** Unlike serialization, we only need `Uint8Array` and `DataView`. The `Uint32Array` typed view offers no significant advantage for reading due to alignment requirements.

## Read Method Selection

### Decision Table

| Data Type | Method | Performance |
|-----------|--------|-------------|
| int32, uint32 | `view.getInt32(offset, true)` | ~490M ops/sec |
| int64 | `view.getBigInt64(offset, true)` | TBD |
| double | `view.getFloat64(offset, true)` | TBD |
| boolean | `buffer[offset] === 1` | ~1500M ops/sec |
| single byte | `buffer[offset]` | ~1500M ops/sec |

### Key Finding: DataView vs Manual Extraction

```
view.getInt32(offset, true)     →  492M ops/sec ✓
buffer[o] | buffer[o+1]<<8 ...  →  344M ops/sec ✗
```

**DataView is 1.4x faster for reading numbers** - the opposite of writing!

## String Decoding Strategy

### Crossover Point Analysis

| String Length | Best Method | Performance |
|--------------|-------------|-------------|
| 1-5 chars | Manual loop | 35-345M ops/sec |
| 6-15 chars | fromCharCode.apply | 21-29M ops/sec |
| ≥16 chars | TextDecoder | 18-21M ops/sec |

### JIT Code Generation Rules

```typescript
// For strings with maxLength annotation ≤5:
let str = '';
for (let i = 0; i < len; i++) {
    str += String.fromCharCode(buffer[offset + i]);
}

// For strings with unknown or larger maxLength:
const str = textDecoder.decode(buffer.subarray(offset, offset + len));
```

**Rule:** Use manual loop for discriminator fields (typically short), TextDecoder for content strings.

## Object Construction

### Performance Comparison (without buffer reading)

| Method | Performance |
|--------|-------------|
| Object literal `{ ... }` | 1760M ops/sec |
| Class `new + assignment` | 1594M ops/sec |
| Object.create(null) | 27.7M ops/sec ✗ |

### Performance Comparison (with buffer reading)

| Method | Performance |
|--------|-------------|
| Temps → object literal `{ id, name, age }` | 33M ops/sec |
| Temps → `new Class(id, name, age)` | 33M ops/sec |
| Empty `{}` → assign | 33M ops/sec |
| `new Class()` → assign | 33M ops/sec |
| Object.create(prototype) → assign | 28M ops/sec ✗ |
| IIFE in constructor | 29M ops/sec ✗ |

**Key Finding:** All practical construction patterns perform identically when combined with buffer reading (~33M ops/sec). The construction overhead is negligible compared to buffer operations.

### Recommended Patterns

**For plain objects:**
```typescript
const id = view.getInt32(offset1, true);
const name = readString(buffer, offset2);
const age = view.getInt32(offset3, true);
return { id, name, age };
```

**For classes WITH constructor:**
```typescript
const id = view.getInt32(offset1, true);
const name = readString(buffer, offset2);
const age = view.getInt32(offset3, true);
return new User(id, name, age);
```

**For classes WITHOUT constructor (disableConstructor):**
```typescript
const result = new User();
result.id = view.getInt32(offset1, true);
result.name = readString(buffer, offset2);
result.age = view.getInt32(offset3, true);
return result;
```

**Avoid:**
- `Object.create(prototype)` - 18% slower than `new Class()`
- `Object.create(null)` - dramatically slower
- IIFE patterns for inline computation - 12% slower

## Hidden Class Stability (CRITICAL)

V8 assigns "hidden classes" (shapes/maps) to objects. Objects with the same property order share hidden classes, enabling fast property access. **Inconsistent property order causes 3x slower property access!**

### Performance Impact

| Pattern | Property Access Speed |
|---------|----------------------|
| Temps → fixed order literal | **109M ops/sec** ✓ |
| Temps → `new Class(a,b,c)` | **98M ops/sec** ✓ |
| Class no-ctor + consistent assign | **95M ops/sec** |
| Dynamic order from BSON | 72M ops/sec |
| Class no-ctor + varying assign | **30M ops/sec** ✗ (3x slower!) |

### Critical Rule

**Always read into temp variables, then construct in consistent order:**

```typescript
// WRONG - dynamic order causes polymorphic hidden classes
function deserializeWrong(buffer) {
    const result: any = {};
    while (hasMoreFields()) {
        const field = readFieldName();
        result[field] = readValue();  // Order depends on BSON
    }
    return result;  // Hidden class varies!
}

// CORRECT - fixed order guarantees stable hidden class
function deserializeCorrect(buffer) {
    let id, name, age;  // Temp variables

    while (hasMoreFields()) {
        switch (readFieldName()) {
            case 'id': id = readInt32(); break;
            case 'name': name = readString(); break;
            case 'age': age = readInt32(); break;
        }
    }

    // ALWAYS construct in same order
    return { id, name, age };  // Stable hidden class!
}
```

### For Classes

Classes with constructors automatically enforce consistent order:

```typescript
// Constructor enforces property order
return new User(id, name, age);  // Always stable

// NO-CTOR classes must assign in consistent order
const result = new User();
result.id = id;      // Always first
result.name = name;  // Always second
result.age = age;    // Always third
return result;
```

### Why This Matters

Objects created by deserializers are typically accessed many times (ORM queries, API responses). A 3x slowdown in property access compounds across an entire application. **The deserialization cost is paid once, but access cost is paid repeatedly.**

## Property Name Matching

### Decision Table

| Method | Performance | Use Case |
|--------|-------------|----------|
| u32 packed comparison | 431M ops/sec | First 4 bytes unique |
| Direct byte comparison | 294M ops/sec | General case |
| Switch on first byte | 350M ops/sec | Many fields, unique first bytes |
| Build string + compare | 40M ops/sec | Avoid in JIT |

### JIT Property Matching Strategy

1. **Pre-compute property patterns at compile time:**
```typescript
// "name" = 0x656d616e in little-endian
const PROP_NAME = 0x656d616e;
// "type" = 0x65707974
const PROP_TYPE = 0x65707974;
```

2. **Use u32 comparison when first 4 bytes are unique:**
```typescript
const nameU32 = view.getUint32(nameOffset, true);
if (nameU32 === PROP_NAME && buffer[nameOffset + 4] === 0x00) {
    // Handle "name" field
}
```

3. **Use switch on first byte when many fields:**
```typescript
switch (buffer[nameOffset]) {
    case 0x6e: // 'n' - could be "name"
        if (view.getUint32(nameOffset, true) === PROP_NAME) { ... }
        break;
    case 0x74: // 't' - could be "type"
        if (view.getUint32(nameOffset, true) === PROP_TYPE) { ... }
        break;
}
```

## JIT Code Generation Patterns

### Pattern 1: Known Schema, Assumed Field Order (Optimal)

When we serialize and immediately deserialize (e.g., IPC), field order is predictable:

```typescript
function deserialize_User(buffer: Uint8Array): User {
    const view = new DataView(buffer.buffer, buffer.byteOffset);

    // Pre-computed offsets at JIT compile time:
    // offset 4:  type byte
    // offset 5:  "id\0" (3 bytes)
    // offset 8:  id value (4 bytes)
    // offset 12: type byte
    // offset 13: "name\0" (5 bytes)
    // offset 18: string length (4 bytes)
    // offset 22: string content (variable)

    const id = view.getInt32(8, true);

    const nameLen = view.getInt32(18, true) - 1;
    let name = '';
    for (let i = 0; i < nameLen; i++) {
        name += String.fromCharCode(buffer[22 + i]);
    }

    const ageOffset = 22 + nameLen + 1; // after string null
    // Skip type byte + "age\0"
    const age = view.getInt32(ageOffset + 5, true);

    return { id, name, age };
}
```

### Pattern 2: Known Schema, Unknown Field Order (MongoDB)

When reading from MongoDB, fields may arrive in any order:

```typescript
function deserialize_User(buffer: Uint8Array): User {
    const view = new DataView(buffer.buffer, buffer.byteOffset);

    // Pre-computed patterns
    const PROP_ID = 0x00006469;     // "id\0" padded
    const PROP_NAME = 0x656d616e;   // "name"
    const PROP_AGE = 0x00656761;    // "age\0" padded

    let id = 0, name = '', age = 0;
    let o = 4; // skip doc size

    while (buffer[o] !== 0x00) {
        const type = buffer[o++];
        const nameStart = o;

        // Fast path: switch on first byte
        switch (buffer[nameStart]) {
            case 0x69: // 'i' - likely "id"
                if (buffer[nameStart + 1] === 0x64 && buffer[nameStart + 2] === 0x00) {
                    o += 3;
                    id = view.getInt32(o, true);
                    o += 4;
                    continue;
                }
                break;
            case 0x6e: // 'n' - likely "name"
                if (view.getUint32(nameStart, true) === PROP_NAME && buffer[nameStart + 4] === 0x00) {
                    o += 5;
                    const len = view.getInt32(o, true) - 1;
                    o += 4;
                    name = textDecoder.decode(buffer.subarray(o, o + len));
                    o += len + 1;
                    continue;
                }
                break;
            case 0x61: // 'a' - likely "age"
                if (buffer[nameStart + 1] === 0x67 && buffer[nameStart + 2] === 0x65 &&
                    buffer[nameStart + 3] === 0x00) {
                    o += 4;
                    age = view.getInt32(o, true);
                    o += 4;
                    continue;
                }
                break;
        }

        // Unknown field - skip it
        o = skipField(buffer, o, type);
    }

    return { id, name, age };
}
```

### Pattern 3: Two-Pass for Complex Types

For types with optional fields or complex nesting, a two-pass approach may be cleaner:

```typescript
function deserialize_User(buffer: Uint8Array): User {
    // Pass 1: Collect field offsets
    const offsets = scanOffsets(buffer);

    // Pass 2: Read values at known offsets
    const id = offsets.id ? view.getInt32(offsets.id, true) : 0;
    const name = offsets.name ? readString(buffer, offsets.name) : '';
    const age = offsets.age ? view.getInt32(offsets.age, true) : 0;

    return { id, name, age };
}
```

## Nested Documents and Arrays

### Embedded Documents

```typescript
// Header: type(0x03) + "user\0"
// Value: [4-byte size][document content]

const docSize = view.getInt32(o, true);
const docEnd = o + docSize;
o += 4;

// Parse embedded document
const user = deserialize_EmbeddedUser(buffer.subarray(o - 4, docEnd));
o = docEnd;
```

### Arrays

Arrays are documents with numeric string keys:

```typescript
// Array: { "0": value, "1": value, "2": value, ... }
const arraySize = view.getInt32(o, true);
const arrayEnd = o + arraySize;
o += 4;

const result: T[] = [];
while (buffer[o] !== 0x00) {
    const type = buffer[o++];

    // Skip index key ("0\0", "1\0", etc.)
    while (buffer[o] !== 0x00) o++;
    o++;

    // Read value based on type
    result.push(readValue(buffer, view, o, type));
    o = skipValue(buffer, o, type);
}
```

## Skip Functions for Unknown Fields

```typescript
function skipField(buffer: Uint8Array, o: number, type: number): number {
    // Skip name
    while (buffer[o] !== 0x00) o++;
    o++;

    // Skip value based on type
    return skipValue(buffer, o, type);
}

function skipValue(buffer: Uint8Array, o: number, type: number): number {
    switch (type) {
        case 0x01: return o + 8;  // double
        case 0x02: return o + view.getInt32(o, true) + 4;  // string
        case 0x03: return o + view.getInt32(o, true);  // document
        case 0x04: return o + view.getInt32(o, true);  // array
        case 0x05: return o + view.getInt32(o, true) + 5;  // binary
        case 0x06: return o;  // undefined
        case 0x07: return o + 12;  // ObjectId
        case 0x08: return o + 1;  // boolean
        case 0x09: return o + 8;  // datetime
        case 0x0A: return o;  // null
        case 0x0B: // regex - two cstrings
            while (buffer[o++] !== 0x00);
            while (buffer[o++] !== 0x00);
            return o;
        case 0x10: return o + 4;  // int32
        case 0x11: return o + 8;  // timestamp
        case 0x12: return o + 8;  // int64
        case 0x13: return o + 16; // decimal128
        default: throw new BSONError(`Unknown BSON type: ${type}`);
    }
}
```

## Performance Reference

### By Operation Type

| Operation | Performance |
|-----------|-------------|
| JIT direct offset read | 1220M ops/sec |
| Sequential field scan | 57M ops/sec |
| String decode (short) | 35M ops/sec |
| String decode (TextDecoder) | 18M ops/sec |
| Object construction | 1760M ops/sec |

### Optimization Priority

1. **Pre-compute field offsets at JIT compile time** when possible
2. **Use DataView for all number reads** (faster than manual extraction)
3. **Use switch on first byte** for property discrimination
4. **Use manual loop for short strings**, TextDecoder for long strings
5. **Use object literals** for result construction

## What NOT to Do

```typescript
// ✗ Don't extract bytes manually for numbers
const value = buffer[o] | (buffer[o+1] << 8) | ...;

// ✗ Don't use Object.create(null)
const result = Object.create(null);

// ✗ Don't build strings for property comparison
let name = '';
while (buffer[o] !== 0) name += String.fromCharCode(buffer[o++]);
if (name === 'field') { ... }

// ✗ Don't use TextDecoder for short discriminator strings
const type = textDecoder.decode(buffer.subarray(o, o + 4));

// ✗ Don't scan when offsets are known
// (e.g., after we serialized the document ourselves)
```

## Implementation Checklist

- [ ] Use DataView for all number reads (int32, int64, double)
- [ ] Use manual charCodeAt loop for strings ≤5 chars
- [ ] Use TextDecoder for strings >15 chars
- [ ] Pre-compute property name patterns as u32 constants
- [ ] Generate switch on first byte for property discrimination
- [ ] Use object literals for result construction
- [ ] Handle unknown field order with scan + skip
- [ ] Optimize for common case (expected field order)
- [ ] Generate skipValue dispatch for unknown fields

## Error Handling Strategy

The deserializer must be solid - handle type mismatches, missing required fields, and extra unknown fields correctly.

### Type Mismatch Handling

Use **lookup tables** for type coercion (like current implementation):

```typescript
// Type coercion table for numbers - indexed by BSONType
const numberParsers = [
    defaultParser,  // 0: unused
    parseDouble,    // 1: DOUBLE → number
    parseString,    // 2: STRING → Number(str)
    parseDoc,       // 3: OBJECT → throw
    parseArray,     // 4: ARRAY → throw
    parseBinary,    // 5: BINARY → throw
    ...
    parseInt,       // 16: INT32 → number
    parseLong,      // 17: TIMESTAMP → number
    parseLong,      // 18: INT64 → Number(bigint)
];

// In JIT code:
const value = numberParsers[elementType](buffer, offset);
if (Number.isNaN(value)) throw new BSONError('invalid type');
```

**Type coercion rules (matching current implementation):**

| Target Type | Allowed BSON Types |
|-------------|-------------------|
| `number` | DOUBLE, INT, LONG, TIMESTAMP, STRING, BOOLEAN, BINARY |
| `string` | STRING, INT, DOUBLE, LONG, BOOLEAN, OID, NULL/UNDEFINED→'' |
| `boolean` | BOOLEAN, INT, DOUBLE, LONG, STRING, NULL/UNDEFINED→false |
| `Date` | DATE, INT, DOUBLE, LONG, TIMESTAMP, STRING |
| `bigint` | INT, LONG, TIMESTAMP, DOUBLE, STRING, BOOLEAN, BINARY |

**For strict type checking:** Only accept exact match, throw otherwise.

### Missing Required Fields

Use **bitmask tracking** (zero overhead):

```typescript
function deserialize(buffer: Uint8Array): User {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let id = 0, name = '', age = 0;
    let seen = 0;  // Bitmask: id=1, name=2, age=4

    let o = 4;
    while (buffer[o] !== 0) {
        const type = buffer[o++];
        const nameStart = o;
        while (buffer[o] !== 0) o++;
        o++;

        // Match property - MUST verify full name, not just first byte!
        // First byte switch is just fast-path optimization
        switch (buffer[nameStart]) {
            case 0x69: // 'i' - could be "id"
                // Verify full name: "id\0"
                if (buffer[nameStart + 1] === 0x64 &&
                    buffer[nameStart + 2] === 0x00) {
                    o = nameStart + 3;  // skip "id\0"
                    if (type !== BSONType.INT && type !== BSONType.LONG) {
                        throw new BSONError(`id: expected number, got ${BSONType[type]}`);
                    }
                    id = view.getInt32(o, true);
                    o += 4;
                    seen |= 1;
                } else {
                    o = skipField(buffer, nameStart, type);
                }
                break;
            case 0x6e: // 'n' - could be "name"
                // Verify full name: "name\0"
                if (buffer[nameStart + 1] === 0x61 &&  // 'a'
                    buffer[nameStart + 2] === 0x6d &&  // 'm'
                    buffer[nameStart + 3] === 0x65 &&  // 'e'
                    buffer[nameStart + 4] === 0x00) {
                    o = nameStart + 5;  // skip "name\0"
                    if (type !== BSONType.STRING) {
                        throw new BSONError(`name: expected string, got ${BSONType[type]}`);
                    }
                    const len = view.getInt32(o, true) - 1;
                    o += 4;
                    name = decodeString(buffer, o, len);
                    o += len + 1;
                    seen |= 2;
                } else {
                    o = skipField(buffer, nameStart, type);
                }
                break;
            case 0x61: // 'a' - could be "age"
                // Verify full name: "age\0"
                if (buffer[nameStart + 1] === 0x67 &&  // 'g'
                    buffer[nameStart + 2] === 0x65 &&  // 'e'
                    buffer[nameStart + 3] === 0x00) {
                    o = nameStart + 4;  // skip "age\0"
                    age = view.getInt32(o, true);
                    o += 4;
                    seen |= 4;
                } else {
                    o = skipField(buffer, nameStart, type);
                }
                break;
            default:
                // Unknown field - skip it
                o = skipField(buffer, nameStart, type);
        }
    }

    // Check required fields (single check at end)
    const REQUIRED = 7;  // All 3 fields required
    if (seen !== REQUIRED) {
        reportMissingFields(seen, REQUIRED);  // Cold path
    }

    return { id, name, age };
}

function reportMissingFields(seen: number, required: number): never {
    const missing: string[] = [];
    if (!(seen & 1)) missing.push('id');
    if (!(seen & 2)) missing.push('name');
    if (!(seen & 4)) missing.push('age');
    throw new BSONError(`Missing required fields: ${missing.join(', ')}`);
}
```

### Performance Impact

| Check | Overhead |
|-------|----------|
| Bitmask tracking | ~0% (same as no validation) |
| Type check per field | Minimal (lookup table) |
| Error throwing | Slow but rare (cold path) |

### Error Modes

Support configurable error handling:

```typescript
interface DeserializeOptions {
    // 'strict' = exact type match only
    // 'loose' = allow coercion (default)
    validation?: 'strict' | 'loose';

    // true = throw on first error (default)
    // false = collect all errors
    failFast?: boolean;
}
```

### Property Name Matching (Full Verification Required)

**CRITICAL:** Always verify the FULL property name, not just the first byte.

**Pattern 1: Byte-by-byte comparison (current implementation)**
```typescript
// For "name" - generates at JIT compile time:
if (buffer[o] === 0x6e &&     // 'n'
    buffer[o + 1] === 0x61 && // 'a'
    buffer[o + 2] === 0x6d && // 'm'
    buffer[o + 3] === 0x65 && // 'e'
    buffer[o + 4] === 0x00) { // '\0'
    // Match!
}
```

**Pattern 2: u32 packed comparison (faster for 4+ char names)**
```typescript
// Pre-compute at JIT compile time:
const PROP_NAME = 0x656d616e;  // "name" as u32 little-endian

// At runtime:
const nameU32 = view.getUint32(nameStart, true);
if (nameU32 === PROP_NAME && buffer[nameStart + 4] === 0x00) {
    // Match!
}
```

**Pattern 3: Switch on first byte as fast-path**
```typescript
switch (buffer[nameStart]) {
    case 0x6e: // 'n' - could be "name"
        if (verifyFullName("name")) {
            // Handle "name" field
        }
        break;
    case 0x69: // 'i' - could be "id" or "index" or "identifier"
        if (verifyFullName("id")) {
            // Handle "id" field
        }
        break;
    default:
        skipField();
}
```

The switch provides a fast-path to skip obviously non-matching fields, but the full name verification is **always required**.

### JIT Code Generation

For each property, generate:

```typescript
// 1. Type check (using lookup or if/else)
if (!isValidType(type, expectedTypes)) {
    throw new BSONError(`${propName}: invalid type ${BSONType[type]}`);
}

// 2. Read value
value = parser(buffer, offset, type);

// 3. Mark as seen
seen |= PROP_BIT;
```

After loop:

```typescript
// 4. Check required fields
if (seen !== REQUIRED_MASK) {
    reportMissing(seen);
}

// 5. Construct result (consistent order for hidden class stability)
return { id, name, age };
```

## Files Created During Research

All benchmarks are in `packages/bson/benchmarks/`:

- `deserialization-patterns.ts` - Core read patterns comparison
- `string-decode-lengths.ts` - String decoding crossover analysis
- `buffer-skip-patterns.ts` - Field scanning and skipping strategies
- `union-deserialization.ts` - Union type discrimination (from earlier)

Run any benchmark with:
```bash
node --import @deepkit/run benchmarks/<filename>.ts
```
