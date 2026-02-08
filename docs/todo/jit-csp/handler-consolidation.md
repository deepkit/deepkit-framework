# Handler Consolidation Analysis

**File:** `packages/type/src/serializer/handlers.ts`
**Current:** 4,840 lines | 94 handlers
**Target:** ~1,800 lines | ~40 unified handlers
**Estimated Savings:** ~3,000 lines (62%)

---

## Executive Summary

The handlers file has massive duplication from three sources:
1. **Guard variants** (score/fast/strict) - same logic, different return types
2. **Serialize/deserialize pairs** - often symmetric operations
3. **Repeated patterns** - object checks, property loops, error pushing

### Quick Stats

| Category | Handlers | Lines | After | Savings |
|----------|----------|-------|-------|---------|
| Trivial (1-5 lines) | 25 | 60 | 60 | 0 |
| Small (6-20 lines) | 25 | 320 | 200 | 120 |
| Medium (21-100 lines) | 24 | 1,100 | 500 | 600 |
| Large (100+ lines) | 20 | 3,360 | 1,040 | 2,320 |
| **Total** | **94** | **4,840** | **1,800** | **3,040** |

---

## Part 1: Trivial Handlers (No Change Needed)

These are 1-5 line handlers. Keep as-is.

| Handler | Lines | Notes |
|---------|-------|-------|
| handleString | 1 | `return input` |
| handleNumber | 1 | `return input` |
| handleBoolean | 1 | `return input` |
| handleBigInt | 1 | `String(input)` |
| handleNull | 1 | `ctx.lit(null)` |
| handleUndefined | 1 | `ctx.lit(undefined)` |
| serializeUndefined | 1 | `ctx.lit(null)` |
| handleAny | 1 | `return input` |
| handleUnknown | 3 | `return input` |
| handleLiteral | 1 | return literal value |
| handleEnum | 1 | `return input` |
| handlePromise | 5 | recurse on inner type |
| guardBooleanExact | 2 | `guardWithError(isType)` |
| guardBigIntExact | 2 | `guardWithError(isType)` |
| guardNull | 2 | `guardWithError(isNull)` |
| guardUndefined | 2 | `guardWithError(eq)` |
| guardAny | 1 | `ctx.lit(1000)` |
| guardArray | 3 | `guardWithError(isArray)` |
| guardLiteral | 3 | `guardWithError(eq)` |
| guardDateExact | 3 | `guardWithError(instanceof)` |
| guardRegExp | 3 | `guardWithError(instanceof)` |
| serializeDate | 8 | `toISOString()` |
| deserializeDate | 3 | `new Date(input)` |
| serializeRegExp | 2 | `r.toString()` |
| guardTypedArray | 5 | instanceof check |

**Subtotal: 25 handlers, ~60 lines - KEEP AS-IS**

---

## Part 2: Factory-Based Consolidation

### 2.1 Primitive Guards (Score + Fast) → Factory

**Current: 14 handlers, ~100 lines**

```
guardStringExact (21) + guardStringFast (5) = 26
guardBooleanExact (2) + guardBooleanFast (5) = 7
guardBigIntExact (2) + guardBigIntFast (5) = 7
guardNull (2) + guardNullFast (5) = 7
guardUndefined (2) + guardUndefinedFast (5) = 7
guardAny (1) + guardAnyFast (5) = 6
guardLiteral (3) + guardLiteralFast (9) = 12
```

**After: Factory + 7 calls, ~30 lines**

```typescript
// Factory (15 lines)
function createPrimitiveGuard(
    check: (ctx: Context, input: Slot) => Slot<boolean>,
    errorMsg: string
): { score: TypeHandler; fast: TypeHandler } {
    return {
        score: (type, input, ctx, state) =>
            guardWithError(ctx, state, input, check(ctx, input), 'type', errorMsg),
        fast: (type, input, ctx, state) => check(ctx, input),
    };
}

// Usage (15 lines)
const stringGuards = createPrimitiveGuard((ctx, i) => ctx.isType(i, 'string'), 'Not a string');
const booleanGuards = createPrimitiveGuard((ctx, i) => ctx.isType(i, 'boolean'), 'Not a boolean');
const bigintGuards = createPrimitiveGuard((ctx, i) => ctx.isType(i, 'bigint'), 'Not a bigint');
const nullGuards = createPrimitiveGuard((ctx, i) => ctx.isNull(i), 'Not null');
const undefinedGuards = createPrimitiveGuard((ctx, i) => ctx.eq(i, ctx.lit(undefined)), 'Not undefined');
const anyGuards = { score: () => ctx.lit(1000), fast: () => ctx.lit(true) };
const literalGuards = createPrimitiveGuard((ctx, i, type) => ctx.eq(i, ctx.lit(type.literal)), 'Invalid literal');
```

**Savings: 70 lines**

---

### 2.2 Pattern-Validated IDs (NanoId/UUID/MongoId) → Factory

**Current: 12 handlers, ~130 lines**

```
guardNanoId (12) + guardNanoIdFast (9) + deserializeNanoId (12) = 33
guardUUID (17) + guardUUIDFast (14) + deserializeUUID (17) = 48
guardMongoId (18) + guardMongoIdFast (17) + deserializeMongoId (17) = 52
```

**After: Factory + 3 configs, ~40 lines**

```typescript
// Factory (25 lines)
interface IdPatternConfig {
    pattern?: RegExp;
    length?: number;
    allowEmpty?: boolean;
    errorMsg: string;
}

function createIdHandlers(config: IdPatternConfig) {
    const check = (ctx: Context, input: Slot): Slot<boolean> => {
        let valid = ctx.isType(input, 'string');
        if (config.length) valid = ctx.and(valid, ctx.eq(input.get('length'), ctx.lit(config.length)));
        if (config.pattern) {
            const matches = ctx.callExpr((p, v) => p.test(v), ctx.lit(config.pattern), input);
            valid = config.allowEmpty ? ctx.and(valid, ctx.or(ctx.eq(input, ctx.lit('')), matches)) : ctx.and(valid, matches);
        }
        return valid;
    };
    return {
        guardScore: (type, input, ctx, state) => guardWithError(ctx, state, input, check(ctx, input), 'type', config.errorMsg),
        guardFast: (type, input, ctx, state) => check(ctx, input),
        deserialize: (type, input, ctx, state) => {
            ctx.when(ctx.not(check(ctx, input)), () => state.throw_(type, input, config.errorMsg));
            return input;
        },
    };
}

// Usage (15 lines)
const nanoIdHandlers = createIdHandlers({ length: 21, errorMsg: 'Not a valid NanoId' });
const uuidHandlers = createIdHandlers({
    pattern: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    errorMsg: 'Not a valid UUID'
});
const mongoIdHandlers = createIdHandlers({
    pattern: /^[0-9a-fA-F]{24}$/,
    allowEmpty: true,
    errorMsg: 'Not a MongoId'
});
```

**Savings: 90 lines**

---

### 2.3 Number Guards (Branded) → Unified

**Current: 4 handlers, ~98 lines**

```
guardNumberBranded (47) + guardNumberFast (13) + guardNumberBrandedFast (38) = 98
```

**After: 1 unified handler, ~50 lines**

The number guards have complex brand checking (int8, uint16, float32, etc.). Unify into one handler that checks `state.returnScore` or returns boolean.

**Savings: 48 lines**

---

### 2.4 TypedArray/ArrayBuffer → Unified

**Current: 8 handlers, ~53 lines**

```
serializeTypedArray (5) + deserializeTypedArray (12) = 17
serializeArrayBuffer (5) + deserializeArrayBuffer (12) = 17
guardTypedArray (5) + guardTypedArrayLoose (6) + guardTypedArrayFast (8) = 19
```

**After: 3 handlers, ~30 lines**

```typescript
const handleTypedArray: TypeHandler = (type, input, ctx, state) => {
    const classType = (type as TypeClass).classType;
    if (state.direction === 'serialize') return ctx.callExpr(typedArrayToBase64, input);
    // deserialize with instanceof check
    return ctx.ternary(ctx.isInstance(input, classType), input, ctx.callExpr(base64ToTypedArray, input, ctx.lit(classType)));
};
```

**Savings: 23 lines**

---

### 2.5 Set/Map → Unified Serialize/Deserialize

**Current: 4 handlers, ~47 lines**

```
serializeSet (8) + deserializeSet (8) = 16
serializeMap (15) + deserializeMap (16) = 31
```

**After: 2 handlers with direction check, ~25 lines**

**Savings: 22 lines**

---

### 2.6 Container Guards (Set/Map) → Unified

**Current: 4 handlers, ~241 lines**

```
guardSet (64) + guardSetFast (34) = 98
guardMap (92) + guardMapFast (51) = 143
```

**After: 2 unified handlers, ~80 lines**

Both have identical structure:
1. Check instanceof
2. Iterate elements/entries
3. Validate each with child state

Difference is just score vs boolean return and error collection.

**Savings: 161 lines**

---

## Part 3: Major Consolidations

### 3.1 Object Guards → ONE Unified Handler

**Current: 3 handlers, 859 lines**

```
guardObject (297 lines) - score-based, error collection
guardObjectFast (230 lines) - boolean, collectErrors branch
guardObjectStrict (332 lines) - boolean, rejectUnknownKeys
```

**After: 1 unified handler, ~200 lines**

Key insight: `state` already has `collectErrors` and `rejectUnknownKeys` flags.

```typescript
const guardObject: TypeHandler = (type, input, ctx, state) => {
    // Shared setup (30 lines)
    const members = resolveTypeMembers(type);
    const isObj = isPlainObject(ctx, input);
    const result = ctx.var_(ctx.lit(false));

    // Error on not-object (10 lines)
    if (state.collectErrors) pushTypeError(ctx, state, input, 'Not an object');

    ctx.when(isObj, () => {
        // Property validation - ONE loop (40 lines)
        let propCheck = ctx.lit(true);
        if (state.collectErrors) {
            // Force all evaluations for error collection
            const results = members.map(m => validateProperty(m, input, ctx, state));
            propCheck = results.reduce((a, b) => ctx.and(a, b));
        } else {
            // Short-circuit chain
            for (const m of members) propCheck = ctx.and(propCheck, validateProperty(m, input, ctx, state));
        }

        // Index signatures (30 lines) - shared runtime function
        if (indexSignatures.length > 0) validateIndexSignatures(...);

        // Unknown key rejection (20 lines) - ONLY if state.rejectUnknownKeys
        if (state.rejectUnknownKeys && !indexSignatures.length) checkUnknownKeys(...);

        // Class validator (15 lines) - ONLY if state.collectErrors && isClass
        if (state.collectErrors && isClass) callClassValidator(...);

        ctx.setVar(result, propCheck);
    });

    return ctx.getVar(result);
};
```

**Savings: 659 lines**

---

### 3.2 Array Guards → ONE Unified Handler

**Current: 4 handlers, ~115 lines**

```
guardArray (3) + guardArrayTyped (30) = 33
guardArrayFast (36) + guardArrayStrict (46) = 82
```

**After: 1 unified handler, ~40 lines**

**Savings: 75 lines**

---

### 3.3 Tuple Guards → ONE Unified Handler

**Current: 3 handlers, ~608 lines**

```
guardTuple (120 lines)
guardTupleStrict (93 lines)
guardTupleFast (395 lines)
```

**After: 1 unified handler, ~120 lines**

All three have identical structure:
1. Find rest element position
2. Validate pre-rest elements
3. Validate rest elements
4. Validate post-rest elements

**Savings: 488 lines**

---

### 3.4 Union Guards → ONE Unified Handler

**Current: 2 handlers, ~287 lines**

```
guardUnion (108 lines) - score-based
guardUnionFast (179 lines) - boolean, includes validateUnion runtime function
```

**After: 1 unified handler, ~120 lines**

The `validateUnion` runtime function is duplicated (80 lines each). Extract to module-level shared function.

**Savings: 167 lines**

---

### 3.5 Function Guards → ONE Unified Handler

**Current: 2 handlers, ~86 lines**

```
guardFunction (46 lines)
guardFunctionFast (40 lines)
```

**After: 1 unified handler, ~45 lines**

Both contain identical `validateFunction` runtime helper.

**Savings: 41 lines**

---

### 3.6 Reference Handlers → Consolidate

**Current: 3 handlers, ~221 lines**

```
serializeReference (26)
deserializeReference (89)
guardReference (106) + guardReferenceFast (54) = 160
```

**After: 3 handlers, ~100 lines**

Unify guard variants. Reference serialize/deserialize are genuinely different.

**Savings: 121 lines**

---

### 3.7 Enum Guards → ONE Unified Handler

**Current: 2 handlers, ~56 lines**

```
guardEnum (37)
guardEnumFast (19)
```

**After: 1 unified handler, ~30 lines**

**Savings: 26 lines**

---

### 3.8 Template Literal Guards → ONE Unified Handler

**Current: 2 handlers, ~33 lines**

```
guardTemplateLiteral (13)
guardTemplateLiteralFast (20)
```

**After: 1 unified handler, ~18 lines**

**Savings: 15 lines**

---

### 3.9 handleObjectLiteral + deserializeClass → Shared Helpers

**Current: 2 handlers, ~1,364 lines**

```
handleObjectLiteral (745 lines) - bidirectional serialize/deserialize
deserializeClass (619 lines) - class instantiation
```

These are the biggest handlers and have significant shared patterns:
- Property iteration with nullable/optional handling
- Embedded type processing
- Index signature handling
- Naming strategy application

**After: Shared helpers + 2 handlers, ~600 lines**

Extract:
- `processProperty()` - 50 lines (used 8 times currently)
- `processEmbedded()` - 80 lines (used 4 times currently)
- `processIndexSignature()` - 60 lines (used 3 times currently)

**Savings: 764 lines**

---

## Part 4: Shared Helper Functions

These helpers eliminate repeated patterns across multiple handlers:

### 4.1 `isPlainObject(ctx, input)` - Used 9 times

```typescript
function isPlainObject(ctx: Context, input: Slot): Slot<boolean> {
    return ctx.and(
        ctx.isType(input, 'object'),
        ctx.and(ctx.not(ctx.isNull(input)), ctx.not(ctx.callExpr(Array.isArray, input)))
    );
}
```
**Savings: 18 lines**

### 4.2 `pushTypeError(ctx, state, input, message)` - Used 25+ times

```typescript
function pushTypeError(ctx: Context, state: BuildState, input: Slot, message: string): void {
    const errors = state.optionsSlot.get('errors');
    ctx.when(errors, () => {
        ctx.push(errors, ctx.newExpr(ValidationErrorItem, state.pathSlot(), ctx.lit('type'), ctx.lit(message), input));
    });
}
```
**Savings: 75 lines**

### 4.3 `findTupleRest(tupleType)` - Used 6 times

```typescript
function findTupleRest(type: TypeTuple): { index: number; type?: Type } {
    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            return { index: i, type: (type.types[i].type as any).type };
        }
    }
    return { index: -1 };
}
```
**Savings: 30 lines**

### 4.4 `validateUnionCore()` - Used 2 times (80 lines each)

Extract the shared union validation runtime function.
**Savings: 80 lines**

### 4.5 `callClassValidator()` - Used 2 times (15 lines each)

**Savings: 15 lines**

---

## Summary: Estimated Final State

### By Category

| Category | Current Lines | After Lines | Savings |
|----------|--------------|-------------|---------|
| Trivial handlers (keep) | 60 | 60 | 0 |
| Primitive guards | 100 | 30 | 70 |
| ID pattern handlers | 130 | 40 | 90 |
| Number guards | 98 | 50 | 48 |
| TypedArray handlers | 53 | 30 | 23 |
| Set/Map serialize | 47 | 25 | 22 |
| Set/Map guards | 241 | 80 | 161 |
| Object guards | 859 | 200 | 659 |
| Array guards | 115 | 40 | 75 |
| Tuple guards | 608 | 120 | 488 |
| Union guards | 287 | 120 | 167 |
| Function guards | 86 | 45 | 41 |
| Reference handlers | 221 | 100 | 121 |
| Enum guards | 56 | 30 | 26 |
| Template literal guards | 33 | 18 | 15 |
| Object/Class handlers | 1,364 | 600 | 764 |
| Shared helpers | 0 | 100 | -100 |
| Registration/exports | ~480 | ~300 | 180 |
| **TOTAL** | **4,840** | **~1,800** | **~3,040** |

---

## Implementation Plan

### Phase 1: Quick Wins - COMPLETE
- [x] Extract `isPlainObject()` helper - consolidated 6 usages
- [x] Extract `pushTypeErrorWhen()` helper - consolidated error-pushing pattern
- [x] Extract `findTupleRest()` helper - consolidated 4 usages
- [x] Create primitive guard factory (`createPrimitiveGuardPair`) - string, boolean, bigint, null, undefined, any
- [x] Create ID pattern factory (`createIdPatternHandlers`) - NanoId, UUID, MongoId

### Phase 2: Guard Unification - COMPLETE
- [x] Unify Object guards (3 → 1) - **COMPLETE** - `objectGuards.score`/`.fast` with shared helpers, removed dead `guardObjectFast` (288 lines saved)
- [x] Unify Tuple guards (3 → 1) - **COMPLETE** - `tupleGuards.fast`, removed dead `guardTuple` + duplicate `guardTupleFast` (176 lines saved)
- [x] Unify Array guards (4 → 1) - **COMPLETE** - `arrayGuards.fast`, removed dead `guardArrayTyped` + `guardArrayFast` (56 lines saved)
- [x] Unify Union guards (2 → 1) - **COMPLETE** - `unionGuards.fast` with extracted helpers, removed dead `guardUnion`, preserved #577 (115 lines saved)

### Phase 3: Handler Consolidation - MOSTLY COMPLETE
- [x] Unify Set guards (2 → 1) - `setGuards.score`/`.fast` with shared validation
- [x] Unify Map guards (2 → 1) - `mapGuards.score`/`.fast` with shared validation
- [x] Unify Function guards (2 → 1) - `functionGuards.score`/`.fast` with shared check
- [x] Unify Enum guards (2 → 1) - `enumGuards.score`/`.fast` with Set-based check
- [x] Unify Template Literal guards (2 → 1) - `templateLiteralGuards.score`/`.fast`
- [x] Unify Reference guards (2 → 1) - `referenceGuards.score`/`.fast` with shared isPkOnlyObject check (FIXED semantic bug: fast now accepts PK-only objects)
- [x] Consolidate number handlers - `numberGuards.fast`/`.branded`/`.isBranded` (deleted unused score-based handler)

### Phase 4: Major Refactoring - COMPLETE (limited scope)
- [x] Extract shared property processing - `collectPrefixedPropertyNames()` helper (-7 lines)
- [x] Extract shared embedded processing - **DECLINED** (different assignment contexts)
- [x] Extract shared index signature processing - **DECLINED** (direction-dependent logic, can't safely extract)

**Result: -7 lines** (original -800 estimate was unrealistic - patterns have subtle differences that prevent safe extraction)

---

## Current State (as of 2026-01-24)

**File size:** 4175 lines (started ~4840, saved 665 lines, 13.7% reduction)
**Tests:** All 1943 tests passing

### Pattern Used for Unification

All unified guards follow this pattern:
```typescript
const fooGuards = {
    // Shared validation function(s)
    validateFast: (...) => boolean,
    validateScore: (...) => number,
    // Handler implementations
    score: ((type, input, ctx, state) => { ... }) as TypeHandler,
    fast: ((type, input, ctx, state) => { ... }) as TypeHandler,
};
const guardFoo = fooGuards.score;
const guardFooFast = fooGuards.fast;
```

### Pending Items Analysis

**Array guards:** Have different loop structures:
- `guardArrayTyped`: uses `ctx.map`, returns score
- `guardArrayFast`: uses `ctx.loop`, returns boolean
- `guardArrayStrict`: uses `ctx.loop` with `state.forIndex()` for error paths

**Union guards:** Have 3 code paths in fast version:
1. Large literal union: Set.has() optimization
2. Error-collecting: uses validateUnion runtime function
3. Non-error-collecting: builds || chain
Risk: Breaking #577 constraint-specific errors

**Reference guards:** ✅ UNIFIED + BUG FIX
- Created `referenceGuards` with `.score`/`.fast` and shared `isPkOnlyObject` helper
- Fixed semantic bug: fast version was missing `isPkOnlyObj` check, incorrectly rejecting valid `{ id: 34 }` shorthand
- Both versions now accept: Reference instances, PK-only objects, full objects, or bare PK values

---

## Verification Checklist

After each change, run:
```bash
node --expose-gc --max_old_space_size=3048 node_modules/jest/bin/jest.js --forceExit --no-cache "packages/type/"
```

All 1943 tests must pass.
