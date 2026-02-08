# Project Vision and Strategy

This document captures the vision, philosophy, competitive landscape, and strategic direction of the Deepkit Framework. It serves as a north star for all development decisions.

## Table of Contents

1. [Core Problem Statement](#core-problem-statement)
2. [The Deepkit Solution](#the-deepkit-solution)
3. [Design Philosophy](#design-philosophy)
4. [Competitive Landscape](#competitive-landscape)
5. [Target Audience](#target-audience)
6. [Strategic Differentiators](#strategic-differentiators)
7. [Success Metrics](#success-metrics)
8. [Future Vision](#future-vision)

---

## Core Problem Statement

### The Schema Fragmentation Crisis

TypeScript developers face a fundamental contradiction: **TypeScript provides excellent compile-time types, but these types disappear at runtime.**

This leads to the "schema fragmentation" problem:

```typescript
// 1. TypeScript interface
interface User {
    id: number;
    email: string;
    createdAt: Date;
}

// 2. Zod schema for validation
const UserSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    createdAt: z.date(),
});

// 3. class-validator for request validation
class UserDto {
    @IsNumber()
    id!: number;

    @IsEmail()
    email!: string;

    @IsDate()
    createdAt!: Date;
}

// 4. TypeORM entity for database
@Entity()
class UserEntity {
    @PrimaryColumn()
    id!: number;

    @Column()
    email!: string;

    @Column()
    createdAt!: Date;
}

// FOUR definitions for the same thing!
```

### The Consequences

1. **Maintenance Burden**: Changes must be synchronized across multiple definitions
2. **Runtime Overhead**: Each library implements its own reflection/validation logic
3. **Ecosystem Fragmentation**: Libraries can't share type information
4. **Lost Type Safety**: Runtime behavior diverges from compile-time types
5. **Cognitive Load**: Developers learn multiple schema DSLs

### Why TypeScript Won't Solve This

The TypeScript team has [explicitly stated](https://github.com/microsoft/TypeScript/issues/47658) that runtime types are "out of scope":

> "TypeScript's design goals explicitly oppose a runtime type system... type information should be erasable."

This is a deliberate design decision, not a limitation to be fixed.

---

## The Deepkit Solution

### One Type, Everywhere

Deepkit's type compiler transforms TypeScript types into runtime-accessible bytecode:

```typescript
import { PrimaryKey, AutoIncrement, Email, MinLength } from '@deepkit/type';

// ONE definition works everywhere
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    email: string & Email = '';
    createdAt: Date = new Date();

    constructor(public username: string & MinLength<3>) {}
}

// Validation - uses the type
validate<User>(data);

// Serialization - uses the type
serialize<User>(user);

// Database - uses the type
database.persist(user);

// HTTP - uses the type
@http.POST('/user')
create(body: HttpBody<User>) { }

// Dependency Injection - uses the type
class Service {
    constructor(private db: Database) {} // No decorators needed
}
```

### Technical Innovation

1. **Compile-Time Transformation**: TypeScript AST → ReflectionOp bytecode
2. **Runtime Processor**: Stack-based VM executes bytecode to reconstruct types
3. **JIT Compilation**: Generated code paths for each type achieve maximum performance
4. **Type Annotations**: Constraints via TypeScript intersection types (`string & MinLength<3>`)

---

## Design Philosophy

### 1. TypeScript-First

TypeScript types are the source of truth. Never ask developers to learn another schema DSL.

**Do:**
```typescript
interface User {
    name: string & MinLength<3>;
}
```

**Don't:**
```typescript
const UserSchema = t.object({
    name: t.string().minLength(3),
});
```

### 2. Performance is a Feature

Runtime type operations must be fast enough that developers never need to avoid them. Performance is achieved through JIT compilation and architectural choices, not compromises.

### 3. Zero-Decorator DI

Dependency injection should work on pure TypeScript without `@Injectable()` boilerplate:

```typescript
// This should just work
class UserService {
    constructor(private db: Database, private logger: Logger) {}
}
```

### 4. Integrated, Not Fragmented

The framework provides cohesive libraries that work together seamlessly, like Spring for Java or Laravel for PHP.

### 5. Full-Stack TypeScript

Same types work from frontend to database. No translation layers, no code generation, no sync issues.

### 6. Progressive Adoption

Use only what you need. `@deepkit/type` works standalone. Add `@deepkit/orm` when needed. Upgrade to full framework when ready.

---

## Competitive Landscape

### Direct Competitors

| Framework | Approach | Limitations |
|-----------|----------|-------------|
| **NestJS** | Decorators + runtime metadata | Requires decorators everywhere, slow reflection |
| **tRPC** | Zod schemas, inference | Separate schema definitions, Zod DSL |
| **Fastify** | JSON Schema validation | Separate schemas, no TypeScript integration |
| **Express** | Manual validation | No built-in type safety |

### Schema Libraries

| Library | Approach | vs Deepkit |
|---------|----------|------------|
| **Zod** | Custom DSL | Separate schema definition required |
| **TypeBox** | JSON Schema generator | Separate definition, less expressive |
| **class-validator** | Decorators | Decorator boilerplate, slower |
| **io-ts** | Functional combinators | Complex syntax, poor ergonomics |
| **Yup** | Schema DSL | No TypeScript type inference |

### ORM Alternatives

| ORM | Approach | vs Deepkit |
|-----|----------|------------|
| **TypeORM** | Decorators | Decorator duplication, slower hydration |
| **Prisma** | Code generation | Build step, generated types |
| **Drizzle** | Schema builder | Separate schema, SQL-focused |
| **MikroORM** | Decorators + reflection | Better than TypeORM, still decorator-heavy |

### Deepkit Advantages

1. **Single Source of Truth**: One type definition for all uses
2. **Superior Performance**: JIT-compiled validation/serialization
3. **Native TypeScript**: Uses TypeScript syntax, not a DSL
4. **Type Annotations**: Constraints compose with TypeScript's type system
5. **Full Integration**: HTTP, RPC, ORM, DI work together seamlessly

---

## Target Audience

### Primary Personas

#### 1. Enterprise Development Teams

**Needs:**
- Type safety across large codebases
- Performance at scale
- Maintainable architecture
- Strong contracts between services

**Why Deepkit:**
- Eliminates schema synchronization bugs
- Performance handles high throughput
- Module system supports large teams
- RPC provides type-safe service contracts

#### 2. Full-Stack TypeScript Developers

**Needs:**
- Share types between frontend and backend
- Minimize boilerplate
- Fast development iteration
- Modern tooling

**Why Deepkit:**
- Same types work everywhere
- Zero-decorator DI
- Hot module reloading support
- First-class Vite/Bun support

#### 3. Performance-Critical Applications

**Needs:**
- Minimal runtime overhead
- Efficient serialization
- Fast database operations
- Predictable latency

**Why Deepkit:**
- JIT-compiled operations
- Efficient BSON for binary protocols
- Optimized ORM with identity map
- Custom database drivers built for speed

### Anti-Personas (Not Primary Targets)

- **Prototyping-focused teams** preferring convention over configuration
- **Non-TypeScript projects** (JavaScript-only, Python, etc.)
- **Microservice teams using multiple languages** (need language-agnostic protocols)

---

## Strategic Differentiators

### 1. The Type Compiler Moat

The `@deepkit/type-compiler` is a significant technical achievement:
- Deep TypeScript AST understanding
- Bytecode generation for ~90 operations
- Handles TypeScript's full type system (generics, conditionals, mapped types)

This creates a sustainable competitive advantage that's difficult to replicate.

### 2. Performance Leadership

Performance leadership in serialization, validation, and BSON establishes Deepkit as the performance choice. The architecture enables this through:

- JIT-compiled type operations
- Custom database drivers (not wrappers)
- Zero-overhead dependency injection
- Efficient binary protocols

### 3. Full-Stack Integration

Unlike single-purpose libraries, Deepkit provides an integrated stack:
- HTTP + RPC + ORM + DI + Events + Workflows
- All components share the type system
- Debug tools provide unified visibility

### 4. Enterprise Features

Production-ready features for serious applications:
- Database migrations
- Performance profiling (Stopwatch)
- Debug GUI
- Message broker
- Filesystem abstraction

---

## Success Metrics

### Adoption Metrics

| Metric | Current | 1-Year Target | 3-Year Target |
|--------|---------|---------------|---------------|
| npm weekly downloads | ~1,000 | 10,000 | 100,000 |
| GitHub stars | ~3,400 | 8,000 | 20,000 |
| Discord members | ~300 | 1,000 | 5,000 |
| Production users | ~50 | 500 | 5,000 |

### Technical Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test coverage | ~70% | >85% |
| Performance regression | None | Zero tolerance |
| Breaking changes per year | ~5 | <2 |
| Documentation coverage | Partial | Complete |

### Community Metrics

| Metric | Target |
|--------|--------|
| Average issue response time | <48 hours |
| PR review time | <1 week |
| Unanswered questions | <10% |
| Community packages | 20+ |

---

## Future Vision

### Near-Term (6-12 months)

1. **Documentation Overhaul**: Complete guides, tutorials, and API docs
2. **Ecosystem Growth**: More adapters (Redis cache, cloud services)
3. **Tooling**: Better IDE support, CLI improvements
4. **Performance**: Continue benchmark leadership

### Medium-Term (1-2 years)

1. **GraphQL Integration**: First-class GraphQL support using runtime types
2. **Serverless Optimization**: Cold start improvements, edge runtime support
3. **Mobile**: React Native and mobile-optimized packages
4. **Monitoring**: APM integration, distributed tracing

### Long-Term (3-5 years)

1. **TypeRunner**: Ultra-fast TypeScript type checker (separate project)
2. **IDE Integration**: Native TypeScript language service extensions
3. **Cloud Platform**: Managed Deepkit infrastructure
4. **Enterprise Support**: Commercial support and training

### The Ultimate Goal

Make runtime types a standard part of TypeScript development. If Deepkit's approach becomes the norm, every TypeScript developer benefits from:
- No more schema duplication
- Blazing fast runtime type operations
- Type-safe full-stack development
- Unified ecosystem of compatible libraries

---

## Guiding Principles for Development

When making decisions, ask:

1. **Does this eliminate schema duplication?** Prefer approaches that use TypeScript types directly.

2. **Is this fast enough?** Performance is a feature. Benchmark before merging.

3. **Does this require decorators?** Prefer solutions that work on plain TypeScript.

4. **Is this integrated?** Components should work together seamlessly.

5. **Is this progressive?** Users should be able to adopt incrementally.

6. **Does this serve enterprise needs?** Think about scale, maintenance, and teams.

---

## Contribution to TypeScript Ecosystem

Deepkit's innovations can influence the broader ecosystem:

1. **Proof of Concept**: Demonstrates runtime types are viable and valuable
2. **Performance Standards**: Raises the bar for validation/serialization speed
3. **Type Annotation Pattern**: Shows how to extend types with metadata
4. **JIT Compilation Patterns**: Demonstrates how to achieve performance parity with manual code

Even if developers don't use Deepkit directly, these patterns can influence how they think about TypeScript tooling.
