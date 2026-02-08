# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Changes - Diligence Workflow

For any non-trivial code changes (bug fixes, features, refactoring), use the diligence workflow to ensure thorough research before implementation:

### Workflow

1. **Start**: Call `mcp__diligence__start` with task description
2. **Worker**: Spawn sub-agent (Task tool, subagent_type=Explore) to:
   - Call `mcp__diligence__get_worker_brief` for context
   - Research codebase thoroughly (trace data flow, find patterns)
   - Call `mcp__diligence__propose` with file:line citations
3. **Reviewer**: Spawn separate sub-agent (fresh context) to:
   - Call `mcp__diligence__get_reviewer_brief`
   - Independently verify every claim by searching codebase
   - Call `mcp__diligence__review` with APPROVED or NEEDS_WORK
4. **Loop**: If NEEDS_WORK, spawn new Worker with feedback (max 5 rounds)
5. **Implement**: When APPROVED, call `mcp__diligence__implement` and make changes
6. **Complete**: Call `mcp__diligence__complete` with summary

### Why Sub-Agents?

- **Worker** researches and proposes with citations
- **Reviewer** has fresh context (doesn't see Worker's searches), must independently verify
- This prevents rubber-stamping and catches architectural mistakes

### Skip Diligence For

- Trivial changes (typos, formatting)
- User explicitly requests quick fix
- Emergency hotfixes (but follow up with proper review)

## When Working on Issues or Improvements

If asked to fix bugs, improve packages, or work on GitHub issues:

**Read `docs/todo.md` first.** It contains complete agent instructions including:

- How to continue existing work
- How to delegate to sub-agents (you are the orchestrator)
- Rules for commits, tests, and documentation
- Active work and prioritized backlog

**Init prompt for new session**: `open docs/todo.md and continue the work`

## Project Overview

Deepkit Framework is a high-performance, modular TypeScript framework for backend applications based on **runtime types**. The core innovation is the `@deepkit/type-compiler` which transforms TypeScript types into runtime-accessible metadata, enabling features like validation, serialization, and dependency injection to work directly with TypeScript types.

**Key Innovation:** TypeScript types are converted to bytecode at compile time and executed by a runtime VM, eliminating schema duplication across validation, serialization, database, and DI layers.

## Vision and Goals

Deepkit aims to solve the **schema fragmentation problem** in TypeScript:

- **One type definition** works everywhere: validation, serialization, database, HTTP, RPC, DI
- **10-100x faster** than alternatives (class-validator, Zod, etc.)
- **Zero-decorator DI**: Dependency injection works on pure TypeScript without `@Injectable()`
- **Full-stack type safety**: Same types work from frontend to database

See `docs/VISION.md` for competitive analysis and strategic direction.

## Prerequisites

- **Node.js >= 20** is required
- **libpq5** and **libpq-dev** must be installed (for PostgreSQL tests)
- **Yarn 4.x** via corepack for package management

## Build and Development Commands

```bash
# Initial setup (REQUIRED)
yarn
npm run postinstall  # Builds type-compiler

# Development
npm run tsc          # TypeScript build
npm run tsc-watch    # Watch mode

# Testing
npm run test                    # All tests
npm run test packages/type/     # Package tests
node --expose-gc --max_old_space_size=3048 node_modules/jest/bin/jest.js packages/type/tests/serializer.spec.ts  # Single file

# Full build
npm run build        # Full build (several minutes)
npm run clean        # Clean artifacts
```

**Critical:** Always run `npm run postinstall` after cloning or when type-compiler changes.

**Important:** After modifying TypeScript source files, run `tsc --build` (or `npm run tsc`) to compile the changes before running tests. Tests execute the compiled JavaScript in `dist/`, not the TypeScript source directly.

### Package Build Structure

Each package has a dual build output:

- `dist/cjs/` - CommonJS build (from `tsconfig.json`)
- `dist/esm/` - ES Modules build (from `tsconfig.esm.json`)

**CRITICAL:** Each package's `npm run build` script creates a `dist/esm/package.json` with `{"type": "module"}` to enable ES modules. If you delete `dist/` manually, you MUST run `npm run build` in that package to recreate this file, otherwise ES module imports will fail.

```bash
# If you deleted dist/ in a package, run:
cd packages/<package-name> && npm run build

# Or rebuild everything:
npm run build
```

**When rebuilding a single package:** Always build both tsconfig files:

```bash
npm run tsc -- --build packages/core/tsconfig.json packages/core/tsconfig.esm.json
cd packages/core && npm run build  # Creates dist/esm/package.json
```

## Architecture Overview

### Type System Pipeline

```
TypeScript types → type-compiler → ReflectionOp bytecode → processor VM → Type objects
                    (build time)     (Packed arrays)       (runtime)     (JIT compiled)
```

### Package Hierarchy

```
@deepkit/core                 → Utilities, CompilerContext
    ↓
@deepkit/type-spec           → ReflectionOp bytecode definitions (~90 ops)
    ↓
@deepkit/type-compiler       → TypeScript transformer
    ↓
@deepkit/type                → Runtime types, validation, serialization
    ↓
@deepkit/injector            → DI container (types as tokens)
    ↓
@deepkit/app                 → Application container, CLI, config
    ↓
@deepkit/http, /rpc, /orm    → Communication and data layers
    ↓
@deepkit/framework           → Full framework integration
```

See `docs/ARCHITECTURE.md` for detailed data flow diagrams.

## Code Standards

**Formatting:** Prettier via lefthook pre-commit

- 4-space indent for TypeScript
- Single quotes, trailing commas
- Import order: third-party → `@deepkit/*` → relative

**Patterns:**

- `ReceiveType<T>` + `resolveReceiveType()` for runtime type access
- Type annotations via intersection: `string & MinLength<3>`
- JIT compilation via `CompilerContext` for performance

## Error Code System

Deepkit uses inline error codes for consistent, documented errors. Each error has a unique code (e.g., `DK-T100`) linking to documentation.

### Error Code Format

```
DK-T###  = @deepkit/type
DK-O###  = @deepkit/orm
DK-I###  = @deepkit/injector
DK-H###  = @deepkit/http
DK-R###  = @deepkit/rpc
DK-B###  = @deepkit/bson
DK-MG### = @deepkit/mongo
DK-PG### = @deepkit/postgres
DK-MY### = @deepkit/mysql
DK-SQ### = @deepkit/sqlite
```

### Creating New Errors

**Option 1: Inline throw** (for one-off errors):

```typescript
import { DeepkitError } from '@deepkit/core';

throw new DeepkitError('DK-T100', `Class ${className} has no primary key`);
```

**Option 2: Named error class** (for catch-by-type):

```typescript
export class NoPrimaryKeyError extends DeepkitError {
  constructor(className: string) {
    super('DK-T100', `Class ${className} has no primary key`);
  }
}
```

**Option 3: Error hierarchy** (for packages with many errors):

```typescript
// Base error for the package
export class DatabaseError extends DeepkitError {
  constructor(message: string, options?: { cause?: Error }) {
    super('DK-O001', message, options);
  }
}

// Specific error overrides code
export class UniqueConstraintFailure extends DatabaseError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.code = 'DK-O100'; // Override parent code
  }
}
```

### Error Message Guidelines

- Keep messages brief - detailed docs are linked via error code
- Include relevant context (class name, property name, etc.)
- Don't duplicate docs content in the message

### CRITICAL: Never Use Plain `Error`

**NEVER use `throw new Error(...)` in this codebase.** All errors must use `DeepkitError` or a package-specific error class with proper error codes.

```typescript
// ❌ WRONG - Never do this
throw new Error('Something went wrong');

// ✅ CORRECT - Use DeepkitError with code
throw new DeepkitError('DK-T201', 'Cannot serialize inline reference: not loaded');

// ✅ CORRECT - Use package-specific error class
throw new SerializationError('Cannot serialize...', 'inlineReference', path);
throw new BSONError('Cannot serialize inline reference at ' + path);
```

**For JIT-compiled templates:** Ensure the error class is in the compiler context:

```typescript
compiler.context.set('SerializationError', SerializationError);
compiler.context.set('BSONError', BSONError);
```

### Key Files

| Package           | Base Error           | Example Usage                   |
| ----------------- | -------------------- | ------------------------------- |
| @deepkit/core     | `DeepkitError`       | Base class for all coded errors |
| @deepkit/type     | `SerializationError` | Extends DeepkitError (DK-T200)  |
| @deepkit/bson     | `BSONError`          | Extends DeepkitError (DK-B)     |
| @deepkit/orm      | `DatabaseError`      | Extends DeepkitError (DK-O)     |
| @deepkit/injector | `InjectorError`      | Extends DeepkitError (DK-I)     |
| @deepkit/mongo    | `MongoError`         | Extends DeepkitError (DK-MG)    |

## Key Patterns

### Runtime Type Reflection

```typescript
function example<T>(type?: ReceiveType<T>): Type {
  return resolveReceiveType(type);
}
```

### Type Annotations

```typescript
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  email: string & Email = '';
}
```

### Zero-Decorator DI

```typescript
class Service {
  constructor(
    private db: Database,
    private logger: Logger,
  ) {}
}
```

## Testing

- Jest with custom resolver for monorepo
- Tests require type-compiler: `npm run postinstall`
- Memory flags: `--expose-gc --max_old_space_size=3048`

### Running the Full Test Suite

```bash
# 1. Start Docker services (required for database tests)
docker compose up -d

# 2. Run all tests
npm run test

# 3. Stop Docker services when done
docker compose down
```

**Expected results:** All ~175 test suites and ~3200+ tests should pass.

### Docker Compose Services

Services started (alternative ports to avoid conflicts):

**Databases:**

- **PostgreSQL** (port 15432): user `postgres`, no password, trust auth
- **MySQL** (port 13306): user `root`, no password, database `default`
- **MongoDB** (port 27117): replica set `rs0` (required for transactions)
- **MongoDB Auth** (port 27018): user `root`, password `root` (for auth tests)
- **Redis** (port 16379): for broker-redis tests

**Filesystem adapters:**

- **SFTP** (port 10022): user `user`, password `123`
- **FTP** (port 10021): user `user`, password `123`
- **MinIO/S3** (port 10900): user `minioadmin`, password `minioadmin`, bucket `deepkit-test`
- **Fake GCS** (port 10443): Google Cloud Storage emulator

```bash
docker compose up -d   # Start services
docker compose down    # Stop services
docker compose ps      # Check status
```

### Running Specific Package Tests

```bash
npm run test packages/type/                    # All type tests
npm run test packages/postgres/                # PostgreSQL tests (needs Docker)
node --expose-gc --max_old_space_size=3048 node_modules/jest/bin/jest.js packages/type/tests/serializer.spec.ts  # Single file
```

See `docs/TESTING.md` for test strategy and edge cases.

## Performance

Deepkit achieves extreme performance through JIT compilation:

- **Serialization**: ~32M ops/sec (100x faster than class-transformer)
- **Validation**: ~26M ops/sec (270x faster than class-validator)
- **BSON**: 13x faster than official bson-js

See `docs/BENCHMARKS.md` for tracking methodology.

### Viewing Generated JIT Code

To debug performance issues, view the generated JIT code by enabling debug mode:

```typescript
import { setJitDebug } from '@deepkit/core';

// Enable before calling getBSONSerializer/getBSONDeserializer
setJitDebug(true);

// This will print the generated code to console
const serializer = getBSONSerializer<MyType>();
```

Example output shows the generated JavaScript function with all type-specific optimizations inlined.

Quick command to view JIT code for a specific type:

```bash
cd packages/bson
node --import @deepkit/run -e "
import { setJitDebug } from '@deepkit/core';
import { getBSONSerializer } from './index.js';
setJitDebug(true);
type T = { v: Map<string, number> };  // Change this type
getBSONSerializer<T>();
"
```

## Benchmarks

**Location:** `benchmarks/` (root-level, separate from packages)

### Directory Structure

```
benchmarks/
├── src/
│   ├── runner.ts                    # Main benchmark runner CLI
│   ├── generate-report.ts           # Report generation
│   ├── reporter/                    # Output formatters (json, markdown, svg)
│   └── benchmarks/
│       ├── core/                    # Deepkit internal benchmarks
│       │   ├── type/                # @deepkit/type (serialization, validation)
│       │   ├── bson/                # @deepkit/bson
│       │   ├── injector/            # @deepkit/injector
│       │   ├── orm/                 # @deepkit/orm
│       │   ├── http/                # @deepkit/http
│       │   ├── rpc/                 # @deepkit/rpc
│       │   └── ...
│       ├── comparison/              # vs external libraries
│       │   ├── serialization/       # vs class-transformer, etc.
│       │   ├── validation/          # vs zod, class-validator, etc.
│       │   ├── typeguard/           # vs typia, zod, etc.
│       │   └── bson/                # vs bson-js
│       ├── debug/                   # Local profiling benchmarks
│       └── v8-patterns/             # V8 optimization microbenchmarks
├── baselines/                       # Stored baseline results
├── typia-src/                       # Typia integration for comparison
└── package.json
```

### Running Benchmarks

```bash
cd benchmarks
npm install

# Run core benchmarks (Deepkit internal, for CI)
npm run benchmark

# Run comparison benchmarks (vs external libs like Zod, Typia)
npm run benchmark:comparison

# Run all benchmarks
npm run benchmark:all

# Filter by name
npm run benchmark -- -f "serialize"

# Output JSON for CI
npm run benchmark -- -j results.json

# Compare against baseline (fails if >20% regression)
npm run benchmark -- --compare-baseline

# Save new baseline
npm run benchmark -- --save-baseline
```

### Quick Package Benchmarks

For quick local benchmarking during development, packages have their own benchmark files:

```bash
# Package-specific benchmarks (simpler, for quick iteration)
cd packages/type && node --import @deepkit/run benchmarks/serializer.ts
cd packages/core && node --import @deepkit/run benchmarks/jit.ts
```

### Writing Benchmarks

Create a `.bench.ts` file:

```typescript
import { BenchSuite, warmup } from '@deepkit/bench';

export default function () {
  const suite = new BenchSuite('My Benchmark');

  const myFunction = () => {
    /* ... */
  };
  warmup(myFunction); // Warmup for V8 optimization

  suite.add('operation name', () => {
    myFunction();
  });

  return suite;
}
```

## Documentation Structure

```
docs/
├── ARCHITECTURE.md   # Technical architecture, data flows
├── TESTING.md        # Test strategy, coverage, edge cases
├── BENCHMARKS.md     # Performance tracking
├── VISION.md         # Goals, competition, strategy
├── CONTRIBUTING.md   # Development workflow
├── PACKAGES.md       # Package reference guide
├── QUALITY.md        # QA processes
├── ROADMAP.md        # Future plans
│
├── team/             # Team roles (pipeline-based workflow)
│   ├── README.md     # Team intro & pipeline diagram
│   ├── lead.md       # 🧑‍💼 Max - Orchestrator
│   ├── perf.md       # 🏎️ Turbo - Performance guardian
│   ├── security.md   # 🔒 Sam - Security reviewer
│   ├── dx.md         # 🎨 Devon - DX advocate
│   ├── docs.md       # 📝 Dana - Documentation keeper
│   └── impact.md     # 🌊 River - Impact analyst
│
└── todo/             # Issue and task tracking
    ├── todo.md       # Main tracker (GitHub issues, codebase issues)
    ├── _ISSUE_TEMPLATE/
    ├── packages/     # Per-package improvement checklists
    └── <issue-id>/   # Issue-specific work folders
```

## Task Tracking

All task tracking and agent workflow instructions are in `docs/todo.md`.

### Quick Reference

- **Workflow**: `docs/todo.md` (pipeline & backlog)
- **Team roles**: `docs/team/` (who does what)
- **Issue tracking**: `docs/todo/<issue-id>/`

### Pre-commit Hooks (lefthook.yml)

Commits are automatically blocked if:

- Typecheck fails (`npm run typecheck`)
- Lint fails (prettier)
- Commit message doesn't follow conventional format

### Git Commits

**Important:** Changelog is auto-generated from commit messages. Use semantic commits with clear descriptions.

**Format:** `type(scope): short description`

**Types:**

- `fix` - Bug fixes
- `feat` - New features
- `refactor` - Code changes that neither fix bugs nor add features
- `test` - Adding or updating tests
- `docs` - Documentation changes
- `perf` - Performance improvements
- `chore` - Maintenance tasks

**Scopes:** Use package names without `@deepkit/` prefix (e.g., `rpc`, `type`, `orm`, `http`)

**Rules:**

- One logical change per commit (don't mix unrelated changes)
- Split large changes by scope for clean history
- Write meaningful descriptions explaining _why_, not just _what_
- Reference issues when applicable: `fix(rpc): description (#123)`

**Examples:**

```
fix(rpc): prevent premature GC of Subjects during active subscriptions

V8's aggressive optimization can mark variables as "dead" during await,
causing FinalizationRegistry to fire prematurely. Track active subscriptions
and keep strong references while subscriptions exist.

test(rpc): add comprehensive tests for Subject GC stability

Cover edge cases: multiple subscriptions, partial unsubscribe, rapid cycles,
concurrent subjects, error handling, and long-running subscriptions.
```

## Working with This Codebase

### When Making Changes

1. **Run tests** for affected packages
2. **Check performance** if touching hot paths (type, bson, orm)
3. **Update tests** for bug fixes (regression tests)
4. **Consider edge cases** (null, undefined, unions, generics)

**CRITICAL for type-compiler changes:** The type-compiler is the foundation of the entire framework. Changes to `packages/type-compiler/src/compiler.ts` affect all packages. Before committing ANY type-compiler change:

```bash
# MANDATORY: Run the full type test suite (1900+ tests)
npm run tsc && node --expose-gc --max_old_space_size=3048 node_modules/jest/bin/jest.js --forceExit --no-cache "packages/type/"
```

Do NOT commit type-compiler changes based only on new test files you create - the existing test suite in `packages/type/` covers many edge cases for runtime type inference, generics, and conditional types that may not be obvious from isolated tests.

**CRITICAL: Never check if test failures are "pre-existing":** When a test fails, FIX IT. Do not waste time checking out previous commits or stashing changes to verify if a failure existed before. We do not care about blame or history - if a test is failing, it needs to be fixed NOW. This applies to all test failures encountered during development.

### Key Files

| Area              | Key Files                                   |
| ----------------- | ------------------------------------------- |
| Type compiler     | `packages/type-compiler/src/compiler.ts`    |
| Runtime processor | `packages/type/src/reflection/processor.ts` |
| Serialization     | `packages/type/src/serializer.ts`           |
| DI container      | `packages/injector/src/injector.ts`         |
| Query builder     | `packages/orm/src/query.ts`                 |
| HTTP kernel       | `packages/http/src/kernel.ts`               |

### Disabling Reflection

```typescript
/** @reflection never */
interface InternalType {}
```

## Project Context

- **Creator**: Marc J. Schmidt (Deepkit UG, Germany)
- **License**: MIT
- **Funding**: 100% self-financed
- **GitHub**: ~3,400 stars, growing adoption
- **Competition**: NestJS (decorator-heavy), tRPC (Zod schemas), Express (manual)

## Success Criteria

When working on this project, optimize for:

1. **Type safety**: Runtime must match compile-time guarantees
2. **Performance**: No regressions, maintain benchmark leadership
3. **Simplicity**: Prefer solutions using native TypeScript types
4. **Integration**: Components should work seamlessly together
