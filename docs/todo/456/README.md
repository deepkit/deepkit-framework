# Issue #456: Receive types doesn't work in Vite for imported types

**GitHub**: https://github.com/deepkit/deepkit-framework/issues/456
**Package**: type-compiler, vite, bun
**Priority**: Medium
**Created**: 2023-06-13

## Status: FIXED

### Fix Date: 2026-01-19

## Problem (as reported)

```ts
// shared.ts
export interface CreateUserData {
    readonly name: string & MinLength<10>;
}

// main.ts
import { CreateUserData } from './shared';

function fn<T>(t?: ReceiveType<T>) {
    return resolveReceiveType(t);
}

fn<CreateUserData>(); // {kind: 0} - WRONG
```

## Root Cause

The issue was caused by missing reflection configuration. When no `reflection` option is set in tsconfig.json, the transformer defaults to `mode: 'never'` and does nothing.

## Solution

Improved the `DeepkitLoader` API and updated Vite/Bun plugins to use it:

1. **New `DeepkitLoader` options**:
   - `tsConfig`: Path to tsconfig.json (respects its reflection setting)
   - `reflection`: Override reflection mode ('default', 'explicit', 'never')
   - `compilerOptions`: Additional TypeScript compiler options

2. **Updated Vite plugin** to use `DeepkitLoader` with:
   - `reflection` option for simple projects
   - `tsConfig` option for projects with tsconfig setup

3. **Updated Bun plugin** similarly

## Usage

### Simple projects (no tsconfig setup needed)

```ts
// vite.config.ts
import { deepkitType } from '@deepkit/vite';

export default {
  plugins: [
    deepkitType({ reflection: 'default' })
  ]
}
```

### Projects with tsconfig

```ts
// vite.config.ts
import { deepkitType } from '@deepkit/vite';

export default {
  plugins: [
    deepkitType({ tsConfig: './tsconfig.json' })
  ]
}
```

The tsconfig.json must have:
```json
{
  "reflection": true
}
```

## Files Changed

- `packages/type-compiler/src/loader.ts` - New options API
- `packages/vite/src/plugin.ts` - Uses DeepkitLoader
- `packages/bun/src/plugin.ts` - Uses DeepkitLoader
- `packages/type-compiler/tests/vite-simulation.spec.ts` - New tests

## Tests

All tests pass:
- `packages/type-compiler/` - 226 tests
- New `vite-simulation.spec.ts` - 5 tests for cross-file resolution

## Checklist

- [x] Investigation complete
- [x] Root cause identified
- [x] DeepkitLoader improved with options API
- [x] Vite plugin updated
- [x] Bun plugin updated
- [x] Tests added and passing
- [ ] GitHub issue can be closed with explanation
