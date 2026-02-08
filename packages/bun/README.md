# @deepkit/bun

Bun plugin for Deepkit runtime types. Transforms TypeScript types into runtime-accessible metadata during development and build.

## Installation

```bash
bun add @deepkit/bun @deepkit/type-compiler @deepkit/type
```

## Quick Start

The simplest way to enable Deepkit reflection in a Bun project:

**1. Configure bunfig.toml:**

```toml
preload = ["@deepkit/bun"]
```

**2. Enable reflection in tsconfig.json:**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext"
  },
  "reflection": true
}
```

**3. Use runtime types:**

```ts
import { ReflectionKind, typeOf } from '@deepkit/type';

interface User {
  id: number;
  name: string;
}

const type = typeOf<User>();
console.log(type.kind === ReflectionKind.objectLiteral); // true
```

## Options

| Option       | Type                                 | Default       | Description                            |
| ------------ | ------------------------------------ | ------------- | -------------------------------------- |
| `include`    | `RegExp`                             | `/\.tsx?$/`   | Pattern for files to transform         |
| `exclude`    | `RegExp`                             | `undefined`   | Pattern for files to skip              |
| `tsConfig`   | `string`                             | Auto-detected | Path to tsconfig.json                  |
| `reflection` | `'default' \| 'explicit' \| 'never'` | From tsconfig | Override reflection mode for all files |

### Reflection Modes

- **`'default'`**: Enable reflection for all types (recommended for most projects)
- **`'explicit'`**: Only reflect types marked with `@reflection`
- **`'never'`**: Disable reflection entirely

## Usage Examples

### With Bun.build()

Use the plugin in build scripts:

```ts
// build.ts
import { deepkitType } from '@deepkit/bun';

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [deepkitType({ reflection: 'default' })],
});
```

### With bunfig.toml Preload

For runtime transformation without a build step:

```toml
# bunfig.toml
preload = ["@deepkit/bun"]

[install]
peer = true
```

This enables the plugin globally for all `bun run` commands.

### With Bun Test Runner

To use Deepkit types in tests with the [Bun test runner](https://bun.sh/docs/cli/test):

```toml
# bunfig.toml
[test]
preload = ["@deepkit/bun"]
```

Then run tests with:

```bash
bun test
```

### With tsconfig.json Control

Let tsconfig.json control reflection behavior:

```ts
// build.ts
import { deepkitType } from '@deepkit/bun';

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [deepkitType({ tsConfig: './tsconfig.json' })],
});
```

```json
// tsconfig.json
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

```ts
import { deepkitType } from '@deepkit/bun';

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [
    deepkitType({
      include: /src\/.*\.ts$/,
      exclude: /\.test\.ts$/,
      reflection: 'default',
    }),
  ],
});
```

## Runtime Usage

When using `bun run` directly (without a build step), the preload configuration transforms files on-the-fly:

```toml
# bunfig.toml
preload = ["@deepkit/bun"]
```

```bash
bun run src/index.ts
```

This is useful for development and scripts where you want runtime type reflection without a separate build step.

## Troubleshooting

### Types not reflecting at runtime

**Problem:** `typeOf<T>()` returns `{ kind: ReflectionKind.unknown }` or types are not available.

**Solutions:**

1. Ensure `@deepkit/bun` is in the preload array in `bunfig.toml`
2. Check that `reflection: true` is set in `tsconfig.json`
3. Or pass `reflection: 'default'` directly to the plugin

### Plugin not loading

**Problem:** The plugin does not seem to transform files.

**Solutions:**

1. Verify `bunfig.toml` is in the project root
2. Check the file extension matches the `include` pattern (default: `.ts`, `.tsx`)
3. Ensure the file is not matched by the `exclude` pattern

### Build errors with external dependencies

**Problem:** Build fails when dependencies use incompatible TypeScript features.

**Solution:** Exclude problematic dependencies:

```ts
deepkitType({
  exclude: /node_modules/,
  reflection: 'default',
});
```

### Peer dependency warnings

**Problem:** Bun shows peer dependency warnings during install.

**Solution:** Add to `bunfig.toml`:

```toml
[install]
peer = true
```

## Related Packages

- [@deepkit/type](https://github.com/deepkit/deepkit-framework/tree/master/packages/type) - Runtime type system with validation and serialization
- [@deepkit/type-compiler](https://github.com/deepkit/deepkit-framework/tree/master/packages/type-compiler) - TypeScript transformer that powers all Deepkit bundler plugins

## More Information

For details about reflection modes, JSDoc annotations, and how the type transformer works, see [@deepkit/type-compiler](https://github.com/deepkit/deepkit-framework/tree/master/packages/type-compiler).
