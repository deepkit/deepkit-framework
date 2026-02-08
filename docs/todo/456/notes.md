# Issue #456: Cross-file type imports in Vite

## Investigation Summary

**Date**: 2026-01-19
**Status**: Not a bug - configuration issue

## Original Issue

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

fn<CreateUserData>(); // {kind: 0} - reported as broken
```

## Root Cause Analysis

### Initial Hypothesis (Incorrect)
The first analysis assumed `ts.transpileModule()` couldn't resolve cross-file imports because it's a single-file API.

### Actual Finding
**The type-compiler works correctly with `transpileModule` when properly configured.**

A test was created (`packages/type-compiler/tests/vite-simulation.spec.ts`) that proves:
1. When `fileName` is an absolute path
2. When files exist on disk (so the Resolver can read them)
3. When reflection is enabled in tsconfig

...the cross-file type resolution works perfectly:

```ts
// Generated main.ts output
import { __ΩCreateUserData } from './shared';
fn.__type = ['t', 'fn', 'P!2!8"/"'];
function fn(t = fn.Ω?.[0]) {
    fn.Ω = undefined;
    return resolveReceiveType(t);
}
(fn.Ω = [[() => __ΩCreateUserData, 'n!']], fn());
```

### Why the Original Report Failed

The issue reporter likely had one of these problems:

1. **Missing reflection configuration**: The tsconfig.json must have:
   ```json
   {
     "reflection": true
   }
   ```
   or
   ```json
   {
     "deepkitCompilerOptions": {
       "reflection": true
     }
   }
   ```

2. **Wrong tsconfig path**: The Vite plugin defaults to `process.cwd() + '/tsconfig.json'`. If the project uses a different tsconfig location, it must be specified:
   ```ts
   deepkitType({ tsConfig: './src/tsconfig.json' })
   ```

3. **Relative file paths**: If somehow Vite passed relative paths (it shouldn't), module resolution would fail.

## How the Type-Compiler Resolves Cross-File Types

1. **Parser binds the source file**: `ts.bindSourceFile()` is called to get `locals` map
2. **`resolveDeclaration()`** finds the import specifier in locals
3. **`resolveImportSpecifier()`** follows the import to find the actual declaration:
   - Uses the Resolver to read the source file from disk
   - The Resolver uses `createCompilerHost()` which has filesystem access
   - Module resolution via TypeScript's `resolveModuleName()`
4. **Reflection check**: Verifies the imported file has reflection enabled
5. **`addImports.push()`**: Adds `import { __ΩType } from './source'` to output

## Key Code Paths

| Location | Purpose |
|----------|---------|
| `compiler.ts:2512-2559` | Cross-file import handling |
| `compiler.ts:2545-2558` | Reflection check for non-.d.ts imports |
| `compiler.ts:2558` | `addImports.push()` - generates the import |
| `resolver.ts:83-118` | `resolveSourceFile()` - reads file from disk |
| `config.ts:123-131` | `reflectionModeMatcher()` - defaults to 'never' |

## Conclusion

**No code changes needed.** The issue is a documentation/configuration problem.

### Recommended Actions

1. Update Vite plugin documentation to clearly state:
   - tsconfig.json MUST have `reflection: true`
   - The `tsConfig` option must point to the correct tsconfig if not in project root

2. Consider adding a warning in the transformer when:
   - `reflection.mode === 'never'` (transformer does nothing)
   - A type import falls back to `any` because reflection config couldn't be read

3. Close issue #456 with explanation of required configuration.
