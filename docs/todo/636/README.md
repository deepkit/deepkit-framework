# Issue #636: Hydrate fetched objects in identity map

## Summary

When the same entity appears multiple times in a query result via different paths, they should share the same hydrated instance. Currently reference proxies block access to fully loaded objects.

## GitHub Link

https://github.com/deepkit/deepkit-framework/issues/636

## Context

- **Package**: @deepkit/orm
- **Severity**: Medium
- **Type**: Bug
- **Status**: ✅ FIXED

## Current Behavior (Before Fix)

```typescript
const review = await session.query(Review)
    .innerJoinWith('book')
    .innerJoinWith('user')
    .findOne();

// review.user is FULLY HYDRATED (joined explicitly)
// review.book.author is a REFERENCE PROXY (not joined, only has PK)

review.user.name;        // ✓ Works - "Peter"
review.book.author.name; // ✗ Fails - unpopulated reference error
```

## Expected Behavior

Both `review.user` and `review.book.author` should be the same object instance when they reference the same User entity. Accessing properties on either should work.

## Solution

### Approach: Upgrade References In-Place

When processing joined data and finding a reference proxy in the pool/identity-map, we **upgrade** the proxy to a full object by:

1. **Changing the prototype** from `ReferenceClass` to `EntityClass` (`Object.setPrototypeOf`)
2. **Assigning properties directly** to the object

This approach:
- Preserves object identity (all holders see the same upgraded object)
- Makes `isReferenceInstance()` return `false` after upgrade
- Is 3.4x faster than using `Object.defineProperty` (benchmarked)
- Results in faster property access after upgrade

### Object Identity Within a Query

References are upgraded whenever the full entity data is available within the same query - whether via explicit joins OR when the entity appears as a root result. This ensures consistent object identity: there is only ONE object representation per entity within a query.

```typescript
// Joined data: book.author IS upgraded because user is joined
Review.innerJoinWith('book').innerJoinWith('user')
// → review.book.author === review.user (same object, upgraded)

// Root result: block.previous IS upgraded because Block#2 is also a root result
Block.query().filter({ id: { $in: [1, 2] } }).find()
// → block1.previous === block2 (same object, upgraded)

// NOT upgraded: when the referenced entity is NOT in the result set
Product.query().findOne()
// → product.category remains a reference (Category was never loaded)
```

### Files Changed

- `packages/orm/src/formatter.ts`
  - Added `upgradeReferenceToObject()` function using `Object.setPrototypeOf` + direct assignment
  - Updated pool lookup to always upgrade references when full data is available
  - Updated identity map lookup with same logic
  - Object identity is preserved: same entity = same object within a query

### Tests Added

- `packages/orm/tests/identity-map.spec.ts`
  - `identity map hydrates references when full object is loaded via join`
  - `identity map reference upgrade with multiple overlapping references`
  - `self-referencing entity: FK references are upgraded when entity appears in same query`
  - `self-referencing entity: FK references ARE upgraded when joined`

## Tasks

- [x] Understand reference proxy internals (can it be upgraded in place?)
- [x] Benchmark different upgrade approaches
- [x] Implement `upgradeReferenceToObject` using Option E (setPrototypeOf + assign)
- [x] Write explicit test cases for both scenarios
- [x] Run full ORM test suite
- [x] Run SQLite integration tests
- [x] Verify the bookstore test passes
- [x] Ensure object identity for ALL queries (pool always upgrades references)

## Progress Log

| Date | Action |
|------|--------|
| 2026-01-20 | Started investigation, analyzed formatter and identity map |
| 2026-01-20 | Benchmarked 5 approaches for upgrading references |
| 2026-01-20 | Implemented Option E (setPrototypeOf + direct assign) - 3.4x faster |
| 2026-01-20 | Added isJoinedData flag to prevent upgrading FK references incorrectly |
| 2026-01-20 | Added 4 dedicated tests, all ORM and SQLite tests pass |
