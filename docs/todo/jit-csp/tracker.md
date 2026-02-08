# @deepkit/type Rewrite Tracker

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| jit.ts primitives | ✅ Done | var_, setVar, getVar, switch_, ternary, isInstance, throw_, forIn, cond, concat, typeof_ |
| Tiered execution | ✅ Done | Exec mode first, JIT after N calls (default 10). Fast bootstrap. |
| Capability investigation | ✅ Done | All 15 agents completed, design.md updated with 33 capability sections |
| Recursion handling | ✅ Done | Build-time (typeStack/fnCache) + runtime (_stack) documented |
| Documentation consolidation | ✅ Done | pattern-mapping.md + union-serialization-matrix.md merged into design.md (2984 lines) |
| Reset type/src | N/A | Creating new serializer/ subdirectory instead |
| serializer/ module | ✅ Done | New jit.fn()-based serializer in packages/type/src/serializer/ |
| change-detector.ts | ✅ Done | Refactored to use jit |
| snapshot.ts | ✅ Done | Refactored to use jit |
| path.ts | ✅ Done | Refactored to use jit |
| Integration | ✅ Done | All type package tests pass |
| Testing | ✅ Done | 51 suites, 1943 tests pass |
| Downstream packages | ⏳ Pending | BSON, SQL, Mongo, MySQL, SQLite need API migration (539 TS errors total) |

---

## Files Tracking

### Non-JIT Files (copy from src-old)

These files don't use JIT compilation - just copy them:

- `reflection/type.ts` (114KB)
- `reflection/processor.ts` (105KB)
- `reflection/reflection.ts` (55KB)
- `reflection/extends.ts` (32KB)
- `reflection/state.ts`
- `core.ts`, `utils.ts`, `default.ts`
- `changes.ts`, `reference.ts`, `registry.ts`
- `inheritance.ts`, `mixin.ts`, `debug.ts`, `types.ts`
- `validators.ts`, `decorator.ts`, `decorator-builder.ts`
- `type-serialization.ts`

### JIT Files (must rewrite with jit.fn())

| File | Status | Notes |
|------|--------|-------|
| `serializer.ts` | ✅ Done | Main compilation in src/serializer/ |
| `serializer-facade.ts` | ✅ Done | Public API, no JIT needed |
| `change-detector.ts` | ✅ Done | Refactored to use jit |
| `snapshot.ts` | ✅ Done | Refactored to use jit |
| `path.ts` | ✅ Done | Refactored to use jit |
| `typeguard.ts` | ✅ Done | Simple wrapper, no JIT |
| `validator.ts` | ✅ Done | Simple wrapper, no JIT |
| `index.ts` | ✅ Done | Just exports |

### Downstream Packages (need API migration)

**Total: 539 TypeScript errors across 13 files**

| Package | File | Errors | Priority | Notes |
|---------|------|--------|----------|-------|
| @deepkit/bson | `bson-serializer.ts` | 221 | 🔴 CRITICAL | Extensive TemplateState, compilerContext usage |
| @deepkit/bson | `bson-deserializer-templates.ts` | 160 | 🔴 CRITICAL | Template-based deserialization |
| @deepkit/bson | `bson-deserializer.ts` | 3 | 🔴 CRITICAL | Part of BSON module |
| @deepkit/bson | `utils.ts` | 1 | 🟢 LOW | Minor utility |
| @deepkit/sql | `sql-serializer.ts` | 117 | 🔴 CRITICAL | Base for all SQL adapters |
| @deepkit/mongo | `mongo-serializer.ts` | 11 | 🟠 HIGH | Extends BSON serializer |
| @deepkit/mongo | `persistence.ts` | 2 | 🟡 MEDIUM | Database persistence |
| @deepkit/mongo | `mapping.ts` | 2 | 🟡 MEDIUM | Type mapping |
| @deepkit/mongo | `query.resolver.ts` | 1 | 🟢 LOW | Query resolution |
| @deepkit/mysql | `mysql-serializer.ts` | 9 | 🟠 HIGH | Extends SQL serializer |
| @deepkit/sqlite | `sqlite-serializer.ts` | 7 | 🟠 HIGH | Extends SQL serializer |
| @deepkit/orm | `utils.ts` | 1 | 🟢 LOW | ORM utilities |
| @deepkit/desktop-ui | `state.ts` | 4 | 🟢 LOW | UI state (may be unrelated) |

**Migration Order (by dependency):**
1. **Phase 2a: @deepkit/bson** (385 errors) - MUST be first, all binary serialization depends on it
2. **Phase 2b: @deepkit/sql** (117 errors) - Base for SQL adapters
3. **Phase 2c: @deepkit/mongo** (16 errors) - Depends on BSON
4. **Phase 2d: SQL adapters** - MySQL (9), SQLite (7) - Depend on SQL
5. **Phase 2e: Cleanup** - ORM (1), desktop-ui (4)

**Old API (to migrate away from):**
- `TemplateState.accessor` → Use `state.data` Ref directly
- `TemplateState.addSetter` → Use `b.assign()` or `b.set()`
- `TemplateState.addCode` → Use `b.block()` or return expression
- `TemplateState.setContext` → Use `b.const()` or closure capture
- `TemplateState.fork()` → Create new BuildState
- `TemplateState.setter` → Use `b.assign()` target
- `TemplateState.compilerContext` → No longer needed (jit handles)
- `HandlerRegistry.prependClass` → Use `registry.registerClass()` with higher specificality
- `TypeHandler` signature: `void` → `Slot<any>` (must return expression)
- `executeTemplates()` → Not needed (jit.fn() handles)
- `ContainerAccessor` → Use Ref indexing directly
- `getIndexCheck()`, `getNameExpression()`, `sortSignatures()` → Internalized in handlers

**Missing Exports from @deepkit/type (downstream packages import these):**

| Export | Used By | Status | Migration |
|--------|---------|--------|-----------|
| `ContainerAccessor` | bson | ❌ Removed | Use Ref indexing: `b.index(obj, key)` |
| `executeTemplates` | bson | ❌ Removed | Not needed, jit.fn() handles execution |
| `getIndexCheck` | bson | ❌ Removed | Internalized in handlers, use `b.has()` |
| `getNameExpression` | bson | ❌ Removed | Internalized, use `b.literal(name)` |
| `getStaticDefaultCodeForProperty` | bson | ❌ Removed | Use `getDefaultValue()` from type metadata |
| `sortSignatures` | bson | ❌ Removed | Use `toSignature()` or sort manually |
| `TypeGuardRegistry.getSortedTemplateRegistries` | bson | ❌ Removed | Use `HandlerRegistry.getHandler()` |
| `HandlerRegistry.serializer` | bson | ❌ Removed | Access via `state.serializer` |
| `TemplateState.*` (20+ methods) | bson, sql | ❌ Removed | See "Old API" mapping above |

---

## jit.ts Extensions

| Primitive | Status | Purpose |
|-----------|--------|---------|
| `var_(initial)` | ✅ Added | Create mutable cell |
| `setVar(ref, value)` | ✅ Added | Update mutable cell |
| `getVar(ref)` | ✅ Added | Read mutable cell |
| `switch_(value, cases, default)` | ✅ Added | Switch statement |
| `ternary(cond, then, else)` | ✅ Added | Inline conditional |
| `isInstance(value, ctor)` | ✅ Added | instanceof check |

---

## Previous Failures (for reference)

**Attempt 1**: Agent created jit-based serializer but sub-agents "fixed" by restoring CompilerContext.

**Attempt 2**: Spawned agents fell back to CompilerContext when jit.fn() seemed difficult:
- `change-detector.ts` - ctx.when() state tracking issue
- `path.ts` - Fell back to CompilerContext
- `serializer.ts` - Mixed approach

**Root cause**: Agents default to CompilerContext when patterns don't fit jit.fn() easily.

**Solution**: Extend jit.ts with new primitives (done), never fall back to CompilerContext.

---

## Session Log

### 2026-01-21

- Added jit.ts primitives: var_, setVar, getVar, switch_, ternary, isInstance
- All 181 jit.spec.ts tests passing
- Consolidated docs into plan.md + tracker.md
- Next: Reset type/src, start rewrite

### 2026-01-22

**Comprehensive Capability Investigation Complete**

Spawned 7 investigation agents to analyze all current capabilities:

1. **Type Handlers (a5fd7a8)** ✅
   - Documented all ReflectionKind handlers
   - Class-specific handlers (Date, Set, Map, Binary types)
   - Decorator annotations (Reference, Embedded, Group, etc.)

2. **Specificality System (aa46ff6)** ✅
   - 10+ specificality levels from -0.9 to 50
   - Context-specific ranges (HTTP, CLI, JSON, SQL/BSON, Validation)
   - Priority ordering for union resolution

3. **Public API Surface (a2f3136)** ✅
   - All exported functions, classes, types
   - Usage patterns by external packages
   - ReflectionClass, ReflectionProperty APIs

4. **Downstream Dependencies (a96dbc2)** ✅
   - BSON: TemplateState, TemplateRegistry, sizer/serialize/deserialize registries
   - SQL: Serializer base class, serializeObjectLiteral, handleUnion
   - Mongo: BSONBinarySerializer extension, EmptySerializer

5. **Specialized Features (a36193d)** ✅
   - Reference handling (FK, Inline, hydration)
   - Embedded types (flattening, prefixes)
   - Groups, Exclusions, Naming strategies
   - Mapped types handled by processor (no serializer work needed)

6. **Validation System (a64a853)** ✅
   - 21 built-in validators documented
   - Custom validator API (Validate<typeof fn>)
   - Class-level validators (@t.validator)
   - Validation API: is(), validate(), validates(), assert(), guard()

7. **Test Cases (aa1701a)** ✅
   - All 3200+ test cases analyzed
   - Expected behaviors documented for every type
   - Edge cases: large unions, circular references, discriminators

**Updated design.md with:**
- Comprehensive Capability Inventory (20 sections)
- Type handlers table (all ReflectionKind)
- Special class handlers (Date, Set, Map, Binary)
- Reference handling (FK, Inline, hydration)
- Embedded types (flattening rules)
- Validation system (21 validators + custom)
- Downstream dependency impacts
- Features At Risk Summary with risk levels

**HIGH Risk Features:**
- Reference hydration tracking (complex lazy-loading)
- Embedded flattening (property name computation)
- Union validation fallthrough (scoring + error tracking)
- Specificality system (10+ levels)

**MEDIUM Risk Features:**
- Class-level validators
- Serialization groups
- Naming strategies
- Integer clamping
- Template literal validation
- Change detection
- Snapshot creation

**Next Steps:**
- Reset type/src directory
- Begin serializer.ts rewrite with complete feature awareness

---

**Investigation Round 2 - Additional Features Discovered**

Spawned 13 more investigation agents (8 + 5) to ensure complete coverage:

**Round 2a (8 agents):**

1. **Error Handling Patterns (ab8a32a)** ✅
   - SerializationError (DK-T200), ValidationError (DK-T300)
   - Path tracking with RuntimeCode for dynamic segments
   - Soft vs hard error modes
   - Error accumulation for validation

2. **Generic Type Handling (ad24258)** ✅
   - Type parameter resolution via program.frame.inputs
   - ReceiveType<T> pattern
   - Generic caching behavior (NOT cached on packed.__type)
   - Nested generics (Set<T>, Map<K,V>)

3. **Binary/Buffer Handling (af477ed)** ✅
   - 10 TypedArray types + ArrayBuffer
   - Base64 encoding/decoding utilities
   - BinaryBigInt, SignedBinaryBigInt
   - Memory management considerations

4. **Union/Intersection Edge Cases (a3b3460)** ✅
   - Score-based discriminator detection (not explicit)
   - UNION_LITERAL_THRESHOLD = 50 for Set optimization
   - Nested union flattening
   - Intersection property merging

5. **Circular Reference Handling (a07e2f2)** ✅
   - JitStack for JIT compilation tracking
   - Runtime state._stack for data serialization
   - findExistingProgram() with 1000-check safety limit
   - createRef() for placeholder resolution

6. **Serialization Context/State (aa31137)** ✅
   - TemplateState: 15+ properties documented
   - fork() method: shared vs cloned state
   - TemplateRegistry caching strategy
   - NamingStrategy ID in cache keys

7. **Tuple Types (a23aaf1)** ✅
   - Fixed, optional, rest, named variants
   - Rest at start/middle/end handling
   - Named tuples in error paths
   - serializeTuple() and typeGuardTuple()

8. **Index Signatures/Mapped Types (a48530b)** ✅
   - String, number, symbol, template literal index types
   - MappedModifier enum for Partial/Required/Readonly
   - Record, Pick, Omit standard library handling
   - Index signature sorting priority

**Round 2b (5 agents):**

9. **Decorator-Based Features (ae8f653)** ✅
   - @entity options (name, collection, disableConstructor, etc.)
   - @t methods (type, validator, serialize, deserialize)
   - All type annotation decorators documented
   - disableConstructor behavior (Object.create vs new)

10. **ReflectionClass API (a74ec7f)** ✅
    - 30+ methods documented
    - ReflectionProperty: 40+ methods
    - Caching levels (prototype, JitContainer)
    - Downstream package usage patterns

11. **Conditional Types/Infer (a39d060)** ✅
    - ReflectionOp: extends, condition, jumpCondition, distribute, infer, widen
    - Distributive vs non-distributive behavior
    - TypeInfer.set() callback mechanism
    - Tuple/template literal infer patterns

12. **Complete Annotation Inventory (aa509c8)** ✅
    - 40+ annotations categorized
    - Database/ORM, serialization control, validation
    - Integer types, BigInt variants
    - AnnotationDefinition infrastructure

13. **JIT Caching Strategies (aa3f4d6)** ✅
    - 4 cache locations documented
    - Cache key patterns (registry.id + namingStrategy.id + path)
    - When caching is disabled (generics, inline, non-reuseCached)
    - V8 toFastProperties() optimization

**Updated design.md with:**
- 13 new capability sections (21-33)
- Updated Features At Risk Summary (25 items)
- Complete annotation inventory
- ReflectionClass API surface
- JIT caching architecture

---

**Investigation Round 3 - Edge Cases & Performance**

Spawned 4 targeted agents for final coverage:

14. **Edge Cases in Type Handling (ac9e806)** ✅
    - Promise<T> unwraps transparently (just serializes T)
    - Static/abstract members explicitly SKIPPED
    - Private/protected serialized same as public
    - ES private fields (#) NOT handled
    - Functions NOT serialized
    - Getters/setters - no special handling
    - WeakMap/WeakSet/WeakRef NOT supported
    - Proxy objects NOT handled

15. **Cross-Package Type Interactions (a1e624a)** ✅
    - **CRITICAL**: BSON/SQL/Mongo directly instantiate TemplateState
    - **CRITICAL**: BSON/SQL/Mongo use TemplateRegistry, Serializer base class
    - Injector uses ReflectionClass, typeAnnotation
    - HTTP uses serializer.deserializeRegistry, getValidatorFunction
    - RPC uses parametersToTuple, serializeType
    - App uses typeAnnotation.getOption for CLI

16. **Template Literal Handling (aae31fb)** ✅
    - CartesianProduct class for union expansion
    - extendTemplateLiteral() matching algorithm
    - UNION_LITERAL_THRESHOLD = 50 for Set optimization
    - 86,400 member unions work (time strings)
    - Template literals as index signatures

17. **Performance-Critical Paths (a327068)** ✅
    - toFastProperties() for V8 hidden class optimization
    - Monomorphic variables: _context.varName pattern
    - JIT function caching on type.jit[id]
    - Loop unrolling for known properties
    - Direct property access generation
    - Buffer pre-sizing for BSON

---

**Pattern Mapping Document Created**

Created `/docs/todo/jit-csp/pattern-mapping.md` with:
- 16 pattern categories: OLD CompilerContext → NEW jit.fn()
- Code examples for each pattern
- New jit.ts primitives needed (new_, let_, object, array, has, map, forEach)
- Performance anti-patterns to avoid
- Testing guidance for conversions

**Final Status:**
- 33 capability sections documented in design.md
- 29 features in risk summary
- Pattern mapping complete for implementation
- Ready for serializer.ts rewrite

---

**Recursion Handling Documentation**

Added comprehensive "Recursion Handling (CRITICAL)" section to design.md:

**Two Types of Recursion:**

1. **Build-time** (type graph traversal):
   - Problem: `User { manager?: User }` creates infinite loop during build
   - Solution: `typeStack: Set<Type>` + `fnCache: Map<Type, Slot<Function>>`
   - O(1) cycle detection via Set.has() vs old O(n) array.includes()

2. **Runtime** (circular data):
   - Problem: `user.friend = user` creates infinite loop during serialization
   - Solution: `state._stack` array tracking visited objects
   - Same pattern as before, cleaner implementation via Slots

**The `build()` Decision Tree:**
1. `typeStack.has(type)`? → Extract (circular in current path)
2. `fnCache.has(type)`? → Reuse (already built)
3. `depth >= maxDepth`? → Extract (size control)
4. Default → Inline

**Key Simplification:**
- Old: `JitStack` with `prepare()` returning setter callback
- New: `ctx.var_()` placeholder + `ctx.setVar()` after building
- jit.fn() closures naturally capture extracted functions

**Updated Files:**
- `design.md`: New "Recursion Handling (CRITICAL)" section after Architecture
- `design.md`: Updated BuildState interface with `fnCache`, `hasCircularReference()`
- `pattern-mapping.md`: Expanded section 14 with both recursion types

---

**Documentation Consolidation**

Consolidated all knowledge into single `design.md` to ensure implementation agent has complete context:

**Merged into design.md:**
- `pattern-mapping.md` (705 lines) → "Pattern Mapping: CompilerContext → jit.fn()" section
- `docs/union-serialization-matrix.md` (715 lines) → "Union Serialization Test Matrix" section

**Deleted standalone files:**
- `docs/todo/jit-csp/pattern-mapping.md`
- `docs/union-serialization-matrix.md`

**Result:** Single 2984-line design.md contains:
1. Overview & Philosophy
2. Use Cases
3. Specificality System
4. Architecture (Slots, Registries, BuildState)
5. Recursion Handling (build-time + runtime)
6. Union Handling (algorithm)
7. **Pattern Mapping** (16 OLD→NEW patterns) ← MERGED
8. File Structure
9. jit.ts Changes Required
10. Handler Examples
11. Implementation Order
12. Public API Preservation
13. Verification
14. Comprehensive Capability Inventory (33 sections)
15. **Union Serialization Test Matrix** (20+ test cases) ← MERGED

**Rationale:** Previous agent failures occurred partly due to incomplete context. Single consolidated file ensures agent cannot miss critical patterns or test cases.

---

### 2026-01-22 (continued)

**New Serializer Module Created**

Created complete `packages/type/src/serializer/` module with jit.fn()-based implementation:

**Files Created:**
| File | Lines | Purpose |
|------|-------|---------|
| `errors.ts` | 71 | SerializationError, RuntimeCode, collapsePath |
| `naming.ts` | 73 | NamingStrategy, underscoreNamingStrategy |
| `registry.ts` | 325 | HandlerRegistry, TypeGuardRegistry, TypeHandler, TypeHook |
| `state.ts` | 449 | BuildState with inline/extract logic, typeStack, fnCache |
| `handlers.ts` | 765 | All type handlers for primitives, objects, arrays, tuples, Date, Set, Map, binary |
| `union.ts` | 237 | Discriminated union (O(1)), literal Set (O(1)), scored resolution (O(n)) |
| `validation.ts` | 107 | Validation post-hook for type guards |
| `serializer.ts` | 307 | Serializer class, buildSerializer, buildDeserializer, buildValidator |
| `index.ts` | 70 | Module exports |

**Key Design Decisions:**
1. **Created new module** instead of modifying old serializer.ts - cleaner separation
2. **BuildStateBase interface** in registry.ts to avoid circular imports
3. **TypeHandler<T>** with BuildStateBase for compile-time type safety
4. **All handlers return Slot** - no void returns, pure expressions
5. **Nested ternary** instead of ctx.cond() for value-returning expressions

**Type Handlers Implemented:**
- Primitives: string, number, boolean, bigint, null, undefined, literal
- Complex: array, tuple, objectLiteral, class, union
- Special: Date, Set, Map, RegExp, binary types (ArrayBuffer, TypedArrays)
- Promise (unwrap), any/unknown (pass-through), void

**Type Guards Implemented:**
- Exact guards (specificality 1): string, number, boolean, null, undefined, array, object, Date
- Loose guards (specificality -0.5 to -0.9): number from string, boolean from "true"/"false"/1/0
- Fallback guards (specificality 50): string accepts anything
- JSON priority (specificality 0.5): ISO date string → Date

**Union Handling:**
- Phase 1: Discriminator detection (O(1)) - property with distinct literals
- Phase 2: Literal set optimization (O(1)) - for 50+ literal members
- Phase 3: Scored resolution (O(n)) - type guard based selection

**Compiles cleanly** - no TypeScript errors in the new module.

**Next Steps:**
1. Rewrite change-detector.ts with jit.fn()
2. Rewrite snapshot.ts with jit.fn()
3. Rewrite path.ts with jit.fn()
4. Integration: Wire new serializer/ module into main exports
5. Run tests and fix issues

---

### 2026-01-24

**Status Check - All Type Package Tests Pass**

Verified current state:
- **51 test suites, 1943 tests pass** in packages/type/
- `change-detector.ts`, `snapshot.ts`, `path.ts` all refactored to use jit (no CompilerContext)
- `failing-tests.md` is outdated (showed 86 failures from Jan 22, now all fixed)

**Remaining Work: Downstream Package Migration**

TypeScript compilation fails for downstream packages that extend the serializer:

```
packages/postgres/src/postgres-serializer.ts - TemplateState API errors
packages/sqlite/src/sqlite-serializer.ts - TemplateState API errors
packages/mysql/src/mysql-serializer.ts - TemplateState API errors
```

These packages use old API methods that no longer exist:
- `TemplateState.accessor`
- `TemplateState.addSetter`
- `TemplateState.setContext`
- `HandlerRegistry.prependClass`
- `TypeHandler` signature changed (void → Slot)

**Next Steps:**
1. **Handler consolidation** - See `handler-consolidation.md` for detailed plan
2. Migrate postgres-serializer.ts to new API
3. Migrate sqlite-serializer.ts to new API
4. Migrate mysql-serializer.ts to new API
5. Run full test suite to verify

---

### Handler Consolidation Summary

**Target: 4,840 → ~1,800 lines (62% reduction)**

| Consolidation | Current | After | Savings |
|---------------|---------|-------|---------|
| Object guards (3→1) | 859 | 200 | 659 |
| Tuple guards (3→1) | 608 | 120 | 488 |
| Object/Class handlers | 1,364 | 600 | 764 |
| Union guards (2→1) | 287 | 120 | 167 |
| Set/Map guards (4→2) | 241 | 80 | 161 |
| Other consolidations | ~1,480 | ~680 | 800 |
| **Total** | **4,840** | **~1,800** | **~3,040** |

See `handler-consolidation.md` for:
- Complete handler inventory with line counts
- Factory patterns for primitive/ID handlers
- Unified handler designs
- Shared helper functions
- Implementation phases
