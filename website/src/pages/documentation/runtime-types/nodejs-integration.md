# Node.js Integration

This guide covers how to use Deepkit runtime types in Node.js environments without a bundler. Whether you are using ts-node, tsx, or compiling with tsc directly, this document explains the setup and best practices.

## When to Use Node.js Integration

Use direct Node.js integration (without a bundler) when:

- Developing CLI tools or backend services
- Running scripts during development with ts-node or tsx
- Building applications where a bundler adds unnecessary complexity
- Working on monorepos or library development

For frontend applications or when using build tools like Vite, webpack, or esbuild, see the [bundler integration documentation](./getting-started.md#webpack) or the respective package READMEs.

## Overview of Approaches

| Approach               | Best For                     | How It Works                                    |
| ---------------------- | ---------------------------- | ----------------------------------------------- |
| `deepkit-type-install` | Development with ts-node/tsx | Patches local TypeScript installation           |
| `tsc` (compile first)  | Production builds            | Standard TypeScript compilation with reflection |
| Manual transformer     | Custom build pipelines       | Direct use of TypeScript transformer API        |

## Using deepkit-type-install (Recommended for Development)

The `deepkit-type-install` command patches your local TypeScript installation to include the Deepkit type transformer. This is the simplest approach for development workflows.

### How It Works

When you run `deepkit-type-install`, it modifies the TypeScript compiler in your `node_modules/typescript` directory to automatically apply the Deepkit type transformer during compilation. This means any tool that uses the local TypeScript installation (tsc, ts-node, tsx) will automatically generate runtime type information.

### Installation

```bash
npm install @deepkit/type @deepkit/core
npm install --save-dev @deepkit/type-compiler typescript
```

Then run the installer:

```bash
npx deepkit-type-install
```

For convenience, add it as a postinstall script in your `package.json`:

```json
{
  "scripts": {
    "postinstall": "deepkit-type-install"
  }
}
```

This ensures the patch is re-applied after `npm install` runs.

### Configure tsconfig.json

Enable reflection in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "moduleResolution": "node",
    "strict": true
  },
  "reflection": true
}
```

For ES modules:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true
  },
  "reflection": true
}
```

### With ts-node

After running `deepkit-type-install`, ts-node works automatically:

```bash
npx ts-node app.ts
```

Example `app.ts`:

```typescript
import { MinLength, cast, validate } from '@deepkit/type';

interface User {
  username: string & MinLength<3>;
  email: string;
}

// Validation
const errors = validate<User>({ username: 'ab', email: 'test@test.com' });
console.log('Validation errors:', errors);

// Serialization
const user = cast<User>({ username: 'Peter', email: 'peter@example.com' });
console.log('Casted user:', user);
```

For ESM projects, use the ESM loader:

```bash
node --loader ts-node/esm app.ts
```

Or configure in `tsconfig.json`:

```json
{
  "ts-node": {
    "esm": true
  }
}
```

### With tsx

[tsx](https://github.com/privatenumber/tsx) is a TypeScript execution engine powered by esbuild. After running `deepkit-type-install`, tsx works similarly to ts-node:

```bash
npx tsx app.ts
```

For watch mode:

```bash
npx tsx watch app.ts
```

**Note:** tsx uses esbuild internally for fast transpilation but still relies on the patched TypeScript for type transformation when `deepkit-type-install` has been run.

### Important Caveats

1. **Re-run after TypeScript updates**: When you update your TypeScript version (e.g., change version in `package.json` and run `npm install`), you must re-run `deepkit-type-install`. The postinstall script handles this automatically.

2. **Per-project installation**: The patch is applied to the local `node_modules/typescript`. Each project needs its own installation.

3. **Monorepo considerations**: In a monorepo, run `deepkit-type-install` in each workspace that uses Deepkit, or ensure the TypeScript installation in the root is patched.

## Using tsc Directly

For production builds or when you prefer explicit compilation, use tsc with the reflection option enabled.

### Setup

1. Install dependencies:

```bash
npm install @deepkit/type @deepkit/core
npm install --save-dev @deepkit/type-compiler typescript
npx deepkit-type-install
```

2. Configure `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  },
  "include": ["src/**/*"],
  "reflection": true
}
```

3. Build and run:

```bash
npx tsc
node dist/app.js
```

### Watch Mode

For development, use tsc in watch mode:

```bash
npx tsc --watch
```

In a separate terminal, run your application:

```bash
node dist/app.js
```

Or use a tool like `nodemon` for auto-restart:

```bash
npx nodemon dist/app.js
```

Combined watch setup in `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "start": "node dist/app.js",
    "dev": "tsc && nodemon dist/app.js",
    "dev:watch": "concurrently \"npm run build:watch\" \"nodemon dist/app.js\""
  }
}
```

### ESM Output

For ES modules output:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "reflection": true
}
```

Ensure your `package.json` has `"type": "module"`:

```json
{
  "type": "module"
}
```

## Using SWC

[SWC](https://swc.rs/) is a fast TypeScript/JavaScript compiler written in Rust. However, **SWC does not support TypeScript transformer plugins**, which means the Deepkit type compiler cannot be integrated directly with SWC.

### Workaround: Pre-compile with tsc

If you need SWC's speed benefits, you can use a two-step compilation:

1. Use tsc with Deepkit type compiler to generate intermediate JavaScript with type metadata
2. Use SWC for further optimizations if needed

However, in practice this approach adds complexity without significant benefit. For most Node.js applications, tsc or ts-node with `deepkit-type-install` is sufficient.

### Recommendation

For Deepkit projects, avoid SWC-based tools when runtime type reflection is needed. Use:

- **ts-node** for development
- **tsc** for production builds
- **tsx** as an alternative to ts-node (it uses esbuild but supports the TypeScript patch)

## Production Deployment

For production, always pre-compile your TypeScript code rather than using ts-node or tsx.

### Build Process

1. Compile with tsc:

```bash
npx tsc
```

2. Deploy the `dist/` directory with your `package.json` and `node_modules`

3. Run the compiled JavaScript:

```bash
node dist/app.js
```

### Docker Example

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/app.js"]
```

### Important Notes

- **Do not use ts-node in production**: It adds startup overhead and uses more memory
- **Do not include @deepkit/type-compiler in production dependencies**: It's only needed during compilation
- **The compiled JavaScript contains all necessary type metadata**: No additional setup needed at runtime

## Troubleshooting

### "No valid runtime type for [value] given" (DK-T001)

The type does not have reflection metadata. This usually means:

1. **Type compiler not installed**: Run `npx deepkit-type-install`
2. **Reflection not enabled**: Add `"reflection": true` to `tsconfig.json`
3. **TypeScript was updated**: Re-run `npx deepkit-type-install`
4. **Type from external package**: External packages need to be compiled with type-compiler. See [External Types](./external-types.md)

### ts-node Not Applying Type Transformation

If types are not being reflected when using ts-node:

1. Verify the patch was installed:

   ```bash
   npx deepkit-type-install
   ```

2. Check your `tsconfig.json` has reflection enabled:

   ```json
   {
     "reflection": true
   }
   ```

3. Ensure ts-node is using the correct tsconfig:

   ```bash
   npx ts-node --project tsconfig.json app.ts
   ```

4. Clear the ts-node cache:
   ```bash
   rm -rf node_modules/.cache
   ```

### ESM Import Issues

When using ES modules, you may encounter import resolution errors:

1. Ensure `package.json` has `"type": "module"`
2. Use explicit file extensions in imports (or configure moduleResolution)
3. For ts-node with ESM:
   ```bash
   node --loader ts-node/esm app.ts
   ```

### Reflection Not Working After npm install

If reflection stops working after running `npm install`:

1. Check if TypeScript was updated
2. Re-run the type installer:
   ```bash
   npx deepkit-type-install
   ```

The postinstall script in `package.json` should handle this automatically:

```json
{
  "scripts": {
    "postinstall": "deepkit-type-install"
  }
}
```

### Version Mismatch Errors

Keep `@deepkit/type` and `@deepkit/type-compiler` versions in sync:

```bash
npm update @deepkit/type @deepkit/type-compiler
npx deepkit-type-install
```

### Debugging Type Compilation

To see what the type compiler generates, use the debug command:

```bash
npx deepkit-compiler-debug app.ts
```

This outputs the transformed code with type metadata, helpful for understanding how your types are being compiled.

## Complete Example Project

Here's a minimal project structure:

```
my-app/
  package.json
  tsconfig.json
  src/
    app.ts
    models/
      user.ts
```

**package.json:**

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "deepkit-type-install",
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "ts-node src/app.ts"
  },
  "dependencies": {
    "@deepkit/type": "^1.0.1",
    "@deepkit/core": "^1.0.1"
  },
  "devDependencies": {
    "@deepkit/type-compiler": "^1.0.1",
    "typescript": "~5.8.3",
    "ts-node": "^10.9.1"
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "reflection": true
}
```

**src/models/user.ts:**

```typescript
import { Email, MinLength, Positive } from '@deepkit/type';

export interface User {
  id: number & Positive;
  username: string & MinLength<3>;
  email: string & Email;
  createdAt: Date;
}
```

**src/app.ts:**

```typescript
import { ReflectionClass, cast, validate } from '@deepkit/type';

import { User } from './models/user.js';

// Validate user input
const input = {
  id: 1,
  username: 'Peter',
  email: 'peter@example.com',
  createdAt: '2024-01-15T10:30:00Z',
};

const errors = validate<User>(input);
if (errors.length > 0) {
  console.error('Validation failed:', errors);
  process.exit(1);
}

// Cast to proper types (converts string date to Date object)
const user = cast<User>(input);
console.log('User:', user);
console.log('Created at (Date object):', user.createdAt instanceof Date);

// Inspect type at runtime
const reflection = ReflectionClass.from<User>();
console.log('User properties:');
for (const property of reflection.getProperties()) {
  console.log(`  - ${property.name}: ${property.type.kind}`);
}
```

Run in development:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm start
```
