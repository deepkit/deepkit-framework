# Unified Serializer Implementation Guide

**Date**: 2026-02-01
**Status**: Draft - Awaiting Review
**Scope**: `@deepkit/type`, `@deepkit/bson`

---

## Overview

This document guides the implementation of shared serialization infrastructure between `@deepkit/type` and `@deepkit/bson`. The goal is to **share code** (not just interfaces) to reduce duplication while preserving each package's optimizations.

### Goals

1. **BaseState abstract class** - Share common state management code
2. **Union utilities** - Extract duplicated union handling logic
3. **HandlerRegistry for BSON** - Align BSON with the registry pattern

### Non-Goals

- No `OutputStrategy` interface (limits micro-optimizations)
- No changes to @deepkit/type's existing API

---

## Current State Analysis

### Shared Concepts (Duplicated Code)

| Concept | @deepkit/type | @deepkit/bson |
|---------|---------------|---------------|
| Type stack | `typeStack: Set<Type>` | `typeStack: Set<Type>` |
| Depth tracking | `depth`, `maxDepth` (default 3) | `depth`, `MAX_DEPTH` (3) |
| Path segments | `pathSegments: (string\|DynamicPathSegment)[]` | `pathSegments: string[]` |
| Naming strategy | `namingStrategy: NamingStrategy` | `namingStrategy: NamingStrategy` |
| Extraction decision | `shouldExtract()` logic in `build()` | `shouldExtract()` method |
| Forking (property) | `forProperty()` - shares typeStack | `forProperty()` - shares typeStack |
| Forking (index) | `forIndex()` - fresh typeStack | `forIndex()` - fresh typeStack |
| Union discrimination | `detectDiscriminator()` | IDENTICAL `detectDiscriminator()` |
| Union literal check | `isAllLiterals()` | IDENTICAL `isAllLiterals()` |

### Type-Specific (Stay in BuildState)

- `direction: 'serialize' | 'deserialize' | 'validate'`
- `validation: 'strict' | 'loose' | 'fast'`
- `collectErrors`, `rejectUnknownKeys`, `inUnionContext`
- `optionsRef: Ref<SerializationOptions>`
- `buildOptions: BuildOptions` (baked groups/loose)
- `serializer: Serializer` reference

### BSON-Specific (Stay in BSONBuildState)

- Buffer/view/offset passed as function parameters (not in state)
- BSON-specific error throwing (BSONError)

---

## Architecture

### File Structure

```
packages/type/src/serializer/
├── base-state.ts        # NEW: BaseState abstract class
├── union-utils.ts       # NEW: Shared union utilities
├── state.ts             # BuildState extends BaseState
├── registry.ts          # HandlerRegistry (existing)
├── union.ts             # Uses union-utils
├── handlers.ts          # (existing)
└── ...

packages/bson/src/
├── serializer.ts        # BSONBuildState extends BaseState
├── handlers.ts          # NEW: BSON handlers for registry
└── ...
```

### Class Hierarchy

```
BaseState (abstract)
├── typeStack: Set<Type>
├── depth: number
├── maxDepth: number
├── pathSegments: PathSegment[]
├── namingStrategy: NamingStrategy
├── fnCache: Map<Type, VarRef<Function>>
├── b: Builder
│
├── shouldExtract(type): boolean
├── pushType(type): void
├── popType(type): void
├── getPath(): string
├── abstract fork(options): this
├── abstract buildInline(type, input): Ref
│
└── build(type, input): Ref  // Shared inline-vs-extract logic

BuildState extends BaseState
├── direction, validation, collectErrors, ...
├── optionsRef, serializer, registry, buildOptions
├── forProperty(), forIndex(), forUnionMember(), ...
├── throw_(), addValidationError(), pathRef()
└── buildInline() → registry.build()

BSONBuildState extends BaseState
├── (minimal additional fields)
├── forProperty(), forIndex()
├── throw_() → BSONError
└── buildInline() → registry.build()
```

---

## Implementation Steps

### Step 1: Create BaseState Abstract Class

**File**: `packages/type/src/serializer/base-state.ts`

**What it contains**:
- Shared fields: `typeStack`, `depth`, `maxDepth`, `pathSegments`, `namingStrategy`, `fnCache`, `b`
- Shared methods: `shouldExtract()`, `pushType()`, `popType()`, `getPath()`
- Shared `build()` logic (inline vs extract decision)
- Abstract `buildInline()` method (subclasses implement)
- Abstract `fork()` method for creating child states

**Key design decisions**:

1. **fnCache scoping**: The `build()` method handles mutual recursion vs depth-based extraction differently:
   - Mutual recursion (typeStack.has(type)): reuse fnCache entry
   - Depth-based extraction: create fresh VarRef (different code paths)

2. **PathSegment type**: Use `string | { ref: Ref<number> }` to support both static property names and dynamic array indices.

3. **Constructor pattern**: Take an options object for flexibility.

**Acceptance criteria**:
- [ ] BuildState can extend BaseState without behavior change
- [ ] All existing @deepkit/type tests pass
- [ ] No new exports from @deepkit/type index (internal refactor)

---

### Step 2: Migrate BuildState to Extend BaseState

**File**: `packages/type/src/serializer/state.ts`

**Changes**:
- `BuildState extends BaseState`
- Move shared fields/methods to BaseState
- Keep type-specific fields in BuildState
- Implement abstract methods

**Key considerations**:
- `buildInline()` calls `this.registry.build(type, input, this.b, this)`
- Forking methods (`forProperty`, `forIndex`, etc.) create new BuildState instances
- Preserve all existing behavior exactly

**Acceptance criteria**:
- [ ] All @deepkit/type tests pass unchanged
- [ ] No API changes visible to consumers

---

### Step 3: Extract Union Utilities

**File**: `packages/type/src/serializer/union-utils.ts`

**Extract these functions** (currently duplicated):
```typescript
// Discriminator detection - identical in both packages
export function detectDiscriminator(type: TypeUnion): DiscriminatorInfo | undefined

// Literal union check - identical in both packages
export function isAllLiterals(type: TypeUnion): boolean

// Threshold constant
export const UNION_LITERAL_THRESHOLD = 5

// Type classification helpers
export function isPrimitive(type: Type): boolean
export function isObjectLike(type: Type): boolean
```

**Do NOT extract** (format-specific):
- `buildScoredUnion()` - uses optionsRef, direction, serializer
- `getPrimitiveTypeCheck()` - has loose mode logic
- Error throwing (different error types)

**Acceptance criteria**:
- [ ] union.ts imports from union-utils.ts
- [ ] BSON can import these utilities
- [ ] All tests pass

---

### Step 4: Create BSON HandlerRegistry

**File**: `packages/bson/src/handlers.ts`

**Create registry with BSON-specific handlers**:
```typescript
export function createBSONSerializeRegistry(): HandlerRegistry {
    const registry = new HandlerRegistry('serialize');

    registry.register(ReflectionKind.string, serializeString);
    registry.register(ReflectionKind.number, serializeNumber);
    // ... all type handlers

    registry.registerClass(Date, serializeDate);
    registry.registerClass(Map, serializeMap);
    // ... class handlers

    registry.addDecorator(isUUIDType, serializeUUID);
    registry.addDecorator(isMongoIdType, serializeMongoId);
    // ... annotation handlers

    return registry;
}
```

**Handler signature alignment**:
```typescript
// Current BSON signature (internal):
(b, buffer, view, offset, name, type, value, ctx) => void

// Target signature (HandlerRegistry compatible):
(type, input, b, state) => Ref
```

**Key insight**: BSON handlers need buffer/view/offset, but these can be accessed from state or passed differently. We need to design the BSONBuildState to provide these.

**Acceptance criteria**:
- [ ] BSON serialization uses HandlerRegistry for dispatch
- [ ] All BSON tests pass
- [ ] Performance within 5% of current (benchmark)

---

### Step 5: Migrate BSONBuildState to Extend BaseState

**File**: `packages/bson/src/serializer.ts`

**Changes**:
- Import `BaseState` from `@deepkit/type`
- `BSONBuildState extends BaseState`
- Add BSON-specific fields (buffer refs if needed)
- Implement `buildInline()` to use registry

**Design decision - buffer access**:

Option A: Pass buffer/view/offset in state
```typescript
class BSONBuildState extends BaseState {
    readonly buffer: Ref<Uint8Array>;
    readonly view: Ref<DataView>;
    readonly offset: VarRef<number>;
}
```

Option B: Keep as function parameters, state provides them via method
```typescript
class BSONBuildState extends BaseState {
    getBufferContext(): { buffer, view, offset }
}
```

**Recommendation**: Option A - cleaner, matches how BuildState carries optionsRef.

**Acceptance criteria**:
- [ ] BSONBuildState extends BaseState
- [ ] All BSON tests pass
- [ ] Shared code actually used (not just interface compliance)

---

### Step 6: BSON Uses Shared Union Utilities

**File**: `packages/bson/src/serializer.ts`

**Changes**:
- Import `detectDiscriminator`, `isAllLiterals`, `UNION_LITERAL_THRESHOLD` from `@deepkit/type`
- Remove duplicated implementations
- Keep BSON-specific union handling (Phase 0 simple nullable, BSON error types)

**Acceptance criteria**:
- [ ] No duplicated union utility code
- [ ] BSON union tests pass
- [ ] Discriminated unions work correctly

---

## Verification Checklist

After each step:
1. Run `npm run tsc` - TypeScript compiles
2. Run tests for affected packages
3. No public API changes (internal refactor)

Final verification:
1. All @deepkit/type tests pass
2. All @deepkit/bson tests pass
3. Benchmark shows no performance regression (< 5%)
4. Code review confirms shared code is actually used

---

## Code References

### Current @deepkit/type BuildState
- File: `packages/type/src/serializer/state.ts`
- Lines 132-638
- Key methods: `build()` (517-532), `buildInline()` (537-544), `buildExtractedCall()` (555-637)

### Current @deepkit/bson BSONBuildState
- File: `packages/bson/src/serializer.ts`
- Lines 103-205
- Key methods: `shouldExtract()` (181-183), `forProperty()` (145-152), `forIndex()` (159-166)

### Duplicated Union Code
- @deepkit/type: `packages/type/src/serializer/union.ts` lines 51-88
- @deepkit/bson: `packages/bson/src/serializer.ts` lines 2317-2368

### HandlerRegistry
- File: `packages/type/src/serializer/registry.ts`
- Lines 60-276

---

## Open Questions for Review

1. **PathSegment type**: Should we use `string | DynamicPathSegment` (current type) or simplify to `string | { ref: Ref<number> }`?

2. **BSON buffer access**: Should buffer/view/offset be fields on BSONBuildState or accessed via method?

3. **Handler signature**: BSON handlers currently have a different signature. Should we:
   - A) Adapt BSON handlers to match TypeHandler signature
   - B) Create BSONTypeHandler with different signature
   - C) Use adapter pattern

4. **Export strategy**: Should BaseState be exported from @deepkit/type's public API, or kept internal?

---

## Next Steps

1. Review this document
2. Answer open questions
3. Implement Step 1 (BaseState)
4. Review & approve Step 1
5. Continue with subsequent steps

Each step should be a separate commit for easy review and potential rollback.
