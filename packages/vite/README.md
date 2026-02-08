# @deepkit/vite

Vite plugin for Deepkit runtime types. Transforms TypeScript types into runtime-accessible metadata during development and build.

## Installation

```bash
npm install @deepkit/vite @deepkit/type-compiler @deepkit/type
```

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { deepkitType } from '@deepkit/vite';

export default defineConfig({
    plugins: [deepkitType({ reflection: 'default' })],
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string \| string[]` | `['**/*.tsx', '**/*.ts']` | Glob patterns for files to transform |
| `exclude` | `string \| string[]` | `'node_modules/**'` | Glob patterns for files to skip |
| `tsConfig` | `string` | Auto-detected | Path to tsconfig.json |
| `reflection` | `'default' \| 'explicit' \| 'never'` | From tsconfig | Override reflection mode for all files |

### Reflection Modes

- **`'default'`**: Enable reflection for all types (recommended for most projects)
- **`'explicit'`**: Only reflect types marked with `@reflection`
- **`'never'`**: Disable reflection entirely

## Examples

### Simple Setup

Enable reflection for all TypeScript files:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { deepkitType } from '@deepkit/vite';

export default defineConfig({
    plugins: [deepkitType({ reflection: 'default' })],
});
```

### With tsconfig.json

Let tsconfig.json control reflection behavior:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { deepkitType } from '@deepkit/vite';

export default defineConfig({
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
// vite.config.ts
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

## With Other Frameworks

### SvelteKit

Place the Deepkit plugin before SvelteKit:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { deepkitType } from '@deepkit/vite';

export default defineConfig({
    plugins: [deepkitType({ reflection: 'default' }), sveltekit()],
});
```

### Nuxt

Configure via `nuxt.config.ts`:

```ts
// nuxt.config.ts
import { deepkitType } from '@deepkit/vite';

export default defineNuxtConfig({
    vite: {
        plugins: [deepkitType({ reflection: 'default' })],
    },
});
```

### Astro

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { deepkitType } from '@deepkit/vite';

export default defineConfig({
    vite: {
        plugins: [deepkitType({ reflection: 'default' })],
    },
});
```

## More Information

For details about reflection modes, JSDoc annotations, and how the type transformer works, see [@deepkit/type-compiler](https://github.com/deepkit/deepkit-framework/tree/master/packages/type-compiler).
