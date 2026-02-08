# Issue #524: Conditional type inference unexpected

GitHub: https://github.com/deepkit/deepkit-framework/issues/524

## Problem

Conditional type inference with tuple rest elements produced incorrect results:

```typescript
type Foo<T> = T extends [...infer P extends string[], infer L] ? L : never
type Bar = Foo<[string, string, number]> // Should be number, was string

is<Bar>('hello')  // Was true, should be false
is<Bar>(1)        // Was false, should be true
```

## Root Cause

In `packages/type/src/reflection/extends.ts`, the `inferFromTuple` function incorrectly handled infer variables that appear AFTER a rest element in the pattern.

The function collects elements from the left tuple starting at position `i`, but for non-rest infer variables it always took `inferred.types[0]` (the first collected element) regardless of position. This is incorrect for patterns like `[...infer _, infer L]` where `L` should receive the LAST element, not the first element from position 1 onwards.

### Example

Pattern: `[...infer _, infer L]` matching `[string, string, number]`
- Position 0 (`_` rest): collects `[string, string, number]` → correct
- Position 1 (`L` non-rest): collects elements from j >= 1 → `[string, number]`
  - Old behavior: took `types[0]` = `string` ❌
  - Fixed behavior: takes from end based on position = `number` ✓

## Solution

Modified `inferFromTuple` to track if there's a rest element before the current infer variable. When processing a non-rest infer after a rest element, it now correctly extracts from the end of the collected elements based on how many elements follow in the pattern.

## Files Changed

- `packages/type/src/reflection/extends.ts` - Fixed `inferFromTuple` function
- `packages/type/tests/advanced.spec.ts` - Added regression tests

## Status

- [x] Investigation
- [x] Fix implementation
- [x] Tests added
- [x] Verification passed
