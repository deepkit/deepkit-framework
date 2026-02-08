# Type Guard Simplification Plan

## Problem

Current architecture has massive code duplication:
- 6 registries: `serializeRegistry`, `deserializeRegistry`, `typeGuards`, `fastTypeGuards`, `strictTypeGuards`, `validators`
- Duplicated handlers: `guardStringFast`, `guardStringStrict`, etc.
- Hook system adds complexity
- Validation logic scattered

## Goal

Minimal architecture:
- ONE `typeGuards` registry with simple handlers
- Build process handles mode and validators
- No duplicated handlers

## Architecture

### Handlers (minimal)
```typescript
guardString: (type, input, ctx, state) => ctx.isType(input, 'string')
guardNumber: (type, input, ctx, state) => ctx.and(ctx.isType(input, 'number'), ctx.not(ctx.callExpr(Number.isNaN, input)))
guardBoolean: (type, input, ctx, state) => ctx.isType(input, 'boolean')
// etc.
```

### Build Process (handles modes + validators)
```typescript
// In BuildState.build() or registry.build():
let result = handler(type, input, ctx, state);  // basic type check

// Add validators if present on this type
const validators = validationAnnotation.getAnnotations(type);
for (const { name, args } of validators) {
    const validatorFn = validators[name]?.(...args);
    result = ctx.and(result, ctx.not(ctx.callExpr(validatorFn, input)));
}

// Mode-specific code generation
if (state.validation === 'fast') {
    return result;  // pure && chain
} else {
    // Generate error collection pattern
    // if (!result) { errors.push(...) }
}
```

### Generated Code Examples

**Fast mode** (`is<T>(data)`):
```javascript
return typeof data === "object" && data !== null
    && typeof data.name === "string" && !minLengthValidator(data.name)
    && typeof data.age === "number"
```

**Slow mode** (`validate<T>(data, {errors})`):
```javascript
let valid = true;
if (typeof data.name !== "string") {
    errors.push({path: "name", ...});
    valid = false;
} else {
    const err = minLengthValidator(data.name);
    if (err) { errors.push({path: "name", ...}); valid = false; }
}
// ... continue for all fields
return valid;
```

## Progress

### Phase 1: Consolidate Registries
- [ ] Remove `fastTypeGuards` registry from Serializer (next step)
- [x] Remove `strictTypeGuards` registry from Serializer - DONE
- [ ] Keep ONE `typeGuards` registry (or rename to `typeGuardRegistry`)

### Phase 2: Simplify Handlers
- [x] Removed strict handlers (`guardObjectStrict`, `guardArrayStrict`, `guardTupleStrict`) - ~200 lines removed
- [ ] Remove duplicated handlers (`guardStringFast`, `guardStringStrict`, etc.)
- [ ] Keep only simple handlers that return type check expressions
- [ ] Remove hook system (`addPreHook`, `addPostHook`, `TypeHook` type)

### Phase 3: Update Build Process
- [x] Modify `BuildState.buildInline()` to:
  - Check for validators on the type via `addValidators()` method
  - Add validator expressions to result
  - Handle fast vs slow mode code generation
  - DONE: Added `addValidators()` in state.ts
- [x] Added `addStrictKeyCheck()` for unknown key detection in strict mode
- [x] Added `buildElementTypeGuard()` to propagate validation mode to nested elements

### Phase 4: Update Public API
- [x] `buildFastTypeGuard()` - uses `validation: 'fast'`
- [x] `buildStrictTypeGuard()` - uses `validation: 'strict'` with `fastTypeGuards` registry
- [x] `buildTypeGuard()` - uses `validation: 'loose'` or `'strict'` based on `withLoose` param
- [x] All use the SAME registry (`fastTypeGuards`), just different `state.validation` mode

### Phase 5: Fix Failing Tests
- [x] `use-cases.spec.ts` - custom iterable (ctx.callExpr not emitting) - FIXED
- [x] `type-annotation.spec.ts` - validators now run in fast path - FIXED
- [x] `typeguard.spec.ts` - all 42 tests passing

### Phase 6: Cleanup
- [x] Fixed `is()` function overload detection bug
- [ ] Remove unused code
- [ ] Update any imports/exports
- [x] Verify all tests pass (1943 passed, 4 skipped)

## Bug Fixed: `is()` Overload Detection

The type compiler injects type parameters into ALL `ReceiveType<T>` annotated parameters.
In `is()` function, this meant `receiveType` was always defined, causing it to always
use the old API path with strict mode (`buildTypeGuard(type, false)`).

Fixed by changing the condition from:
```typescript
if (serializerOrType instanceof Serializer || errors !== undefined || receiveType !== undefined)
```
to:
```typescript
if (serializerOrType instanceof Serializer || errors !== undefined)
```

And updated the new API path to use `buildTypeGuard(type, true)` (loose mode) instead
of `buildFastTypeGuard()` to ensure constraints like `integer` are still validated.

## Files Modified

1. `packages/type/src/serializer/serializer.ts` - removed `strictTypeGuards` registry
2. `packages/type/src/serializer/registry.ts` - added `buildElementTypeGuard` to interface
3. `packages/type/src/serializer/handlers.ts` - removed strict handlers (~200 lines)
4. `packages/type/src/serializer/state.ts` - added `addValidators()`, `addStrictKeyCheck()`, `buildElementTypeGuard()`
5. `packages/type/src/serializer/index.ts` - removed `registerStrictTypeGuards` export
6. `packages/type/src/typeguard.ts` - fixed overload detection bug

## Next Steps

1. Remove `fastTypeGuards` registry - unify into single `typeGuards` registry
2. Simplify primitive handlers to be minimal type checks
3. Have build process add validators uniformly
4. Remove hook system if unused
