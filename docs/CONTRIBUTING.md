# Contributing Guide

This document provides comprehensive guidance for contributing to the Deepkit Framework, including development workflow, code standards, and submission process.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Code Standards](#code-standards)
4. [Development Workflow](#development-workflow)
5. [Testing Requirements](#testing-requirements)
6. [Documentation](#documentation)
7. [Pull Request Process](#pull-request-process)
8. [Issue Guidelines](#issue-guidelines)
9. [Release Process](#release-process)

---

## Getting Started

### Prerequisites

- **Node.js >= 20**
- **Yarn 4.x** (via corepack)
- **Git**
- **libpq5** and **libpq-dev** (for PostgreSQL tests)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/deepkit/deepkit-framework.git
cd deepkit-framework

# Install dependencies
yarn

# Build the type compiler (REQUIRED)
npm run postinstall

# Build all packages
npm run build

# Run tests to verify setup
npm run test packages/type/
```

### Understanding the Monorepo

```
deepkit-framework/
├── packages/           # All framework packages
│   ├── type/          # Core runtime types
│   ├── type-compiler/ # TypeScript transformer
│   ├── type-spec/     # Bytecode definitions
│   ├── injector/      # Dependency injection
│   ├── app/           # Application container
│   ├── http/          # HTTP router
│   ├── rpc/           # Binary RPC
│   ├── orm/           # Database ORM
│   └── ...            # ~50 packages total
├── website/           # Documentation website
├── docs/              # Internal documentation
└── CLAUDE.md          # AI assistant guidance
```

---

## Development Environment

### IDE Setup

**VS Code (Recommended)**
```json
// .vscode/settings.json
{
    "typescript.tsdk": "node_modules/typescript/lib",
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

**WebStorm/IntelliJ**
- Enable TypeScript service
- Configure Prettier as formatter
- Set Node.js interpreter to v20+

### Watch Mode

During development, run the TypeScript watcher:

```bash
# Watch for changes
npm run tsc-watch

# For ESM packages (Angular integration)
npm run tsc-watch:esm
```

### Testing Local Changes

Link your local Deepkit to a test project:

```bash
# In your test project
npm install npm-local-development --save-dev

# Create .links.json
{
    "@deepkit/type": "../deepkit-framework/packages/type",
    "@deepkit/orm": "../deepkit-framework/packages/orm"
}

# Link packages
npm run link
```

---

## Code Standards

### TypeScript Guidelines

**Do:**
```typescript
// Use explicit types for public APIs
export function validate<T>(value: unknown, type?: ReceiveType<T>): ValidationError[] {
    // Implementation
}

// Use meaningful variable names
const userValidator = getValidatorFunction(undefined, userType);

// Document complex logic
/**
 * Processes the bytecode stack and constructs the runtime type.
 * The processor is a stack-based VM that executes ReflectionOp operations.
 */
function processStack(stack: RuntimeStackEntry[]): Type {
    // Implementation
}
```

**Don't:**
```typescript
// Avoid `any` without justification
function process(x: any) { } // Bad

// Avoid abbreviations
const v = getVal(); // Bad
const value = getValue(); // Good

// Avoid deeply nested callbacks
doA(() => doB(() => doC(() => doD()))); // Bad
```

### Formatting

Prettier handles formatting automatically via `lefthook` pre-commit hook.

Key settings:
- 4-space indentation for TypeScript files
- Single quotes
- Trailing commas
- 120 character line width (250 for tests and compiler.ts)

```bash
# Manual formatting
npx prettier --write packages/type/src/**/*.ts
```

### Import Order

Managed by `@trivago/prettier-plugin-sort-imports`:

```typescript
// 1. Third-party modules
import { something } from 'external-lib';

// 2. @deepkit packages
import { Type } from '@deepkit/type';

// 3. Relative imports
import { helper } from './utils.js';
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `ReflectionClass`, `HttpKernel` |
| Interfaces | PascalCase | `LoggerInterface`, `DatabaseAdapter` |
| Functions | camelCase | `serialize`, `validateType` |
| Constants | UPPER_SNAKE | `MAX_ITERATIONS`, `DEFAULT_TIMEOUT` |
| Type Parameters | Single uppercase | `T`, `K`, `V` |
| Private properties | No prefix | `this.cache` (not `this._cache`) |

---

## Development Workflow

### Branch Strategy

```
master (main branch)
├── feature/add-redis-adapter
├── fix/serialization-null-handling
├── docs/improve-orm-guide
└── perf/optimize-bson-encoder
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `perf/` - Performance improvements
- `refactor/` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `perf`: Performance improvement
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```
feat(orm): add support for composite primary keys

fix(type): handle null values in union serialization

Fixes #123

perf(bson): optimize string encoding for large documents

Benchmark results:
- Before: 15ms/10K objects
- After: 12ms/10K objects (20% improvement)
```

### Development Cycle

1. **Create branch** from `master`
2. **Make changes** with tests
3. **Run tests** locally
4. **Format code** (automatic via pre-commit)
5. **Push branch** and create PR
6. **Address review** feedback
7. **Merge** after approval

---

## Testing Requirements

### Test Coverage

All changes must include tests:

| Change Type | Test Requirement |
|-------------|------------------|
| New feature | Unit tests + integration test |
| Bug fix | Regression test that fails before fix |
| Performance | Benchmark comparison |
| Refactor | Existing tests must pass |

### Running Tests

```bash
# All tests
npm run test

# Specific package
npm run test packages/orm/

# Single file
node --expose-gc --max_old_space_size=3048 \
    node_modules/jest/bin/jest.js \
    packages/type/tests/serializer.spec.ts

# Watch mode
npm run test -- --watch packages/type/
```

### Writing Tests

```typescript
import { expect, test, describe } from '@jest/globals';

describe('FeatureName', () => {
    test('should handle normal case', () => {
        const result = myFunction('input');
        expect(result).toBe('expected');
    });

    test('should handle edge case: empty input', () => {
        expect(myFunction('')).toBe('');
    });

    test('should throw on invalid input', () => {
        expect(() => myFunction(null)).toThrow('Invalid input');
    });
});
```

### Test Utilities

```typescript
// packages/framework/src/testing.ts
import { createTestingApp } from '@deepkit/framework';

test('http endpoint', async () => {
    const app = createTestingApp({
        controllers: [MyController],
    });

    const response = await app.request(HttpRequest.GET('/endpoint'));
    expect(response.statusCode).toBe(200);
});
```

---

## Documentation

### Code Documentation

Document public APIs with JSDoc:

```typescript
/**
 * Validates a value against a TypeScript type.
 *
 * @param value - The value to validate
 * @param type - Optional type information (automatically provided by compiler)
 * @returns Array of validation errors, empty if valid
 *
 * @example
 * ```typescript
 * const errors = validate<User>(userData);
 * if (errors.length > 0) {
 *     console.log('Validation failed:', errors);
 * }
 * ```
 */
export function validate<T>(value: unknown, type?: ReceiveType<T>): ValidationError[] {
    // Implementation
}
```

### README Updates

When adding features, update relevant READMEs:
- `packages/*/README.md` - Package-specific docs
- `README.md` - Main project README for major features

### Website Documentation

For significant features, add documentation pages:
- Location: `website/src/pages/documentation/`
- Format: Markdown with frontmatter

---

## Pull Request Process

### Before Submitting

- [ ] Tests pass locally
- [ ] Code is formatted (automatic)
- [ ] Commit messages follow conventions
- [ ] Documentation updated if needed
- [ ] No unrelated changes included

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- How was this tested?
- Any specific test cases to highlight?

## Related Issues
Closes #123

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** must pass (CI, formatting)
2. **Code review** by maintainer
3. **Testing** verification
4. **Merge** by maintainer

### After Merge

- Delete your branch
- Verify changes in `master`
- Close related issues

---

## Issue Guidelines

### Bug Reports

```markdown
## Description
Clear description of the bug.

## Steps to Reproduce
1. Create a class with...
2. Call validate()...
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Node version:
- Deepkit version:
- OS:

## Reproduction
Link to minimal reproduction or code snippet.
```

### Feature Requests

```markdown
## Problem
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches considered.

## Additional Context
Any other relevant information.
```

### Questions

For questions, use:
- [GitHub Discussions](https://github.com/deepkit/deepkit-framework/discussions)
- [Discord](https://discord.gg/U24mryk7Wq)

---

## Release Process

### Versioning

Deepkit follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

### Release Commands

```bash
# Publish patch release
npm run publish

# Force publish all packages
npm run publish-force
```

### Changelog

Maintain changelog in release notes:
- List all changes with PR references
- Highlight breaking changes
- Include migration guide for breaking changes

---

## Community

### Getting Help

- **Discord**: Real-time chat and questions
- **GitHub Discussions**: Long-form discussions
- **GitHub Issues**: Bug reports and feature requests

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help newcomers
- Focus on the technical merits

### Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Website contributors page

---

## Quick Reference

### Common Commands

```bash
# Install and build
yarn && npm run postinstall && npm run build

# Watch mode
npm run tsc-watch

# Test specific package
npm run test packages/type/

# Format code
npx prettier --write packages/*/src/**/*.ts

# Clean build
npm run clean
```

### Package Structure

```
packages/my-package/
├── src/
│   ├── index.ts       # Main exports
│   └── *.ts           # Source files
├── tests/
│   └── *.spec.ts      # Test files
├── package.json       # Package config + jest config
├── tsconfig.json      # TypeScript config
└── README.md          # Package documentation
```

### Key Files to Know

| File | Purpose |
|------|---------|
| `packages/type/src/reflection/processor.ts` | Runtime type processor |
| `packages/type-compiler/src/compiler.ts` | TypeScript transformer |
| `packages/type/src/serializer.ts` | JIT serialization |
| `packages/injector/src/injector.ts` | DI container |
| `packages/orm/src/query.ts` | Query builder |
| `packages/http/src/kernel.ts` | HTTP request handling |
