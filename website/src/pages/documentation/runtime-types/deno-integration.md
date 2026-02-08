# Deno Integration

Deno is a modern JavaScript/TypeScript runtime that uses V8, Rust, and Tokio. However, Deno does not support TypeScript custom transformers, which Deepkit's type-compiler requires for runtime type reflection.

## Current Status

**Deno does not support TypeScript custom transformers.** This is a deliberate design decision by the Deno team ([GitHub Issue #3354](https://github.com/denoland/deno/issues/3354)).

This means:

- **`deno run myfile.ts` will not work directly** with Deepkit runtime types
- Pre-compilation through esbuild or another bundler is required
- This approach is experimental and not officially supported

## Why Native Support is Not Possible

Deno uses [SWC](https://swc.rs/) for TypeScript transpilation, which doesn't expose TypeScript's type information at compile time. Deepkit's type-compiler needs access to TypeScript's AST and type checker to generate runtime type metadata. Since SWC is a completely separate implementation of TypeScript parsing (written in Rust for performance), it doesn't have the TypeScript compiler's type resolution capabilities.

The Deno team has indicated that supporting custom TypeScript transformers would require significant architectural changes and is not planned.

## Workaround: esbuild Pre-compilation

You can use Deepkit types with Deno by pre-compiling your TypeScript through esbuild with the `DeepkitLoader`:

### 1. Project Setup

Create a project with both npm and Deno configuration:

_File: package.json_

```json
{
  "name": "deepkit-deno-example",
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "build:watch": "node build.mjs --watch"
  },
  "dependencies": {
    "@deepkit/type": "^1.0.1",
    "@deepkit/core": "^1.0.1"
  },
  "devDependencies": {
    "@deepkit/type-compiler": "^1.0.1",
    "esbuild": "^0.20.0"
  }
}
```

_File: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "reflection": true
}
```

### 2. Build Script

Create an esbuild configuration that uses `DeepkitLoader`:

_File: build.mjs_

```javascript
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

import { DeepkitLoader } from '@deepkit/type-compiler';

const loader = new DeepkitLoader({
  tsConfig: './tsconfig.json',
  reflection: 'default',
});

const deepkitPlugin = {
  name: 'deepkit',
  setup(build) {
    build.onLoad({ filter: /\.tsx?$/ }, async args => {
      // Skip node_modules
      if (args.path.includes('node_modules')) {
        return null;
      }

      const source = await fs.promises.readFile(args.path, 'utf8');
      const contents = loader.transform(source, args.path);
      return {
        contents,
        loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
      };
    });
  },
};

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral', // Works for both Deno and Node
  outfile: 'dist/main.js',
  plugins: [deepkitPlugin],
  external: [], // Add any Deno-specific imports here
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete: dist/main.js');
}
```

### 3. Source Code

Write your TypeScript with Deepkit types:

_File: src/main.ts_

```typescript
import { Email, MinLength, ReflectionClass, cast, validate } from '@deepkit/type';

interface User {
  username: string & MinLength<3>;
  email: string & Email;
  age: number;
}

// Validation
const input = {
  username: 'ab', // Too short - will fail validation
  email: 'invalid-email',
  age: 25,
};

const errors = validate<User>(input);
if (errors.length > 0) {
  console.log('Validation errors:');
  for (const error of errors) {
    console.log(`  - ${error.path}: ${error.message}`);
  }
}

// Casting with valid data
const validInput = {
  username: 'Peter',
  email: 'peter@example.com',
  age: 30,
};

const user = cast<User>(validInput);
console.log('Valid user:', user);

// Runtime reflection
const reflection = ReflectionClass.from<User>();
console.log('\nUser type properties:');
for (const property of reflection.getProperties()) {
  console.log(`  - ${property.name}: ${property.type.kind}`);
}
```

### 4. Build and Run

```bash
# Install dependencies
npm install

# Build with esbuild + Deepkit type compiler
npm run build

# Run with Deno
deno run --allow-read dist/main.js
```

For development with watch mode:

```bash
# Terminal 1: Watch and rebuild
npm run build:watch

# Terminal 2: Run (re-run after changes)
deno run --allow-read dist/main.js
```

## Limitations

This workaround has several important limitations:

| Limitation                  | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| **No direct execution**     | Cannot use `deno run file.ts` directly                            |
| **Requires build step**     | Must compile before running                                       |
| **No official Deno plugin** | No `@deepkit/deno` package exists                                 |
| **npm dependency**          | Still requires npm for build dependencies                         |
| **Limited Deno features**   | Some Deno-specific features may not work well with bundled output |
| **Source maps**             | Debugging may be more difficult with bundled code                 |

### What Works

- Validation with `validate<T>()`
- Serialization with `cast<T>()` and `serialize<T>()`
- Runtime reflection with `ReflectionClass`
- Type annotations (`MinLength`, `Email`, `Positive`, etc.)
- Custom validators and serializers

### What May Not Work

- Deno-specific imports (`deno:`, `npm:` specifiers) in source files
- Import maps (require additional esbuild configuration)
- Deno Deploy (may work, but untested)

## Alternative Approaches

### Use Node.js or Bun Instead

If you need full Deepkit support without workarounds, consider these alternatives:

| Runtime     | Support Level       | Setup                                     |
| ----------- | ------------------- | ----------------------------------------- |
| **Bun**     | Full native support | `@deepkit/bun` preload plugin             |
| **Node.js** | Full support        | `deepkit-type-install` patches TypeScript |

See:

- [Bundler Integration - Bun](./bundler-integration#bun) for Bun setup
- [Node.js Integration](./nodejs-integration) for Node.js setup

### Use Deno's Node Compatibility

Deno has Node.js compatibility layers that may allow running pre-compiled Deepkit code:

```bash
# Build for Node.js
npm run build

# Run with Deno's Node compatibility
deno run --allow-read --allow-env --node-modules-dir dist/main.js
```

This approach is also experimental and may have compatibility issues.

## Future Outlook

Native Deno support would require one of the following:

1. **Deno adds transformer support** - Unlikely based on current project direction
2. **SWC adds TypeScript type access** - Would require significant SWC changes
3. **Alternative compilation approach** - A hypothetical Deepkit plugin that works with Deno's architecture

Currently, none of these are planned. The esbuild pre-compilation workaround remains the most practical approach for using Deepkit with Deno.

## Related Documentation

- [Bundler Integration](./bundler-integration) - esbuild setup details and `DeepkitLoader` API
- [Node.js Integration](./nodejs-integration) - Full support with `deepkit-type-install`
- [Getting Started](./getting-started) - General setup guide
- [External Types](./external-types) - Working with types from external packages
