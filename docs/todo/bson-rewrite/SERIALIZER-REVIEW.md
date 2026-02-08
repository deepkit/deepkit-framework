# BSON Serializer Architectural Review

**Date**: 2026-01-30
**Status**: Critical Issues Fixed ✓
**File**: `packages/bson/src/serializer.ts`

## Summary

The BSON serializer implements JIT-compiled serialization using the same `@deepkit/core` Builder API as the type serializer, but with a significantly simpler architecture. After the fixes below, the implementation now handles recursive types correctly and uses proper error codes.

## Architectural Comparison

| Feature | Type Serializer | BSON Serializer |
|---------|-----------------|-----------------|
| Structure | Class-based (`Serializer`, `BuildState`, `HandlerRegistry`) | Function-based, monolithic |
| Dispatch | Registry with hooks, handlers | Direct switch in `serializeValue()` |
| Circular detection | `typeStack` Set | ✓ **Implemented** (BuildContext.typeStack) |
| Depth control | `depth`/`maxDepth` with extraction | Partial (tracked, not yet used for extraction) |
| Function caching | `fnCache` per build | ✓ **Implemented** (extractedSerializerCache) |
| Error paths | `pathSegments` tracking | ✓ **Implemented** (BuildContext.pathSegments) |
| Bidirectional | serialize/deserialize/validate | **Serialize only** |
| Groups support | Full groups filtering | **Missing** |
| Extensibility | Handler registry with hooks | **None** |
| Error codes | Uses `SerializationError` (DK-T200) | ✓ **Uses BSONError/TypeNotSerializableError** |

## Critical Issues (All Fixed ✓)

### 1. ~~Missing Circular Reference Detection~~ ✓ FIXED

**Status**: Resolved

The BSON serializer now implements circular reference detection using `BuildContext.typeStack`:

```typescript
interface BuildContext {
    typeStack: Set<Type>;  // Tracks types during JIT build
    depth: number;         // Current nesting depth
    fnCache: Map<Type, VarRef<SerializeFn>>;  // Extracted function cache
    pathSegments: string[];  // Error path tracking
}
```

**Implementation**:
- `buildObjectSerializer()` adds type to `typeStack` before processing
- `serializeNestedObject()` and `serializeCustomClass()` check `ctx.typeStack.has(type)`
- When recursive type detected, `getExtractedSerializer()` creates a separate function
- Uses wrapper function pattern to handle self-references during JIT build

**Tests passing**:
- `circular reference detection` - Self-referential interfaces
- `complex recursive` - ModuleApi class with `api?: ModuleApi` and `imports: ModuleApi[]`

### 2. ~~No Function Extraction for Complex Types~~ ✓ FIXED

**Status**: Resolved

Depth-based function extraction is now implemented:

```typescript
// In serializeNestedObject and serializeCustomClass:
if (ctx.depth >= MAX_DEPTH) {
    writeHeader(b, buffer, view, o, BSONType.OBJECT, name, true);
    buildExtractedSerializerCall(b, buffer, view, o, type, value, ctx);
    return;
}
```

**Implemented**:
- [x] `BuildContext.depth` tracking
- [x] `forkContext()` increments depth
- [x] Depth check in `serializeNestedObject()` - extracts when `depth >= 3`
- [x] Depth check in `serializeCustomClass()` - extracts when `depth >= 3`

### 3. ~~Missing Error Codes~~ ✓ FIXED

**Status**: Resolved

All `throw new Error()` statements have been replaced with proper error classes:

**Now using**:
- `TypeNotSerializableError` for unsupported types (DK-B060)
- `BSONError` for BSON-specific errors (DK-B060)

### 4. ~~No Error Path Tracking~~ ✓ FIXED

**Status**: Resolved

Error path tracking is now implemented via `BuildContext.pathSegments`:

```typescript
function forkContext(ctx: BuildContext, pathSegment: string): BuildContext {
    return {
        typeStack: ctx.typeStack,
        depth: ctx.depth + 1,
        fnCache: ctx.fnCache,
        pathSegments: [...ctx.pathSegments, pathSegment],
    };
}

function getErrorPath(ctx: BuildContext): string {
    return ctx.pathSegments.length > 0 ? ctx.pathSegments.join('.') : '<root>';
}
```

**Implemented**:
- [x] `pathSegments: string[]` in BuildContext
- [x] `forkContext()` adds segment for each property
- [x] `getErrorPath()` helper for error messages
- [ ] Consider `DynamicPathSegment` for array indices (future enhancement)

## What's Implemented Well

1. **Union Handling**: Same 4-phase strategy as type serializer
   - Phase 1: Simple nullable (`T | null`, `T | undefined`)
   - Phase 2: Discriminated union (O(1) switch)
   - Phase 3: Literal set (5+ literals use `Set.has()`)
   - Phase 4: Scored matching with priority

2. **Header Optimization**: 3-tier batching strategy
   - Packed u32 for short names (1-4 bytes) followed by fixed value
   - Individual bytes for medium names (5-6 bytes)
   - Batched u64 for long names (7+ bytes)

3. **Type Priority**: Same ordering as type serializer
   - null/undefined (0) → bigint (1) → number (2) → boolean (3) → MongoId/UUID (4) → classes (6) → arrays (7) → string (10)

4. **Zero-Copy API**: Returns `[buffer, size]` tuple for efficiency

5. **JIT Architecture**: Uses Builder API correctly for CSP-compliant generation

## Recommendations

### Completed ✓

| Priority | Task | Status |
|----------|------|--------|
| P0 | Add circular reference detection | ✓ Done |
| P0 | Add function extraction for deep (non-recursive) types | ✓ Done |
| P1 | Replace `throw new Error()` with proper error codes | ✓ Done |
| P1 | Add error path tracking | ✓ Done |

### Medium-term (Architectural alignment)

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| P2 | Extract `BSONBuildState` class | Medium | ✓ Done |
| P2 | Implement deserialization (`getBSONDeserializer`) | High | Pending |
| P3 | Consider handler registry for extensibility | High | Pending |

### Long-term (Feature parity)

| Priority | Task | Effort |
|----------|------|--------|
| P3 | Groups support for selective serialization | Medium |
| P3 | Naming strategies for property transformation | Low |
| P4 | Validation hooks during serialization | Medium |

## Example Implementation: Circular Detection

```typescript
// Add to serialize functions:
function serializeValue(
    b: Builder,
    buffer: Ref<Uint8Array>,
    view: Ref<DataView>,
    o: VarRef<number>,
    name: PropertyName,
    type: Type,
    value: Ref<any>,
    typeStack: Set<Type> = new Set(), // Add this
    depth: number = 0,                 // Add this
): void {
    // Circular reference check
    if (typeStack.has(type)) {
        // Option 1: Extract to separate function (lazy)
        // Option 2: Throw at JIT build time if truly circular
        throw new CircularReferenceError(/* path */);
    }

    // Depth check
    if (depth >= MAX_DEPTH && isComplexType(type)) {
        // Extract to separate function
        return extractAndCall(b, type, value, typeStack);
    }

    typeStack.add(type);
    try {
        // ... existing switch statement
        // Pass typeStack and depth+1 to recursive calls
    } finally {
        typeStack.delete(type);
    }
}
```

## Verdict

~~The BSON serializer is **not architecturally sound** for production use in its current state.~~ **UPDATE: Critical issues have been fixed.**

The serializer now handles:
- ✅ Recursive/circular type definitions (via typeStack + extracted functions)
- ✅ Deeply nested types (via depth-based extraction at MAX_DEPTH=3)
- ✅ Error path tracking (via pathSegments)
- ✅ Proper error codes (BSONError, TypeNotSerializableError)

The union handling and JIT optimization techniques are correct and align with the type serializer.

**Remaining gaps for full feature parity:**
- ~~Naming strategies (property transformation)~~ ✓ Implemented (`BSONBuildState.getPropertyName()`)
- ~~Undefined semantics~~ ✓ Implemented (see below)
- Groups support (selective serialization)
- Handler registry (extensibility)
- Deserialization (`getBSONDeserializer`)
- BinaryBigInt/SignedBinaryBigInt serialization (see below)

### P1: BinaryBigInt/SignedBinaryBigInt Support

The `BinaryBigInt` and `SignedBinaryBigInt` type annotations should serialize bigint values as BSON binary, not as BSON Long. These are used for arbitrary-precision integers that exceed Int64 range.

**Current behavior:**
- All bigint values serialize as BSON Long (int64)
- BinaryBigInt/SignedBinaryBigInt annotations are ignored

**Expected behavior:**
```typescript
// BinaryBigInt: unsigned, big-endian binary representation
type BinaryBigInt = bigint & TypeAnnotation<'binaryBigInt'>;
serializer({ position: 9223372036854775810n })  // → BSON binary (8 bytes)

// SignedBinaryBigInt: signed (includes sign byte), big-endian
type SignedBinaryBigInt = bigint & TypeAnnotation<'signedBinaryBigInt'>;
serializer({ position: -123n })  // → BSON binary with sign byte
```

**Implementation approach:**
- Check for `type.typeName === 'BinaryBigInt'` or `type.typeName === 'SignedBinaryBigInt'`
- Or use `originNames` pattern matching (see `packages/type/src/serializer/handlers.ts:152`)
- Write as BSON binary with appropriate subtype and byte encoding

### ✅ Undefined Semantics (Implemented)

The serializer now correctly distinguishes between:
1. **Property present but set to `undefined`/`null`**: Serialize as BSON null
2. **Property not present at all**: Don't serialize

This enables proper database operations like:
```typescript
// These now produce different BSON:
.filter({ bla: undefined })  // → { bla: null } - explicitly filtering for null
.filter({})                  // → {} - no filter on bla
```

**Implementation:**
- Uses `isOptional(prop)` from `@deepkit/type` which handles both `prop?: T` and `prop: T | undefined`
- Uses `key in obj` runtime check to distinguish present vs absent
- Uses `b.isNullish(value)` to check for both `undefined` and `null`
- All four property loops updated: `buildObjectSerializer()`, `serializeNestedObject()`, `serializeCustomClass()`, `getExtractedSerializer()`

## Test Cases ✅ Implemented

These test cases now pass:

```typescript
// ✅ Circular reference - tests/serialize/objects.spec.ts "circular reference detection"
interface Model { id: number; another?: Model; }

// ✅ Complex recursive - tests/serialize/objects.spec.ts "complex recursive"
class ModuleApi { api?: ModuleApi; imports: ModuleApi[] = []; }

// ✅ Deep nesting - tests/serialize/objects.spec.ts "deeply nested object"
type Deep = { a: { b: { c: { d: string } } } };
```
