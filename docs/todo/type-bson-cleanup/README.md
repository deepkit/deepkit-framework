# Type/BSON Cleanup Tasks

Approved cleanup tasks for `@deepkit/type` and `@deepkit/bson` packages.

## Dead Code Removal

### 1. Remove `estimateStringSize()`
- **File**: `packages/bson/src/writer.ts:250`
- **Issue**: Exported but never used anywhere
- **Action**: Delete function

### 2. Remove unused BSON binary subtype constants
- **File**: `packages/bson/src/types.ts:85-92`
- **Constants to remove**:
  - `BSON_BINARY_SUBTYPE_FUNCTION`
  - `BSON_BINARY_SUBTYPE_OLD_BINARY`
  - `BSON_BINARY_SUBTYPE_OLD_UUID`
  - `BSON_BINARY_SUBTYPE_MD5`
  - `BSON_BINARY_SUBTYPE_ENCRYPTED`
  - `BSON_BINARY_SUBTYPE_COLUMN`
  - `BSON_BINARY_SUBTYPE_USER_DEFINED`

### 3. Remove `BSON_MAX_SIZE` constant
- **File**: `packages/bson/src/types.ts:107`
- **Issue**: Never used
- **Action**: Delete constant

### 4. Remove commented-out code
- **File**: `packages/type/src/inheritance.ts:10-31` - old `findCommonDiscriminant()` function
- **File**: `packages/type/src/utils.ts:138-155` - old type definitions
- **Action**: Delete commented blocks

## Code Deduplication

### 5. Refactor type guard builders
- **File**: `packages/type/src/serializer/serializer.ts:234-378`
- **Issue**: Three nearly identical methods (~150 lines):
  - `buildFastTypeGuard()`
  - `buildStrictTypeGuard()`
  - `buildWeakTypeGuard()`
- **Action**: Create single `buildTypeGuard(mode: 'fast' | 'strict' | 'weak')` function

### 6. Refactor guard function pairs with factory
- **File**: `packages/type/src/serializer/handlers.ts`
- **Issue**: 26 pairs of functions (e.g., `guardNumberExact` + `guardNumberFast`) with identical logic, only differ in return wrapping
- **Action**: Create factory function to generate both variants, eliminate ~500 lines

### 7. Deduplicate BSONBuildState/BsonBuildContext
- **File**: `packages/bson/src/context.ts`
- **Issue**: Duplicate methods in both classes:
  - `getPropertyName()`
  - `forProperty()`
  - `forIndex()`
- **Action**: Extract shared logic or have one extend/delegate to the other

## Performance Improvements

### 8. Optimize `scoreMember()` allocations
- **File**: `packages/type/src/serializer/union.ts:528`
- **Issue**: `Object.keys()` allocated per union member, then uses `.includes()`
- **Action**: Cache keys array once, convert to Set for O(1) lookups

### 9. Combine filter().map() into single loop
- **File**: `packages/type/src/serializer/union.ts:571-573`
- **Issue**: Two intermediate array allocations
- **Action**: Single loop that filters and collects in one pass

## Consistency Fixes

### 10. Convert plain Error to DeepkitError with codes
- **Files**:
  - `packages/type/src/reflection/reflection.ts:473,495`
  - `packages/type/src/serializer/serializer.ts:244,298,353`
  - `packages/type/src/serializer/validation.ts:114`
  - `packages/bson/src/reader.ts:190`
- **Action**: Replace `throw new Error(...)` with `throw new DeepkitError('DK-T###', ...)` or `BSONError`

### 11. Standardize parameter naming
- **File**: `packages/bson/src/model.ts`
- **Issue**: Uses `byteIndex` while similar functions use `offset`
- **Action**: Rename to `offset` for consistency

## Type Safety Improvements

### 12. Add length validation for ObjectId/UUID parsing
- **File**: `packages/bson/src/serializer.ts:1169,1182`
- **Issue**: `charCodeAt()` access assumes correct string length without validation
- **Action**: Add length checks before parsing

### 13. Make `hexCharToNumber` non-exported
- **File**: `packages/bson/src/model.ts:30`
- **Issue**: Exported but only used internally
- **Action**: Remove `export` keyword

---

## NOT Fixing (Declined)

- `isGroupAllowed()` array.includes() in `state.ts` - acceptable
- Unsafe non-null assertion chains in `processor.ts` - intentional
- Unchecked array access in `type.ts` - intentional
- `parent: undefined as any` casts in `processor.ts` - intentional for type system

---

## Verification

After each change:
```bash
npm run tsc -- --build packages/type/tsconfig.json packages/type/tsconfig.esm.json
npm run tsc -- --build packages/bson/tsconfig.json packages/bson/tsconfig.esm.json
npm run test packages/type/
npm run test packages/bson/
```
