# @deepkit/type-compiler

The TypeScript compiler/transformer for Deepkit's runtime type system. This package transforms TypeScript types into runtime-accessible metadata, enabling powerful features like validation, serialization, and dependency injection to work directly with TypeScript types.

## Why Runtime Types?

TypeScript's type system is erased at compile time, leaving runtime code blind to type information. `@deepkit/type-compiler` solves this by:

- **Converting types to bytecode** at compile time
- **Embedding type metadata** in the compiled JavaScript
- **Enabling runtime reflection** for interfaces, generics, and complex types

This means you can write `validate<MyInterface>(data)` and have it actually work at runtime.

## Installation

```sh
npm install @deepkit/type @deepkit/core
npm install --save-dev @deepkit/type-compiler typescript
```

Or with other package managers:

```sh
# yarn
yarn add @deepkit/type @deepkit/core
yarn add -D @deepkit/type-compiler typescript

# pnpm
pnpm add @deepkit/type @deepkit/core
pnpm add -D @deepkit/type-compiler typescript
```

## Quick Start

### 1. Configure tsconfig.json

Add `"reflection": true` to enable type reflection:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "NodeNext"
  },
  "reflection": true
}
```

### 2. Install the compiler

For most setups (tsc, ts-node, etc.), run:

```sh
npx deepkit-type-install
```

This patches your local TypeScript installation to include the Deepkit transformer.

### 3. Use runtime types

```typescript
import { MinLength, cast, validate } from '@deepkit/type';

interface User {
  username: string & MinLength<3>;
  email: string;
}

// Validation
const errors = validate<User>({ username: 'ab', email: 'test@test.com' });
// errors: [{ path: 'username', message: 'Min length is 3' }]

// Serialization/casting
const user = cast<User>({ username: 'Peter', email: 'peter@example.com' });
```

## DeepkitLoader API

For bundlers and custom build pipelines, use the `DeepkitLoader` class directly:

```typescript
import { DeepkitLoader } from '@deepkit/type-compiler';

const loader = new DeepkitLoader({
  // Path to tsconfig.json (optional - will search from file's directory)
  tsConfig: './tsconfig.json',

  // Override reflection mode (optional)
  // 'default' - reflect all types
  // 'explicit' - only types with @reflection JSDoc
  // 'never' - skip transformation
  reflection: 'default',

  // Additional TypeScript compiler options (optional)
  compilerOptions: {
    target: ts.ScriptTarget.ESNext,
  },
});

// Transform a TypeScript file
const output = loader.transform(sourceCode, '/absolute/path/to/file.ts');
```

### Constructor Options

| Option            | Type                                 | Description                                                              |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `tsConfig`        | `string`                             | Path to tsconfig.json. If not provided, searches from file's directory.  |
| `reflection`      | `'default' \| 'explicit' \| 'never'` | Override reflection mode. If not set, uses tsconfig's reflection option. |
| `compilerOptions` | `CompilerOptions`                    | Additional TypeScript compiler options to merge with defaults.           |

### transform(source, path)

Transforms TypeScript source code with Deepkit type reflection.

- `source` - The TypeScript source code as a string
- `path` - **Absolute path** to the file (required for cross-file type resolution)
- Returns the transformed JavaScript code

## Reflection Modes

Control which types get runtime reflection metadata:

### 'default' - Reflect all types

All types in the file will have reflection metadata generated.

```json
{
  "reflection": true
}
```

Or equivalently:

```json
{
  "reflection": "default"
}
```

### 'explicit' - Only marked types

Only types with the `@reflection` JSDoc tag will have metadata:

```json
{
  "reflection": "explicit"
}
```

```typescript
/** @reflection */
interface User {
  name: string;
}

// This interface will NOT have reflection
interface Internal {
  id: number;
}
```

### 'never' - Disable reflection

Skip the transformation entirely. Useful for excluding specific files:

```typescript
/** @reflection never */
interface InternalType {
  // No runtime metadata generated
}
```

### Glob patterns

You can also use glob patterns to selectively enable reflection:

```json
{
  "reflection": ["src/models/**/*.ts", "src/api/**/*.ts"]
}
```

## Bundler Integration

### Vite

Use the official `@deepkit/vite` package:

```sh
npm install --save-dev @deepkit/vite
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  plugins: [deepkitType({ reflection: 'default' })],
});
```

Or respect tsconfig.json settings:

```typescript
deepkitType({ tsConfig: './tsconfig.json' });
```

### Bun

Use the official `@deepkit/bun` package:

```sh
bun install @deepkit/bun
```

Configure in `bunfig.toml`:

```toml
preload = ["@deepkit/bun"]

[install]
peer = true
```

Enable reflection in `tsconfig.json`:

```json
{
  "reflection": true
}
```

For the Bun test runner:

```toml
[test]
preload = ["@deepkit/bun"]
```

### esbuild

Create a custom plugin using `DeepkitLoader`:

```typescript
// esbuild.config.mjs
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

import { DeepkitLoader } from '@deepkit/type-compiler';

const loader = new DeepkitLoader({ reflection: 'default' });

const deepkitPlugin = {
  name: 'deepkit',
  setup(build) {
    build.onLoad({ filter: /\.tsx?$/ }, async args => {
      const source = await fs.promises.readFile(args.path, 'utf8');
      const contents = loader.transform(source, args.path);
      return {
        contents,
        loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
      };
    });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  plugins: [deepkitPlugin],
});
```

### webpack

Use `ts-loader` with custom transformers:

```javascript
// webpack.config.js
const typeCompiler = require('@deepkit/type-compiler');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            getCustomTransformers: (program, getProgram) => ({
              before: [typeCompiler.transformer],
              afterDeclarations: [typeCompiler.declarationTransformer],
            }),
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
};
```

Or use `DeepkitLoader` with a custom loader:

```javascript
// deepkit-loader.js
const { DeepkitLoader } = require('@deepkit/type-compiler');

const loader = new DeepkitLoader({ reflection: 'default' });

module.exports = function (source) {
  return loader.transform(source, this.resourcePath);
};
```

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: ['./deepkit-loader.js'],
        exclude: /node_modules/,
      },
    ],
  },
};
```

## tsconfig.json Configuration

### Basic reflection

Enable reflection for all files:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022"
  },
  "reflection": true
}
```

### Advanced configuration

Use `deepkitCompilerOptions` for fine-grained control:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022"
  },
  "deepkitCompilerOptions": {
    "reflection": ["src/**/*.ts", "!src/**/*.spec.ts"],
    "exclude": ["lib.dom*.d.ts"],
    "mergeStrategy": "merge"
  }
}
```

### Configuration options

| Option          | Type                                                        | Description                                              |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| `reflection`    | `boolean \| 'default' \| 'explicit' \| 'never' \| string[]` | Enable reflection globally or with glob patterns         |
| `exclude`       | `string[]`                                                  | Glob patterns for files to exclude from type compilation |
| `mergeStrategy` | `'merge' \| 'replace'`                                      | How to handle extends in tsconfig (default: 'merge')     |

### Inheritance

When a tsconfig extends another, reflection options are merged by default:

```json
// tsconfig.base.json
{
  "reflection": ["src/models/**/*.ts"]
}

// tsconfig.json
{
  "extends": "./tsconfig.base.json",
  "deepkitCompilerOptions": {
    "reflection": ["src/api/**/*.ts"],
    "mergeStrategy": "merge"
  }
}
// Result: reflection for both src/models/**/*.ts AND src/api/**/*.ts
```

Use `"mergeStrategy": "replace"` to override parent settings entirely.

## Cross-File Type Resolution

The type compiler resolves types across files. For this to work correctly:

1. **Use absolute paths** when calling `transform()`:

```typescript
// Correct
loader.transform(source, '/home/user/project/src/models/user.ts');

// Wrong - cross-file imports may not resolve
loader.transform(source, './src/models/user.ts');
```

2. **Provide tsConfig** for path aliases:

```typescript
const loader = new DeepkitLoader({
  tsConfig: './tsconfig.json', // Needed for path resolution
});
```

3. **Keep loader instance** for the session - it caches resolved files for performance.

## Legacy: deepkit-type-install

The `deepkit-type-install` command patches your local TypeScript installation to include the Deepkit transformer. This is the traditional approach that works with:

- `tsc` command
- `ts-node`
- Angular CLI
- Any tool using `node_modules/typescript`

```sh
npx deepkit-type-install
```

**When to use:**

- Simple projects using `tsc` directly
- ts-node for development
- Tools that don't support custom transformers

**When to use DeepkitLoader instead:**

- Modern bundlers (Vite, esbuild, webpack)
- Build pipelines requiring explicit control
- Environments where patching node_modules is problematic

**Note:** Re-run `deepkit-type-install` after updating TypeScript.

## Troubleshooting

### "No valid runtime type for [value] given" (DK-T001)

The type doesn't have reflection metadata. Common causes:

1. **Type compiler not installed**: Run `npx deepkit-type-install`
2. **Reflection not enabled**: Add `"reflection": true` to tsconfig.json
3. **Type marked with `@reflection never`**: Remove the JSDoc tag
4. **Type from external package**: The package needs to be compiled with type-compiler

### "No type information received" (DK-T002)

The generic type parameter wasn't captured:

```typescript
// Wrong - type not captured
function process(type) {
    return validate(type, data);
}

// Correct - use ReceiveType pattern
function process<T>(data: unknown, type?: ReceiveType<T>) {
    return validate<T>(data);
}
```

### Types not resolving across files

1. Ensure you're using absolute paths with `transform()`
2. Provide `tsConfig` option to the loader
3. Check that imported files are also being transformed

### Bundler not transforming files

1. Check file extensions match the filter (`.ts`, `.tsx`)
2. Ensure files aren't in `node_modules` or excluded paths
3. Verify the plugin is registered before other TypeScript plugins

### Version mismatch errors

Keep `@deepkit/type` and `@deepkit/type-compiler` versions in sync:

```sh
npm update @deepkit/type @deepkit/type-compiler
```

## API Reference

### Exports

```typescript
// Main loader for bundler integration
export { DeepkitLoader, DeepkitLoaderOptions } from './loader.js';

// TypeScript transformers for ts-loader, etc.
export { transformer, declarationTransformer } from './compiler.js';

// Configuration utilities
export { reflectionModes, Mode, ReflectionConfig } from './config.js';
```

## Related Packages

- [@deepkit/type](https://www.npmjs.com/package/@deepkit/type) - Runtime type system
- [@deepkit/vite](https://www.npmjs.com/package/@deepkit/vite) - Vite plugin
- [@deepkit/bun](https://www.npmjs.com/package/@deepkit/bun) - Bun plugin
- [@deepkit/core](https://www.npmjs.com/package/@deepkit/core) - Core utilities

## License

MIT
