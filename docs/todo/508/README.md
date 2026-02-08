# Issue #508: Improve error message "No valid runtime type for x given"

GitHub: https://github.com/deepkit/deepkit-framework/issues/508

## Problem

The error message "No valid runtime type for x given" and "No type information received" were not helpful enough for users to understand what went wrong and how to fix it.

## Solution

Improved error messages to include:
1. Clear context about what operation failed
2. List of common causes
3. Step-by-step instructions on how to fix the issue
4. Link to documentation

### New Error Message Format

```
No type information received.

Context: [specific context like "resolveReceiveType called with undefined type"]

This error occurs when @deepkit/type cannot find runtime type information for a type.

Common causes:
  1. @deepkit/type-compiler is not installed or not configured correctly
  2. TypeScript's "reflection" option is not enabled in tsconfig.json
  3. Circular imports preventing type resolution
  4. Type imported from a file/package without type compilation
  5. Using a type that was declared with "declare" keyword

How to fix:
  1. Install the type compiler: npm install @deepkit/type-compiler
  2. Run: npx deepkit-type-install (patches TypeScript for reflection)
  3. Add to tsconfig.json: { "compilerOptions": { "reflection": true } }
  4. If using a bundler (Vite, webpack, etc.), ensure the transformer is configured
  5. Check for circular imports between files

For more information, see: https://deepkit.io/documentation/runtime-types
```

## Files Changed

- `packages/type/src/utils.ts` - Added `createRuntimeTypeError()` helper function, updated `NoTypeReceived` class
- `packages/type/src/reflection/processor.ts` - Updated error message in `_reflect()`
- `packages/type/src/reflection/reflection.ts` - Updated `resolveReceiveType()` to use context-aware errors
- `packages/type/src/typeguard.ts` - Updated `getValidatorFunction()` to use context-aware errors

## Status

- [x] Investigation
- [x] Implementation
- [x] Verification passed
