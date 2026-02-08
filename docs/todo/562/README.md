# Issue #562: serialize<T> circular import error

**Status:** Completed
**Package:** @deepkit/type
**Type:** DX improvement

## Summary

Improved error messages when users encounter "No type information received" errors. The bare error message has been replaced with the detailed `NoTypeReceived` error class which includes:
- Context about which function was called
- 5 common causes
- 5 actionable fixes
- Link to documentation

## Changes

1. `packages/type/src/reflection/reflection.ts`
   - `typeOf<T>()` now throws `NoTypeReceived('typeOf<T>() called without type parameter')`
   - `ReflectionClass.from<T>()` now throws `NoTypeReceived('ReflectionClass.from<T>() called without type parameter')`

2. `packages/type/tests/error-messages.spec.ts` (new)
   - 4 regression tests verifying helpful error messages

## Testing

- All 1916 type package tests pass
- 4 new regression tests added
