# Bundler Integration

Deepkit's runtime type system requires a TypeScript transformer to convert type information into runtime-accessible metadata. While the standard approach using `deepkit-type-install` works for `tsc` and `ts-node`, modern bundlers like Vite, Bun, and esbuild require explicit plugin configuration.

## Why Bundler Integration?

TypeScript types are normally erased at compile time. Deepkit's type compiler intercepts this process to:

1. **Convert types to bytecode** - TypeScript types become compact bytecode arrays
2. **Embed metadata** - The bytecode is injected into the compiled JavaScript
3. **Enable runtime reflection** - Your code can inspect types, validate data, and serialize objects

Without proper bundler integration, you'll see errors like "No valid runtime type for [value] given" (DK-T001) because the type metadata was never generated.

## Vite

Vite is the recommended bundler for frontend projects. Use the official `@deepkit/vite` plugin.

### Installation

```sh
npm install @deepkit/vite @deepkit/type-compiler @deepkit/type
```

### Configuration

_File: vite.config.ts_

```typescript
import { defineConfig } from 'vite';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  plugins: [deepkitType({ reflection: 'default' })],
});
```

### Options

| Option       | Type                                 | Default                   | Description                          |
| ------------ | ------------------------------------ | ------------------------- | ------------------------------------ |
| `include`    | `string \| string[]`                 | `['**/*.tsx', '**/*.ts']` | Glob patterns for files to transform |
| `exclude`    | `string \| string[]`                 | `'node_modules/**'`       | Glob patterns for files to skip      |
| `tsConfig`   | `string`                             | Auto-detected             | Path to tsconfig.json                |
| `reflection` | `'default' \| 'explicit' \| 'never'` | From tsconfig             | Override reflection mode             |

### Using tsconfig.json Settings

To respect your tsconfig.json reflection settings instead of hardcoding:

```typescript
import { defineConfig } from 'vite';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  plugins: [deepkitType({ tsConfig: './tsconfig.json' })],
});
```

_File: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext"
  },
  "reflection": true
}
```

### Custom Include/Exclude

Transform only specific files:

```typescript
import { defineConfig } from 'vite';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  plugins: [
    deepkitType({
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      reflection: 'default',
    }),
  ],
});
```

### With SvelteKit

Place the Deepkit plugin before SvelteKit:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  plugins: [deepkitType({ reflection: 'default' }), sveltekit()],
});
```

### With Nuxt

Configure via `nuxt.config.ts`:

```typescript
import { deepkitType } from '@deepkit/vite';

export default defineNuxtConfig({
  vite: {
    plugins: [deepkitType({ reflection: 'default' })],
  },
});
```

### With Astro

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

import { deepkitType } from '@deepkit/vite';

export default defineConfig({
  vite: {
    plugins: [deepkitType({ reflection: 'default' })],
  },
});
```

## Bun

Bun has native TypeScript support and uses a preload mechanism for the Deepkit transformer.

### Installation

```sh
bun install @deepkit/type @deepkit/type-compiler @deepkit/core @deepkit/bun typescript
```

### Configuration

_File: bunfig.toml_

```toml
preload = ["@deepkit/bun"]

[install]
peer = true
```

_File: tsconfig.json_

```json
{
  "reflection": true
}
```

Now you can run TypeScript files directly:

```sh
bun run app.ts
```

### Bun Test Runner

To use Deepkit types with the [Bun test runner](https://bun.sh/docs/cli/test):

_File: bunfig.toml_

```toml
preload = ["@deepkit/bun"]

[test]
preload = ["@deepkit/bun"]
```

### Bun.build()

For programmatic builds with `Bun.build()`, use the `deepkitType` plugin:

```typescript
import { deepkitType } from '@deepkit/bun';

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [deepkitType({ reflection: 'default' })],
});
```

With custom options:

```typescript
import { deepkitType } from '@deepkit/bun';

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [
    deepkitType({
      tsConfig: './tsconfig.json',
      include: /\.tsx?$/,
      exclude: /\.spec\.ts$/,
    }),
  ],
});
```

## esbuild

For esbuild, create a custom plugin using `DeepkitLoader`:

### Installation

```sh
npm install esbuild @deepkit/type-compiler @deepkit/type
```

### Plugin Setup

_File: build.mjs_

```javascript
import * as esbuild from 'esbuild';
import * as fs from 'fs';

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

### With tsconfig.json

To use settings from your tsconfig.json:

```javascript
import { DeepkitLoader } from '@deepkit/type-compiler';

const loader = new DeepkitLoader({
  tsConfig: './tsconfig.json',
});
```

### Watch Mode

```javascript
import * as esbuild from 'esbuild';
import * as fs from 'fs';

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

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  plugins: [deepkitPlugin],
});

await ctx.watch();
console.log('Watching for changes...');
```

## Webpack

Webpack supports two integration approaches: using `ts-loader` with transformers or creating a custom loader.

### With ts-loader

The recommended approach uses `ts-loader` with custom transformers:

```sh
npm install webpack webpack-cli ts-loader @deepkit/type-compiler @deepkit/type
```

_File: webpack.config.js_

```javascript
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
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: __dirname + '/dist',
  },
};
```

### Custom Loader Approach

Alternatively, use `DeepkitLoader` in a custom webpack loader:

_File: deepkit-loader.js_

```javascript
const { DeepkitLoader } = require('@deepkit/type-compiler');

const loader = new DeepkitLoader({ reflection: 'default' });

module.exports = function (source) {
  return loader.transform(source, this.resourcePath);
};
```

_File: webpack.config.js_

```javascript
const path = require('path');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [path.resolve(__dirname, 'deepkit-loader.js')],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: __dirname + '/dist',
  },
};
```

## Rollup

Vite uses Rollup internally for production builds, so the `@deepkit/vite` plugin works seamlessly. For standalone Rollup projects, you can create a plugin similar to the esbuild approach:

```javascript
import { createFilter } from '@rollup/pluginutils';
import * as fs from 'fs';

import { DeepkitLoader } from '@deepkit/type-compiler';

export function deepkitType(options = {}) {
  const filter = createFilter(options.include || ['**/*.ts', '**/*.tsx'], options.exclude || 'node_modules/**');
  const loader = new DeepkitLoader({
    tsConfig: options.tsConfig,
    reflection: options.reflection || 'default',
  });

  return {
    name: 'deepkit-type',
    async transform(code, id) {
      if (!filter(id)) return null;
      if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return null;

      const transformed = loader.transform(code, id);
      return { code: transformed, map: null };
    },
  };
}
```

## DeepkitLoader API

The `DeepkitLoader` class provides a low-level API for integrating with any bundler:

```typescript
import { DeepkitLoader } from '@deepkit/type-compiler';

const loader = new DeepkitLoader({
  // Path to tsconfig.json (optional)
  tsConfig: './tsconfig.json',

  // Reflection mode: 'default' | 'explicit' | 'never'
  reflection: 'default',

  // Additional TypeScript compiler options
  compilerOptions: {
    target: 'ESNext',
  },
});

// Transform a file (path must be absolute for cross-file resolution)
const output = loader.transform(sourceCode, '/absolute/path/to/file.ts');
```

### Important Notes

1. **Use absolute paths** - Cross-file type resolution requires absolute paths
2. **Reuse the loader instance** - It caches resolved files for performance
3. **Provide tsConfig for aliases** - Path aliases from tsconfig require the config file

## Reflection Modes

| Mode         | Description                                        |
| ------------ | -------------------------------------------------- |
| `'default'`  | Enable reflection for all types (recommended)      |
| `'explicit'` | Only reflect types marked with `@reflection` JSDoc |
| `'never'`    | Disable reflection entirely                        |

### Explicit Mode Example

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

### Disabling Reflection Per-File

```typescript
/** @reflection never */
interface InternalType {
  // No runtime metadata generated
}
```

## Troubleshooting

### DK-T001: "No valid runtime type for [value] given"

The type doesn't have reflection metadata. Common causes:

1. **Bundler plugin not configured** - Ensure the Deepkit plugin is properly added
2. **Reflection not enabled** - Add `"reflection": true` to tsconfig.json or pass `reflection: 'default'` to the plugin
3. **Type marked with `@reflection never`** - Remove the JSDoc tag
4. **Type from external package** - The package needs to be compiled with type-compiler
5. **Plugin order** - Ensure Deepkit plugin runs before other TypeScript plugins

### DK-T002: "No type information received"

The generic type parameter wasn't captured:

```typescript
// Wrong - type not captured
function process(type) {
    return validate(type, data);
}

// Correct - use ReceiveType pattern
import { ReceiveType, validate } from '@deepkit/type';

function process<T>(data: unknown, type?: ReceiveType<T>) {
    return validate<T>(data);
}
```

### Types Not Resolving Across Files

1. **Use absolute paths** when calling `transform()` in custom plugins
2. **Provide tsConfig** to the loader for path alias resolution
3. **Verify imported files** are also being transformed (check include/exclude patterns)

### Bundler Not Transforming Files

1. **Check file extensions** match the filter (`.ts`, `.tsx`)
2. **Verify exclude patterns** aren't matching your files
3. **Plugin registration order** - Deepkit should typically be first
4. **Check bundler logs** for transformation errors

### Version Mismatch Errors

Keep all Deepkit packages in sync:

```sh
npm update @deepkit/type @deepkit/type-compiler @deepkit/vite @deepkit/bun
```

### Framework-Specific Issues

**SvelteKit**: Ensure Deepkit plugin is listed before `sveltekit()` in the plugins array.

**Nuxt**: Use `vite.plugins` in `nuxt.config.ts`, not a separate Vite config file.

**Astro**: Place the plugin in `vite.plugins` within `astro.config.mjs`.

**Next.js**: Use webpack configuration with `ts-loader` approach since Next.js uses webpack by default.

## Performance Tips

1. **Exclude test files** in production builds:

   ```typescript
   deepkitType({
     exclude: ['**/*.test.ts', '**/*.spec.ts'],
   });
   ```

2. **Use explicit mode** for large codebases where only specific types need reflection:

   ```typescript
   deepkitType({ reflection: 'explicit' });
   ```

3. **Reuse loader instances** when building multiple files to leverage caching

## Related Documentation

- [Getting Started](./getting-started.md) - Basic setup with tsc and ts-node
- [Validation](./validation.md) - Using runtime types for validation
- [Serialization](./serialization.md) - Type-safe serialization
- [External Types](./external-types.md) - Working with types from external packages
