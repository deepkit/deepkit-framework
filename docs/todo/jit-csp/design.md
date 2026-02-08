# Serializer Rewrite Design Document

## Overview

Rewrite `@deepkit/type` serialization using `jit.fn()` from `@deepkit/core` instead of `CompilerContext`. This enables CSP compliance while maintaining performance.

**CRITICAL RULE:** Never use `CompilerContext`. If `jit.fn()` seems insufficient, extend `@deepkit/core/src/jit.ts` with new primitives.

### Philosophy: Clean Break, No Migration

This is a **complete rewrite**, not a migration:

- **No legacy code** - Don't preserve old patterns or maintain backward compatibility within `@deepkit/type`
- **No migration path** - The old serializer will be replaced entirely, not wrapped or gradually deprecated
- **Downstream packages will break** - `@deepkit/bson`, `@deepkit/sql`, `@deepkit/mongo`, etc. depend on `@deepkit/type` internals. They WILL break. That's OK.
- **Fix downstream later** - First make `@deepkit/type` perfect, then update dependent packages to the new API

**However:** The use cases of downstream packages (BSON binary serialization, SQL type mapping, etc.) must inform the API design. We're not ignoring their needs - we're building the right abstractions first, then adapting them.

### Before/After Example

```typescript
// ❌ OLD (CompilerContext) - This is what exists in packages/type/src/serializer.ts
const compiler = new CompilerContext();
compiler.context.set('isString', (v: any) => typeof v === 'string');
compiler.context.set('ValidationError', ValidationError);
const code = `
    if (!isString(data)) throw new ValidationError('Expected string');
    return data;
`;
return compiler.build(code, 'data');

// ✅ NEW (jit.fn()) - Rewrite to this
return jit.fn(jit.arg<any>(), (ctx, data) => {
    ctx.when(ctx.not(ctx.isType(data, 'string')), () => {
        ctx.call(throwValidationError, ctx.lit('Expected string'));
    });
    return data;
});
```

```typescript
// ❌ OLD - Tracking state with template strings
let code = 'var hasChanges = false;\n';
for (const prop of props) {
    code += `if (old.${prop} !== new.${prop}) hasChanges = true;\n`;
}
code += 'return hasChanges;';
return compiler.build(code, 'old', 'new');

// ✅ NEW - Using var_/setVar/getVar
return jit.fn(jit.arg<any>(), jit.arg<any>(), (ctx, oldObj, newObj) => {
    const hasChanges = ctx.var_(false);
    for (const prop of props) {
        ctx.when(ctx.neq(oldObj.get(prop), newObj.get(prop)), () => {
            ctx.setVar(hasChanges, ctx.lit(true));
        });
    }
    return ctx.getVar(hasChanges);
});
```

**Key insight**: The old code accumulates template strings. The new code calls ctx methods that either generate code (JIT mode) or execute directly (Exec mode).

---

## Use Cases That Must Be Supported

### 1. HTTP Request Parsing
- Query strings: `?limit=123&active=true` → all values are strings
- URL params: `/user/123` → string "123" must become number
- Form data: multipart fields are strings
- Requires `loosely: true` for string-to-type coercion

### 2. CLI Argument Parsing
- All arguments are strings from shell
- `--count 5` → "5" must become number 5
- `--verbose` → flag becomes boolean true
- Uses default loosely mode

### 3. JSON Serialization/Deserialization
- Standard JSON types
- Date as ISO string ↔ Date object
- Binary as base64 string ↔ ArrayBuffer/TypedArray

### 4. BSON Binary Serialization
- Completely separate from JSON
- Needs multiple registries: sizer, serialize, deserialize
- Own type guards checking BSON type markers
- Supports ObjectId, Binary, 64-bit integers

### 5. Validation
- `is()` uses strict mode (specificality = 1 only)
- `validate()` collects errors with paths
- Validation annotations: `MinLength`, `Pattern`, `Positive`, etc.
- Custom validators via `Validate<typeof fn>`

---

## Specificality System (CRITICAL)

Type guards are organized by "specificality" levels that determine when they activate:

| Level | Name | Purpose | Example |
|-------|------|---------|---------|
| -0.9 | Very Loose | Boolean from strings | `"true"` → `true`, `"1"` → `true` |
| -0.5 | Loose | Numeric strings | `"123"` → `123` (number/bigint) |
| 0.5 | JSON Priority | ISO date over string | `"2021-01-01"` → Date (not string) |
| 1 | Exact | JS typeof/instanceof | `typeof v === 'number'` |
| 1.5 | Fallback | Timestamp to Date | `1637781902866` → Date |
| 2 | Late Fallback | null↔undefined, RegExp | `"/pattern/"` → RegExp |
| 10 | Very Late | Binary from base64 | base64 string → Uint8Array |
| 20 | Last Resort | `any` in unions | Matches anything |
| 50 | Ultimate | String accepts all | Everything can be string |

**Activation Rules:**
- `specificality < 0`: Only when `options.loosely !== false`
- `specificality === 1`: Used by `is()` with `validation: 'strict'`
- `specificality < 1`: Skipped during serialization
- All levels used during deserialization

**Union Resolution:**
1. Guards sorted by specificality (lowest first)
2. Try each guard until one matches
3. Higher specificity = more specific match wins

**Example: `number | string` with input `"123"`**
- Loose mode ON: specificality -0.5 matches → number `123`
- Loose mode OFF: specificality 1 matches string → string `"123"`

---

## Architecture

### Slots as Expression Trees

**Key insight:** Slots are not values - they are expression trees. When a handler returns a Slot, it's returning an expression that will be inlined into the generated code.

```typescript
// Handler for string type guard - returns expression tree
function stringGuard(type: TypeString, input: Slot, ctx: Context, state: BuildState): Slot<boolean> {
    return ctx.isType(input, 'string');  // Returns Slot representing: typeof input === 'string'
}

// Handler for number guard with loose mode
function numberLooseGuard(type: TypeNumber, input: Slot, ctx: Context, state: BuildState): Slot<boolean> {
    return ctx.and(
        ctx.isType(input, 'string'),
        ctx.call(isNumeric, input)  // isNumeric is external fn, but guard EXPRESSION is inlined
    );
}

// In union handling - guards are EXPRESSIONS, not function calls
for (const member of type.types) {
    // guardExpr is a Slot (expression tree), NOT a function
    const guardExpr = getGuardHandler(member)(member, input, ctx, state);

    // Using the Slot inlines the expression
    ctx.when(guardExpr, () => {
        ctx.setVar(result, state.build(member, input));
    });
}
```

Generated code - all expressions inlined:
```javascript
// No guard function calls - pure expressions
if (typeof s0 === 'string') {
    result = s0;
}
if (typeof s0 === 'number') {
    result = s0;
}
if (typeof s0 === 'string' && isNumeric_0(s0)) {  // Only helper fn called
    result = Number_0(s0);
}
```

The only function calls in generated code are to helper functions that MUST be called (like `isNumeric`, `Number` constructor, etc.), not to guard/handler wrappers.

### Inlining Strategy

**Inline by default** - nested types are embedded in one function:

```typescript
// GOOD: One function, types inlined
jit.fn(jit.arg<User>(), (ctx, input) => {
    const result = ctx.obj();
    // name: string - inline
    ctx.set(result, 'name', serializeString(input.get('name'), ctx));
    // address: Address - inline (depth 1)
    const addr = ctx.obj();
    ctx.set(addr, 'street', serializeString(input.get('address').get('street'), ctx));
    ctx.set(result, 'address', addr);
    return result;
});

// BAD: Separate functions (call overhead)
const addressFn = jit.fn(...);
const userFn = jit.fn((ctx, input) => {
    ctx.set(result, 'address', ctx.call(addressFn, ...)); // SLOW
});
```

**Extract to separate function ONLY when:**
1. Circular reference detected (Type A → Type B → Type A)
2. Depth exceeds limit (default: 3 levels)

### Core Types

```typescript
// Type handler signature
type TypeHandler<T extends Type = Type> = (
    type: T,
    input: Slot,
    ctx: Context,
    state: BuildState
) => Slot;

// Hook for wrapping handlers (validators use post-hook)
type TypeHook = (
    type: Type,
    input: Slot,
    ctx: Context,
    state: BuildState,
    next: () => Slot
) => Slot;
```

### HandlerRegistry

```typescript
class HandlerRegistry {
    private kindHandlers = new Map<ReflectionKind, TypeHandler[]>();
    private classHandlers = new Map<ClassType, TypeHandler[]>();
    private annotationHandlers: Array<{
        predicate: (type: Type) => boolean;
        handler: TypeHandler;
    }> = [];
    private preHooks: TypeHook[] = [];
    private postHooks: TypeHook[] = [];

    // Registration by kind
    register(kind: ReflectionKind, handler: TypeHandler): this;
    prepend(kind: ReflectionKind, handler: TypeHandler): this;
    append(kind: ReflectionKind, handler: TypeHandler): this;

    // Registration by class (Date, Set, Map, Uint8Array, etc.)
    registerClass(classType: ClassType, handler: TypeHandler): this;
    registerBinary(handler: TypeHandler): this;

    // Registration by annotation (UUID, Reference, Embedded, etc.)
    addDecorator(predicate: (type: Type) => boolean, handler: TypeHandler): this;

    // Hooks for wrapping
    addPreHook(hook: TypeHook): this;
    addPostHook(hook: TypeHook): this;

    // Execute handlers for type
    build(type: Type, input: Slot, ctx: Context, state: BuildState): Slot;
}
```

### TypeGuardRegistry

```typescript
class TypeGuardRegistry {
    private levels = new Map<number, HandlerRegistry>();

    // Get or create registry for specificality level
    getRegistry(specificality: number): HandlerRegistry;

    // Convenience registration
    register(specificality: number, kind: ReflectionKind, handler: TypeHandler): this;
    registerClass(specificality: number, classType: ClassType, handler: TypeHandler): this;
    registerBinary(specificality: number, handler: TypeHandler): this;

    // Returns levels sorted by specificality (lowest first)
    getSortedLevels(): Array<[number, HandlerRegistry]>;
}
```

### BuildState

```typescript
interface BuildState {
    readonly direction: 'serialize' | 'deserialize' | 'validate';
    readonly serializer: Serializer;
    readonly ctx: Context;
    readonly options: Slot<SerializationOptions>;

    // Validation mode
    readonly validation: 'strict' | 'loose' | undefined;

    // Inlining control (see "Recursion Handling" section)
    readonly depth: number;
    readonly maxDepth: number;  // default 3
    readonly typeStack: Set<Type>;  // build-time circular detection
    readonly fnCache: Map<Type, Slot<Function>>;  // extracted functions

    // Path tracking for errors
    readonly pathSegments: (string | Slot<string>)[];
    pathSlot(): Slot<string>;

    // Build nested type (decides inline vs extract)
    build(type: Type, input: Slot): Slot;

    // Fork for nesting
    forProperty(name: string): BuildState;
    forIndex(index: Slot<number>): BuildState;

    // Helpers
    isLoose(): Slot<boolean>;      // options.loosely !== false
    isStrictValidation(): boolean; // validation === 'strict'
    hasCircularReference(): boolean;  // type can have circular data

    // Error handling
    throw_(type: Type, value: Slot, message?: string): void;
    addValidationError(code: string, message: string, value: Slot): void;

    // External values
    extern<T>(value: T): Slot<T>;
}
```

### Serializer Class

```typescript
class Serializer {
    readonly name: string;

    // Standard registries
    readonly serializeRegistry = new HandlerRegistry();
    readonly deserializeRegistry = new HandlerRegistry();
    readonly typeGuards = new TypeGuardRegistry();

    // Named registries for extensions (BSON needs: sizer, bsonSerialize, bsonDeserialize)
    readonly namedRegistries = new Map<string, HandlerRegistry>();

    constructor(name: string = 'json') {
        this.name = name;
        this.registerDefaults();
    }

    // Build JIT functions
    buildSerializer<T>(type: Type): (data: T, options?: SerializationOptions) => any;
    buildDeserializer<T>(type: Type): (data: any, options?: SerializationOptions) => T;
    buildValidator<T>(type: Type): (data: any, errors?: ValidationErrorItem[]) => boolean;

    // Extension points
    createRegistry(name: string): HandlerRegistry;
    getRegistry(name: string): HandlerRegistry | undefined;

    // Override in subclasses
    protected registerDefaults(): void;

    // Control behavior
    setExplicitUndefined(type: Type, state: BuildState): boolean;
}

export const serializer = new Serializer('json');
```

---

## Recursion Handling (CRITICAL)

There are **two distinct types of recursion** that must be handled:

### 1. Build-Time Recursion (Type Graph Traversal)

When building a serializer, we traverse the type graph. Self-referential types create cycles:

```typescript
interface User {
    name: string;
    manager?: User;  // Self-reference creates cycle
}

interface A { b: B; }
interface B { a: A; }  // Mutual recursion
```

Without tracking, building `User` would loop forever:
`User → manager: User → manager: User → ...`

**Solution: `typeStack` + `fnCache`**

```typescript
// In BuildState
readonly typeStack: Set<Type>;  // Types currently being built in THIS path
readonly fnCache: Map<Type, Slot<Function>>;  // Already-built extracted functions
```

### 2. Runtime Recursion (Circular Data)

Even with non-recursive types, actual data can be circular:

```typescript
const user = { name: "Alice", friend: null as any };
user.friend = user;  // Circular data!

// Without runtime tracking:
// serialize(user) → serialize(friend) → serialize(user) → ... infinite loop
```

**Solution: `state._stack` at runtime**

Types that CAN have circular data (detected via `hasCircularReference(type)`) get wrapped with runtime stack tracking.

---

### The `build()` Decision Tree

The `build()` method decides whether to inline a type or extract to a separate function:

```typescript
build(type: Type, input: Slot): Slot {
    // 1. CIRCULAR: Already building this type in current path?
    if (this.typeStack.has(type)) {
        // Must extract - emit function call, not inline
        return this.buildExtractedCall(type, input);
    }

    // 2. CACHED: Already built and extracted this type?
    const cached = this.fnCache.get(type);
    if (cached) {
        return this.ctx.call(this.ctx.getVar(cached), input, this.stateSlot, this.pathSlot());
    }

    // 3. DEPTH: Too deep? Extract to keep function size manageable
    if (this.depth >= this.maxDepth && isComplexType(type)) {
        return this.buildExtractedCall(type, input);
    }

    // 4. INLINE: Default - embed type handling directly
    this.typeStack.add(type);
    const result = this.buildInline(type, input);
    this.typeStack.delete(type);
    return result;
}

function isComplexType(type: Type): boolean {
    return type.kind === ReflectionKind.objectLiteral ||
           type.kind === ReflectionKind.class ||
           type.kind === ReflectionKind.array ||
           type.kind === ReflectionKind.tuple;
}
```

### Extracted Function Pattern

When extraction is needed, we create a separate `jit.fn()`:

```typescript
buildExtractedCall(type: Type, input: Slot): Slot {
    // Check if already being prepared (handles mutual recursion)
    let fnSlot = this.fnCache.get(type);

    if (!fnSlot) {
        // Create placeholder slot - will be filled after function is built
        fnSlot = this.ctx.var_<Function>(undefined as any);
        this.fnCache.set(type, fnSlot);

        // Build the extracted function with fresh state
        const extractedFn = jit.fn(
            jit.arg<any>(),      // data
            jit.arg<any>(),      // state (for runtime _stack)
            jit.arg<string>(),   // path (for error messages)
            (ctx, data, state, path) => {
                const childState = this.forkForExtracted(ctx, state, path);
                return childState.buildInline(type, data);
            }
        );

        // Fill the placeholder with the built function
        this.ctx.setVar(fnSlot, this.ctx.lit(extractedFn));
    }

    // Emit call to the extracted function
    return this.ctx.call(this.ctx.getVar(fnSlot), input, this.stateSlot, this.pathSlot());
}
```

**Key insight:** jit.fn() closures naturally capture the extracted functions, eliminating the complex `JitStack` prepare/setFunction dance from CompilerContext.

### Runtime Circular Data Check

For types where `hasCircularReference(type)` returns true, wrap with stack tracking:

```typescript
function wrapWithCircularCheck(
    buildInner: (ctx: Context, data: Slot, state: Slot) => Slot
): (ctx: Context, data: Slot, state: Slot) => Slot {
    return (ctx, data, state) => {
        const stack = state.get('_stack');

        return ctx.cond([
            // Null/undefined - no circular check needed
            [ctx.isNullish(data), () => buildInner(ctx, data, state)],

            // Already in stack - break the cycle
            [ctx.call(arrayIncludes, stack, data), () => ctx.lit(undefined)],
        ], () => {
            // Push, serialize, pop
            ctx.call(arrayPush, stack, data);
            const result = buildInner(ctx, data, state);
            ctx.call(arrayPop, stack);
            return result;
        });
    };
}

// Usage in buildSerializer:
if (hasCircularReference(type)) {
    return jit.fn(jit.arg<any>(), jit.arg<any>(), (ctx, data, state) => {
        // Initialize stack if needed
        ctx.when(ctx.not(state.get('_stack')), () => {
            ctx.set(state, '_stack', ctx.lit([]));
        });
        return wrapWithCircularCheck(serializeInner)(ctx, data, state);
    });
}
```

### Visual Summary

```
User { name: string, manager?: User }
        │
        ▼
┌─────────────────────────────────────────────┐
│  BUILD TIME (type graph traversal)          │
│                                             │
│  buildSerializer(User)                      │
│    ├─ typeStack.add(User)                   │
│    ├─ inline: name (string) ✓               │
│    ├─ build(User) for manager property      │
│    │   └─ typeStack.has(User)? → YES!       │
│    │   └─ EXTRACT to separate function      │
│    │   └─ fnCache.set(User, fnSlot)         │
│    │   └─ emit: call(fnSlot, input, ...)    │
│    └─ typeStack.delete(User)                │
│                                             │
│  Result: Main fn + extracted fn for User    │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  RUNTIME (circular data handling)           │
│                                             │
│  data = { name: "A", manager: <self> }      │
│                                             │
│  serialize(data, state)                     │
│    ├─ state._stack = []                     │
│    ├─ state._stack.push(data)  → [data]     │
│    ├─ serialize name → "A"                  │
│    ├─ serialize manager (calls extracted)   │
│    │   └─ state._stack.includes(data)?      │
│    │   └─ YES → return undefined            │
│    └─ state._stack.pop()  → []              │
│                                             │
│  Result: { name: "A", manager: undefined }  │
└─────────────────────────────────────────────┘
```

### Differences from CompilerContext Approach

| Aspect | Old (CompilerContext) | New (jit.fn()) |
|--------|----------------------|----------------|
| Build-time tracking | `parentTypes: Type[]` array | `typeStack: Set<Type>` (O(1) lookup) |
| Function registry | `JitStack` with prepare/setFunction | `fnCache: Map<Type, Slot>` |
| Circular detection | `parentTypes.includes()` O(n) | `typeStack.has()` O(1) |
| Function reference | String interpolation in code | `ctx.call(fnSlot, ...)` |
| Placeholder pattern | `jitStack.prepare()` returns setter callback | `ctx.var_()` + `ctx.setVar()` |
| Runtime stack | `state._stack` array | Same pattern, cleaner via Slots |

### Edge Cases

**Embedded types are NEVER extracted:**
```typescript
class Price { amount: number; currency: string; }
class Product {
    price: Embedded<Price>;  // Must inline, not extract
}
```
Embedded properties flatten into parent object, so extraction would break the flattening logic.

**Depth limit applies to complex types only:**
- Primitives (string, number, boolean) are always inlined
- Objects, arrays, tuples, classes trigger depth check
- Default `maxDepth: 3` keeps functions reasonably sized

**Mutual recursion handled by fnCache:**
```typescript
interface A { b?: B; }
interface B { a?: A; }

// Building A:
//   typeStack.add(A)
//   build B for property 'b'
//     typeStack.add(B)
//     build A for property 'a'
//       typeStack.has(A)? YES → extract A, fnCache.set(A, fnSlot)
//     typeStack.delete(B)
//   typeStack.delete(A)
//
// Result: A inlines B, B calls extracted A
```

---

## Union Handling (CRITICAL)

Union resolution is the most complex part of the serializer. It must:
1. Pick the correct union member based on input structure and specificality
2. Apply the correct validation annotations for that member
3. Handle coercion fallthrough (if validation fails, try next member)
4. Report errors from the best-matching member

**See also:** `docs/union-serialization-matrix.md` for comprehensive test cases.

### Resolution Priority Order

1. **Discriminated Union (O(1))** - Property with distinct literal values per member
2. **Literal Union (O(1))** - All members are literals, use Set.has()
3. **Scored Union (O(n))** - Multi-factor scoring with validation fallthrough

### Context-Specific Specificality Ranges

| Context | Min Spec | Max Spec | Notes |
|---------|----------|----------|-------|
| HTTP Query/Path | -0.9 | 50 | Full loose mode (all strings) |
| HTTP JSON Body | -0.5 | 50 | Slightly less loose |
| CLI Args | -0.9 | 50 | Full loose mode (all strings) |
| JSON Deserialize | configurable | configurable | Default: -0.5 to 50 |
| SQL/BSON | 1 | 1 | Strict only |
| Validation (`is()`) | 1 | 1 | Strict only |
| Serialize | 1 | 50 | No loose, yes fallback |

### Type Guard Return Type: Numeric Score

Type guards return `Slot<number>` (score), not `Slot<boolean>`:
- `0` = no match
- `> 0` = match, value indicates quality

```typescript
// Type guard handler signature - returns SCORE
type TypeGuardHandler<T extends Type = Type> = (
    type: T,
    input: Slot,
    ctx: Context,
    state: BuildState
) => Slot<number>;  // 0 = no match, >0 = match score
```

### Scoring Formula

For primitives:
```
score = matches ? (1000 + normalizedSpec) : 0
where normalizedSpec = 10 × (1 - specificality/51)
```

For objects:
```
score = (coverage × 1000) + (normalizedSpec × 10) - (extraFields × 5)
where:
  coverage = matchedFields / requiredFields  (0 to 1)
  normalizedSpec = 1 - (avgSpecificality / 51)
  extraFields = count of fields in input not in type schema
```

**Why these weights:**
- **×1000 for coverage**: Types that handle more data always win
- **×10 for specificality**: Tiebreaker - exact matches beat coercions
- **-5 for extra fields**: Prefer types that "fit" the data exactly

### Object Scoring Tie-Breaking

When two objects have equal scores:
1. **Prefer exact structural match** - fewer optional fields wins
2. **Prefer higher worst specificality** - less coercion wins
3. **Fall back to declaration order** - first in union wins

### Validation-Aware Resolution (CRITICAL)

**Every deserialization must pick the correct member to get correct validation annotations.**

```typescript
// Example: (string & MinLength<3>) | (number & Positive)
// Input: "5" with loose mode

// Step 1: Try number (specificality -0.5 for numeric string)
//   - Coerces "5" to 5
//   - Runs Positive validator → PASS
//   - RETURN number

// Input: "-5" with loose mode
// Step 1: Try number (specificality -0.5)
//   - Coerces "-5" to -5
//   - Runs Positive validator → FAIL
// Step 2: Try string (specificality 1)
//   - "-5" is already string → matches
//   - Runs MinLength<3> validator → FAIL (length 2)
// Step 3: No more members
//   - FAIL with Positive error (best structural match was number)
```

### Complete Union Resolution Algorithm

```typescript
function resolveUnion(
    type: TypeUnion,
    input: Slot,
    ctx: Context,
    state: BuildState
): Slot {
    // === PHASE 1: Discriminator Detection (O(1)) ===
    const disc = detectDiscriminator(type);
    if (disc) {
        return buildDiscriminatedUnion(type, disc, input, ctx, state);
    }

    // === PHASE 2: Literal Set Optimization (O(1)) ===
    if (isAllLiterals(type) && type.types.length >= 50) {
        return buildLiteralSetUnion(type, input, ctx, state);
    }

    // === PHASE 3: Scored Resolution with Validation ===
    const result = ctx.var_<any>(undefined);
    const bestScore = ctx.var_(-1);
    const matched = ctx.var_(false);
    const bestErrors = ctx.var_<ValidationError[]>([]);

    // Separate primitives from objects
    const primitives = type.types.filter(isPrimitive);
    const objects = type.types.filter(isObjectLike);

    // Get specificality range for current context
    const [minSpec, maxSpec] = state.getSpecificalityRange();

    // 3a: Score primitives
    for (const [spec, registry] of state.serializer.typeGuards.getSortedLevels()) {
        if (spec < minSpec || spec > maxSpec) continue;

        for (const member of primitives) {
            const guardScore = registry.buildGuard(member, input, ctx, state);

            ctx.when(ctx.and(
                ctx.not(ctx.getVar(matched)),
                ctx.gt(guardScore, ctx.lit(0))
            ), () => {
                // Coerce if needed
                const coerced = state.buildCoercion(member, input, spec);

                // Run validation for THIS member
                const errors = ctx.var_<ValidationError[]>([]);
                const valid = state.buildValidation(member, coerced, errors);

                ctx.when(valid, () => {
                    // SUCCESS: validation passed
                    ctx.setVar(result, state.buildSerializer(member, coerced));
                    ctx.setVar(matched, ctx.lit(true));
                }, () => {
                    // FAIL: track errors if best match so far
                    const memberScore = ctx.add(ctx.lit(1000),
                        ctx.mul(ctx.lit(10), ctx.sub(ctx.lit(1), ctx.div(ctx.lit(spec), ctx.lit(51)))));
                    ctx.when(ctx.gt(memberScore, ctx.getVar(bestScore)), () => {
                        ctx.setVar(bestScore, memberScore);
                        ctx.setVar(bestErrors, ctx.getVar(errors));
                    });
                });
            });
        }
    }

    // 3b: Score objects (only if no primitive matched)
    ctx.when(ctx.not(ctx.getVar(matched)), () => {
        for (const member of objects) {
            const objResult = scoreAndValidateObject(member, input, ctx, state);

            ctx.when(ctx.gt(objResult.score, ctx.getVar(bestScore)), () => {
                ctx.when(objResult.valid, () => {
                    // SUCCESS
                    ctx.setVar(result, objResult.value);
                    ctx.setVar(matched, ctx.lit(true));
                }, () => {
                    // Track as best error candidate
                    ctx.setVar(bestScore, objResult.score);
                    ctx.setVar(bestErrors, objResult.errors);
                });
            });
        }
    });

    // === PHASE 4: Error Handling ===
    ctx.when(ctx.not(ctx.getVar(matched)), () => {
        // Report best match's errors
        ctx.when(ctx.gt(ctx.len(ctx.getVar(bestErrors)), ctx.lit(0)), () => {
            state.reportErrors(ctx.getVar(bestErrors));
        }, () => {
            state.throw_(type, input, 'No union member matches');
        });
    });

    return ctx.getVar(result);
}
```

### Object Scoring Implementation

```typescript
function scoreAndValidateObject(
    member: TypeObjectLiteral | TypeClass,
    input: Slot,
    ctx: Context,
    state: BuildState
): { score: Slot<number>; valid: Slot<boolean>; value: Slot; errors: Slot<ValidationError[]> } {
    const score = ctx.var_(0);
    const valid = ctx.var_(true);
    const errors = ctx.var_<ValidationError[]>([]);
    const totalSpec = ctx.var_(0);
    const matchCount = ctx.var_(0);
    const result = ctx.obj();

    // Must be object and not null
    ctx.when(ctx.or(ctx.not(ctx.isType(input, 'object')), ctx.isNull(input)), () => {
        ctx.setVar(valid, ctx.lit(false));
    });

    ctx.when(ctx.getVar(valid), () => {
        const properties = resolveTypeMembers(member);

        for (const prop of properties) {
            const name = memberNameToString(prop.name);
            const isOptional = isOptionalMember(prop);
            const propValue = input.get(name);

            ctx.when(ctx.has(input, name), () => {
                // Property exists - check type and validate
                const propResult = matchPropertyWithValidation(
                    propValue, prop.type, ctx, state.forProperty(name)
                );

                ctx.when(ctx.gt(propResult.score, ctx.lit(0)), () => {
                    ctx.when(propResult.valid, () => {
                        // Property matched and validated
                        ctx.setVar(matchCount, ctx.add(ctx.getVar(matchCount), ctx.lit(1)));
                        ctx.setVar(totalSpec, ctx.add(ctx.getVar(totalSpec), propResult.specificality));
                        ctx.set(result, name, propResult.value);
                    }, () => {
                        // Property matched but validation failed
                        ctx.setVar(valid, ctx.lit(false));
                        ctx.setVar(errors, ctx.call(concat, ctx.getVar(errors), propResult.errors));
                    });
                }, () => {
                    // Property type doesn't match
                    ctx.setVar(valid, ctx.lit(false));
                });
            }, () => {
                // Property missing
                ctx.when(ctx.not(ctx.lit(isOptional)), () => {
                    ctx.setVar(valid, ctx.lit(false));
                    ctx.push(ctx.getVar(errors), ctx.call(createValidationError,
                        ctx.lit('required'), ctx.lit(`Missing required property: ${name}`)));
                });
            });
        }

        // Count extra fields
        const typeKeys = new Set(properties.map(p => memberNameToString(p.name)));
        ctx.forIn(input, (key, _) => {
            ctx.when(ctx.not(ctx.call(typeKeys.has.bind(typeKeys), key)), () => {
                // Extra field - subtract from score
                ctx.setVar(score, ctx.sub(ctx.getVar(score), ctx.lit(5)));
            });
        });

        // Calculate final score
        const coverage = ctx.div(ctx.getVar(matchCount), ctx.lit(Math.max(properties.length, 1)));
        const avgSpec = ctx.div(ctx.getVar(totalSpec), ctx.max(ctx.getVar(matchCount), ctx.lit(1)));
        const normalizedSpec = ctx.sub(ctx.lit(1), ctx.div(avgSpec, ctx.lit(51)));
        ctx.setVar(score, ctx.add(
            ctx.mul(coverage, ctx.lit(1000)),
            ctx.add(ctx.mul(normalizedSpec, ctx.lit(10)), ctx.getVar(score))
        ));
    });

    return {
        score: ctx.getVar(score),
        valid: ctx.getVar(valid),
        value: result,
        errors: ctx.getVar(errors)
    };
}
```

### Discriminated Union Detection

```typescript
function detectDiscriminator(type: TypeUnion): DiscriminatorInfo | undefined {
    // Find property where all members have distinct literal values
    const candidates = new Map<string, Map<any, Type>>();

    for (const member of type.types) {
        if (member.kind !== ReflectionKind.objectLiteral &&
            member.kind !== ReflectionKind.class) continue;

        for (const prop of resolveTypeMembers(member)) {
            if (prop.type.kind !== ReflectionKind.literal) continue;
            const name = String(prop.name);
            if (!candidates.has(name)) candidates.set(name, new Map());
            candidates.get(name)!.set(prop.type.literal, member);
        }
    }

    // Find discriminator with unique value per member
    for (const [prop, valueMap] of candidates) {
        if (valueMap.size === type.types.length) {
            return { property: prop, valueToMember: valueMap };
        }
    }
    return undefined;
}
```

### Discriminated Union Build

```typescript
function buildDiscriminatedUnion(
    type: TypeUnion,
    disc: DiscriminatorInfo,
    input: Slot,
    ctx: Context,
    state: BuildState
): Slot {
    const discValue = input.get(disc.property);
    const result = ctx.var_<any>(undefined);
    const matched = ctx.var_(false);

    const cases: Array<[any, () => void]> = [];
    for (const [literal, memberType] of disc.valueToMember) {
        cases.push([literal, () => {
            // Still need to validate and deserialize the full object
            const memberResult = state.build(memberType, input);
            ctx.setVar(result, memberResult);
            ctx.setVar(matched, ctx.lit(true));
        }]);
    }

    ctx.switch_(discValue, cases, () => {
        state.throw_(type, input, `Unknown discriminator value for '${disc.property}'`);
    });

    return ctx.getVar(result);
}
```

---

## File Structure

```
packages/type/src/
├── serializer/
│   ├── serializer.ts         # Serializer class, public API
│   ├── registry.ts           # HandlerRegistry, TypeGuardRegistry
│   ├── state.ts              # BuildState implementation
│   ├── builder.ts            # jit.fn() integration, function building
│   ├── handlers.ts           # All type handlers (primitives, objects, etc.)
│   ├── union.ts              # Union handling (discriminated, literal, scored)
│   ├── validation.ts         # Validator hook, ValidationErrorItem
│   ├── naming.ts             # NamingStrategy
│   └── errors.ts             # SerializationError
├── change-detector.ts        # REWRITE with jit.fn()
├── snapshot.ts               # REWRITE with jit.fn()
├── path.ts                   # REWRITE with jit.fn()
└── ...
```

**Note:** No `index.ts` files. Imports use explicit paths like `import { Serializer } from './serializer/serializer.js'`.

---

## jit.ts Changes Required

### 1. Named Variables Instead of Array Indices (CRITICAL)

Current jit.ts uses array indices for external values:
```typescript
// Current (BAD - poor debuggability, unclear code)
const extIdx = this.externs.push(fn) - 1;
this.code += `e[${extIdx}](${args})`;
// Generates: e[0](s1), e[1](s2), etc.
```

Must change to named parameters like CompilerContext:
```typescript
// New (GOOD - readable, debuggable)
const name = this.reserveName('Date');
this.externs.set(name, fn);
this.code += `${name}(${args})`;
// Generates: Date_0(s1), isNumeric_0(s2), etc.

// compile() becomes:
new Function(...this.externs.keys(), code)(...this.externs.values());
```

For undefined initial values (monomorphic optimization):
```typescript
// Use _context.varName pattern like CompilerContext
reserveVariable(name: string, value?: any): string {
    const freeName = this.reserveName(name);
    if (value === undefined) {
        return '_context.' + freeName;  // Monomorphic reference
    } else {
        this.externs.set(freeName, value);
        return freeName;
    }
}
```

### 2. Slots as Expression Trees

Slots represent expressions, not values. When we compose Slots, we build an expression tree that gets inlined:

```typescript
// Type guard returns expression tree (Slot), not a function
const isString = ctx.isType(input, 'string');  // Slot: typeof s0 === 'string'
const isNumber = ctx.isType(input, 'number');  // Slot: typeof s0 === 'number'

// Compose expressions - all inlined, no function calls
ctx.when(ctx.or(isString, isNumber), () => {
    // ...
});

// Generated code - pure expressions:
if (typeof s0 === 'string' || typeof s0 === 'number') {
    // ...
}
```

### 3. New Primitives Needed

| Primitive | Purpose | JIT Output |
|-----------|---------|------------|
| `ctx.throw_(error: Slot)` | Throw exception | `throw ${expr};` |
| `ctx.forIn(obj, (key, value) => void)` | Object iteration | `for(var k in obj){...}` |
| `ctx.instanceof_(value, ctor)` | instanceof check | `${value} instanceof ${ctor}` |

### 4. Tiered Execution (IMPLEMENTED)

**Problem:** JIT compilation has overhead. For code that runs only a few times, compilation cost exceeds execution savings.

**Solution:** Multi-level execution strategy, **transparent to callers**:

```
Call 1-N:   Exec mode (interpret directly, no compilation)
Call N+1:   JIT compile (one-time cost)
Call N+2+:  JIT mode (optimized execution)
```

**API:** Unchanged. Callers use `jit.fn()` exactly as before:

```typescript
// Same API - tiered execution is transparent
const fn = jit.fn(jit.arg<User>(), (ctx, input) => { ... });
```

**Internal implementation (in jit.ts):**

```typescript
fn<R>(...args: any[]): (...args: any[]) => R {
    const body = args.pop();
    const argCount = args.length;

    if (!canJIT) {
        // CSP environment - always Exec mode
        return createExecFn(body, argCount);
    }

    // Tiered execution (transparent to caller)
    const threshold = 10;  // Internal default
    let callCount = 0;
    let compiledFn: Function | null = null;

    return ((...runtimeArgs: any[]) => {
        if (compiledFn) {
            return compiledFn(...runtimeArgs);
        }

        callCount++;
        if (callCount >= threshold) {
            // Upgrade to JIT
            compiledFn = compileJIT(body, argCount);
            return compiledFn(...runtimeArgs);
        }

        // Exec mode
        return execDirect(body, argCount, runtimeArgs);
    }) as any;
}
```

**Benefits:**
- Fast bootstrap (no compilation during startup)
- Hot paths still get JIT optimization
- Cold paths avoid compilation overhead entirely
- **Zero changes to @deepkit/type or other consumers**

**Trade-offs:**
- Slight overhead for call counting (negligible)
- First JIT call has compilation latency
- Memory for keeping body reference until compiled

**Resolved:**
- Default threshold: 10 (configurable via `setJitThreshold()`)
- `jit.fnJIT()` bypasses tiering (for testing only - throws in CSP environments)
- `jit.fnExec()` always uses Exec mode (for testing/debugging)

---

## Pattern Mapping: CompilerContext → jit.fn()

**CRITICAL:** This section shows how every CompilerContext pattern must be converted. Never use CompilerContext. If a pattern doesn't fit jit.fn(), extend jit.ts with new primitives.

### 1. Basic Code Generation

**Variable Declaration:**
```typescript
// ❌ OLD (CompilerContext)
const compiler = new CompilerContext();
const varName = compiler.reserveVariable('count', 0);
const code = `let result = ${varName};`;

// ✅ NEW (jit.fn()) - slots ARE variables
return jit.fn((ctx) => {
    const count = ctx.lit(0);  // count is a slot, use it directly
    return count;              // no separate "result" declaration needed
});
```

**Context Variables:**
```typescript
// ❌ OLD - store runtime values in context
compiler.context.set('ValidationError', ValidationError);
compiler.context.set('isString', (v: any) => typeof v === 'string');
const code = `if (!isString(data)) throw new ValidationError('...')`;

// ✅ NEW - use ctx.call() for function calls
return jit.fn(jit.arg<any>(), (ctx, data) => {
    ctx.when(ctx.not(ctx.isType(data, 'string')), () => {
        ctx.call(throwValidationError, ctx.lit('Expected string'));
    });
    return data;
});
```

### 2. Conditionals

**If-Else:**
```typescript
// ❌ OLD
let code = `if (typeof data === 'string') {`;
code += `  result = data;`;
code += `} else {`;
code += `  result = String(data);`;
code += `}`;

// ✅ NEW
return jit.fn(jit.arg<any>(), (ctx, data) => {
    return ctx.ternary(
        ctx.isType(data, 'string'),
        data,
        ctx.call(String, data)
    );
});
```

**Nested Conditionals:**
```typescript
// ❌ OLD
code = `if (data === null) { result = null; }`;
code += `else if (data === undefined) { result = undefined; }`;
code += `else { result = String(data); }`;

// ✅ NEW - use ctx.cond() for if-else chains
return jit.fn(jit.arg<any>(), (ctx, data) => {
    return ctx.cond([
        [ctx.eq(data, ctx.lit(null)), ctx.lit(null)],
        [ctx.eq(data, ctx.lit(undefined)), ctx.lit(undefined)],
    ], ctx.call(String, data));
});
```

### 3. Loops

**For-In Loop:**
```typescript
// ❌ OLD
let code = `for (const key in obj) {`;
code += `  if (!hasOwnProperty.call(obj, key)) continue;`;
code += `  result[key] = convert(obj[key]);`;
code += `}`;

// ✅ NEW - use ctx.forIn()
return jit.fn(jit.arg<any>(), (ctx, obj) => {
    const result = ctx.let_('result', ctx.lit({}));
    ctx.forIn(obj, (key, value) => {
        ctx.set(result, key, ctx.call(convert, value));
    });
    return result;
});
```

**Array Iteration:**
```typescript
// ❌ OLD
code = `const result = [];`;
code += `for (let i = 0; i < arr.length; i++) {`;
code += `  result.push(convert(arr[i]));`;
code += `}`;

// ✅ NEW - use ctx.map() or ctx.forEach()
return jit.fn(jit.arg<any[]>(), (ctx, arr) => {
    return ctx.map(arr, (item, index) => {
        return ctx.call(convert, item);
    });
});
```

### 4. Type Checking

```typescript
// ❌ OLD: typeof checks
code = `'string' === typeof data`;
// ✅ NEW
ctx.isType(data, 'string')

// ❌ OLD: instanceof checks
compiler.context.set('Date', Date);
code = `data instanceof Date`;
// ✅ NEW
ctx.isInstance(data, Date)

// ❌ OLD: Array.isArray
code = `Array.isArray(data)`;
// ✅ NEW
ctx.call(Array.isArray, data)
```

### 5. Property Access

```typescript
// ❌ OLD: Direct property access
code = `data.name`;
code = `data['some-prop']`;
// ✅ NEW
data.get('name')
data.get('some-prop')

// ❌ OLD: Setting properties
code = `result.name = data.name;`;
// ✅ NEW
ctx.set(result, 'name', data.get('name'));

// ❌ OLD: In operator
code = `'name' in data`;
// ✅ NEW
ctx.has(data, 'name')
```

### 6. Object/Array Creation

```typescript
// ❌ OLD: Static object literal
code = `let result = { a: 1, b: 2 };`;
// ✅ NEW
ctx.lit({ a: 1, b: 2 })

// ❌ OLD: Dynamic object building
code = `let result = {}; result.a = valueA;`;
// ✅ NEW
const result = ctx.lit({});
ctx.set(result, 'a', valueA);

// ❌ OLD: Object.create() for disableConstructor
code = `Object.create(classType.prototype)`;
// ✅ NEW - use helper function
const createInstance = () => Object.create(MyClass.prototype);
ctx.call(createInstance)
```

### 7. Error Handling

```typescript
// ❌ OLD
compiler.context.set('ValidationError', ValidationError);
code = `throw new ValidationError('Expected string')`;

// ✅ NEW - use ctx.throw_()
ctx.throw_(ValidationError, ctx.lit('Expected string'))

// Or with ctx.call for factory functions
ctx.call(throwValidationError, ctx.lit('Expected string'))
```

### 8. State Tracking (var_/setVar/getVar)

```typescript
// ❌ OLD
code = `let hasChanges = false;`;
code += `if (a !== b) hasChanges = true;`;
code += `return hasChanges;`;

// ✅ NEW - use var_/setVar/getVar
return jit.fn(jit.arg<any>(), jit.arg<any>(), (ctx, a, b) => {
    const hasChanges = ctx.var_(false);
    ctx.when(ctx.neq(a, b), () => {
        ctx.setVar(hasChanges, ctx.lit(true));
    });
    return ctx.getVar(hasChanges);
});
```

### 9. Switch Statements

```typescript
// ❌ OLD
code = `switch (type) {`;
code += `  case 'string': return serialize_string(data);`;
code += `  case 'number': return serialize_number(data);`;
code += `  default: throw new Error('Unknown type');`;
code += `}`;

// ✅ NEW - use ctx.switch_()
return jit.fn(jit.arg<string>(), jit.arg<any>(), (ctx, type, data) => {
    return ctx.switch_(type, [
        [ctx.lit('string'), () => ctx.call(serialize_string, data)],
        [ctx.lit('number'), () => ctx.call(serialize_number, data)],
    ], () => ctx.throw_(Error, ctx.lit('Unknown type')));
});
```

### 10. String Concatenation (Path Building)

```typescript
// ❌ OLD
code = `const path = parentPath + '.' + propertyName;`;

// ✅ NEW - use ctx.concat()
ctx.concat(parentPath, ctx.lit('.'), propertyName)
```

### 11. Union Resolution (Score-Based)

```typescript
// ❌ OLD (from handleUnion)
code = `let matching = -1; let matchingIndex = -1;`;
for (const t of unionTypes) {
    code += `const score_${i} = checkType_${i}(data);`;
    code += `if (score_${i} > matching) { matching = score_${i}; matchingIndex = ${i}; }`;
}

// ✅ NEW
return jit.fn(jit.arg<any>(), (ctx, data) => {
    const matching = ctx.var_(-1);
    const matchingIndex = ctx.var_(-1);

    for (let i = 0; i < unionTypes.length; i++) {
        const score = ctx.call(checkTypeFns[i], data);
        ctx.when(ctx.gt(score, ctx.getVar(matching)), () => {
            ctx.setVar(matching, score);
            ctx.setVar(matchingIndex, ctx.lit(i));
        });
    }

    return ctx.switch_(ctx.getVar(matchingIndex),
        unionTypes.map((_, i) => [ctx.lit(i), () => ctx.call(serializeFns[i], data)]),
        () => ctx.throw_(ValidationError, ctx.lit('No matching type'))
    );
});
```

### 12. Large Literal Union (Set Optimization)

```typescript
// ❌ OLD
if (type.types.length >= 50) {
    compiler.context.set('literalSet', new Set(literals));
    code = `if (!literalSet.has(data)) throw ...;`;
}

// ✅ NEW
return jit.fn(jit.arg<any>(), (ctx, data) => {
    const literalSet = new Set(literals); // Captured in closure
    ctx.when(ctx.not(ctx.call(literalSet.has.bind(literalSet), data)), () => {
        ctx.throw_(ValidationError, ctx.lit('Invalid literal'));
    });
    return data;
});
```

### 13. Binary Data Handling

```typescript
// ❌ OLD
compiler.context.set('arrayBufferToBase64', arrayBufferToBase64);
code = `result = arrayBufferToBase64(data)`;

// ✅ NEW
return jit.fn(jit.arg<ArrayBuffer>(), (ctx, data) => {
    return ctx.call(arrayBufferToBase64, data);
});
```

### 14. Recursion Handling

**Build-Time (Type Graph Cycles):**
```typescript
// ❌ OLD - parentTypes array + JitStack
state.parentTypes.push(type);
if (state.jitStack.has(registry, type)) { /* call existing */ }
else {
    const prepare = state.jitStack.prepare(registry, type);
    // ... build ...
    prepare.setFunction(builtFn);
}
state.parentTypes.pop();

// ✅ NEW - typeStack Set + fnCache Map
if (this.typeStack.has(type)) {
    return this.buildExtractedCall(type, input);  // Circular
}
if (this.fnCache.has(type)) {
    return ctx.call(ctx.getVar(this.fnCache.get(type)!), input, state, path);  // Reuse
}
this.typeStack.add(type);
const result = this.buildInline(type, input);
this.typeStack.delete(type);
return result;
```

**Runtime (Circular Data):**
```typescript
// ❌ OLD
code = `if (state._stack && state._stack.includes(data)) return undefined;`;
code += `state._stack = state._stack || []; state._stack.push(data);`;

// ✅ NEW
const arrayIncludes = (arr: any[], item: any) => arr.includes(item);
ctx.when(ctx.not(state.get('_stack')), () => {
    ctx.set(state, '_stack', ctx.lit([]));
});
return ctx.cond([
    [ctx.isNullish(data), () => serializeInner(ctx, data, state)],
    [ctx.call(arrayIncludes, state.get('_stack'), data), () => ctx.lit(undefined)],
], () => {
    ctx.call(arrayPush, state.get('_stack'), data);
    const result = serializeInner(ctx, data, state);
    ctx.call(arrayPop, state.get('_stack'));
    return result;
});
```

### 15. Class Instantiation

```typescript
// ❌ OLD: With constructor
compiler.context.set('MyClass', MyClass);
code = `new MyClass(arg1, arg2)`;

// ✅ NEW - factory function (captures class in closure)
const createMyClass = (a: any, b: any) => new MyClass(a, b);
ctx.call(createMyClass, arg1, arg2)

// ❌ OLD: Without constructor (disableConstructor)
code = `Object.create(MyClass.prototype)`;

// ✅ NEW
const createInstance = () => Object.create(MyClass.prototype);
ctx.call(createInstance)
```

### 16. Performance-Critical Patterns

**Avoid These Anti-Patterns:**
```typescript
// ❌ DON'T: Create functions in hot paths
code = `const fn = (x) => x + 1; result = fn(data);`;

// ✅ DO: Pre-define and reference
const addOne = (x: number) => x + 1;
ctx.call(addOne, data);
```

**Ensure V8 Optimization:**
1. **Monomorphic functions**: Each generated function handles ONE type
2. **Stable shapes**: Objects created should have consistent property order
3. **No megamorphic calls**: Avoid calling same function with different argument types

### jit.ts Primitives Summary

**Already Available:**
| Primitive | Purpose |
|-----------|---------|
| `var_(initial)` | Mutable state cell |
| `setVar(ref, value)` | Update mutable cell |
| `getVar(ref)` | Read mutable cell |
| `switch_(value, cases, default)` | Switch statement |
| `ternary(cond, then, else)` | Inline conditional |
| `isInstance(value, ctor)` | instanceof check |
| `throw_(Error, message)` | Throw error |
| `forIn(obj, callback)` | For-in loop |
| `cond(cases, default)` | If-else chain |
| `concat(...parts)` | String concatenation |
| `typeof_(value)` | typeof operator |

**Key Insight: Slots vs Code Generation**

CompilerContext builds strings that become JavaScript code. jit.fn() builds a computation graph with slots:

```typescript
// CompilerContext - strings
let code = 'let x = data.name;';
code += 'if (x) result = x;';
return new Function('data', code);

// jit.fn() - slots
return jit.fn(jit.arg<any>(), (ctx, data) => {
    const x = data.get('name');     // x is a SLOT (reference to a value)
    return ctx.ternary(x, x, ctx.lit(undefined));
});
```

In JIT mode, jit.fn() generates optimized code similar to CompilerContext.
In Exec mode (CSP), jit.fn() interprets the graph directly.

---

## Handler Examples

### Primitive with Specificality

```typescript
// In registerDefaults():

// String - exact match (specificality 1)
this.typeGuards.register(1, ReflectionKind.string, (type, input, ctx, state) => {
    return ctx.isType(input, 'string');
});

// String - ultimate fallback (specificality 50)
this.typeGuards.register(50, ReflectionKind.string, (type, input, ctx, state) => {
    return ctx.and(
        ctx.not(ctx.isNullish(input)),
        ctx.lit(true)
    );
});

// Number - exact match (specificality 1)
this.typeGuards.register(1, ReflectionKind.number, (type, input, ctx, state) => {
    return ctx.isType(input, 'number');
});

// Number - loose from string (specificality -0.5)
this.typeGuards.register(-0.5, ReflectionKind.number, (type, input, ctx, state) => {
    const isNumericString = ctx.call(isNumeric, input);
    return ctx.and(ctx.isType(input, 'string'), isNumericString);
});

// Boolean - exact match (specificality 1)
this.typeGuards.register(1, ReflectionKind.boolean, (type, input, ctx, state) => {
    return ctx.isType(input, 'boolean');
});

// Boolean - loose from string/number (specificality -0.9)
this.typeGuards.register(-0.9, ReflectionKind.boolean, (type, input, ctx, state) => {
    return ctx.or(
        ctx.eq(input, ctx.lit(1)),
        ctx.eq(input, ctx.lit('1')),
        ctx.eq(input, ctx.lit(0)),
        ctx.eq(input, ctx.lit('true')),
        ctx.eq(input, ctx.lit('false'))
    );
});

// Date - exact match (specificality 1)
this.typeGuards.registerClass(1, Date, (type, input, ctx, state) => {
    return ctx.isInstance(input, Date);
});

// Date - ISO string (specificality 0.5, beats raw string)
this.typeGuards.registerClass(0.5, Date, (type, input, ctx, state) => {
    return ctx.and(
        ctx.isType(input, 'string'),
        ctx.call((s: string) => new Date(s).toString() !== 'Invalid Date', input)
    );
});

// Date - timestamp number (specificality 1.5, fallback)
this.typeGuards.registerClass(1.5, Date, (type, input, ctx, state) => {
    return ctx.isType(input, 'number');
});
```

### Object Literal Handler

```typescript
function handleObjectLiteral(
    type: TypeObjectLiteral,
    input: Slot,
    ctx: Context,
    state: BuildState
): Slot {
    // Type check
    ctx.when(ctx.not(ctx.isType(input, 'object')), () => {
        state.throw_(type, input);
    });
    ctx.when(ctx.isNull(input), () => {
        state.throw_(type, input);
    });

    const result = ctx.obj();

    for (const member of resolveTypeMembers(type)) {
        if (!isPropertyMember(member)) continue;

        const name = memberNameToString(member.name);
        const propState = state.forProperty(name);

        ctx.when(ctx.has(input, name), () => {
            const propInput = input.get(name);

            // Handle null/undefined
            ctx.cond([
                [ctx.isNullish(propInput), () => {
                    if (isNullable(member)) {
                        ctx.set(result, name, ctx.lit(null));
                    } else if (!isOptional(member)) {
                        propState.throw_(member.type, propInput);
                    }
                }]
            ], () => {
                // INLINE nested build
                const converted = propState.build(member.type, propInput);
                ctx.set(result, name, converted);
            });
        }, () => {
            // Property missing
            if (!isOptional(member) && !hasDefaultValue(member)) {
                propState.addValidationError('required', 'Required property missing', ctx.lit(undefined));
            }
        });
    }

    // Index signatures
    handleIndexSignatures(type, input, result, ctx, state);

    return result;
}
```

### Validation Post-Hook

```typescript
// Registered as post-hook on typeGuards.getRegistry(1)
function validationHook(
    type: Type,
    input: Slot,
    ctx: Context,
    state: BuildState,
    next: () => Slot
): Slot {
    // Run type check first
    const typeResult = next();

    // If type check passed, run validators
    const annotations = validationAnnotation.getAnnotations(type);
    if (annotations.length === 0) return typeResult;

    const valid = ctx.var_(typeResult);

    for (const validation of annotations) {
        const { name, args } = validation;

        if (name === 'function') {
            // Custom validator
            const validatorFn = state.extern(args[0].function);
            const error = ctx.call(validatorFn, input, state.extern(type));
            ctx.when(error, () => {
                ctx.setVar(valid, ctx.lit(false));
                state.addValidationError(
                    ctx.get(error, 'code'),
                    ctx.get(error, 'message'),
                    input
                );
            });
        } else {
            // Built-in validator
            const validator = validators[name];
            if (validator) {
                const validatorFn = state.extern(validator(...args));
                const error = ctx.call(validatorFn, input);
                ctx.when(error, () => {
                    ctx.setVar(valid, ctx.lit(false));
                    state.addValidationError(
                        ctx.get(error, 'code'),
                        ctx.get(error, 'message'),
                        input
                    );
                });
            }
        }
    }

    return ctx.getVar(valid);
}
```

---

## Implementation Order

1. **Extend jit.ts** - Add `throw_`, `forIn`, `cond`, `concat`
2. **serializer/registry.ts** - HandlerRegistry, TypeGuardRegistry
3. **serializer/state.ts** - BuildState with inline/extract logic
4. **serializer/builder.ts** - jit.fn() integration
5. **serializer/handlers.ts** - All type handlers with specificality
6. **serializer/union.ts** - Union strategies
7. **serializer/validation.ts** - Validator hook
8. **serializer/naming.ts** - NamingStrategy
9. **serializer/errors.ts** - SerializationError
10. **serializer/serializer.ts** - Serializer class, public API
11. **path.ts** - Rewrite
12. **snapshot.ts** - Rewrite
13. **change-detector.ts** - Rewrite

---

## Public API Preservation

These exports must remain for external packages:

```typescript
// Classes
export class Serializer { ... }
export class SerializationError extends DeepkitError { ... }
export class NamingStrategy { ... }
export const underscoreNamingStrategy: NamingStrategy;
export const serializer: Serializer;

// Types
export type SerializeFunction<T, R> = (data: T, options?: SerializationOptions) => R;
export interface SerializationOptions { groups?, groupsExclude?, loosely? }
export type Guard<T> = (data: any, state?) => data is T;

// Functions (may have different implementation)
export function getSerializeFunction(...): SerializeFunction;
export function createSerializeFunction(...): SerializeFunction;
export function createTypeGuardFunction(...): Guard<any> | undefined;
```

**Note:** Internal classes like `TemplateState`, `TemplateRegistry`, `ContainerAccessor` will be deleted. External packages (BSON, SQL, Mongo) will be updated separately after `@deepkit/type` is complete.

---

## Verification

```bash
# Build
npm run tsc

# Test
npm run test packages/type/

# Benchmark (must be < 10% regression)
cd packages/type && node --import @deepkit/run benchmarks/serializer.ts
```

---

## Comprehensive Capability Inventory

This section documents ALL features that MUST be preserved in the rewrite. Based on analysis of:
- All type handlers in serializer.ts
- Complete specificality system
- Public API surface
- Downstream package dependencies (BSON, SQL, Mongo)
- Specialized features (References, Embedded, Groups, etc.)
- Validation system
- 3200+ test cases

### 1. Type Handlers by ReflectionKind

Every type kind must have serialize, deserialize, and type guard handlers:

| Kind | Serialize | Deserialize | Type Guard (Strict) | Type Guard (Loose) |
|------|-----------|-------------|---------------------|-------------------|
| `never` | Error | Error | Always false | Always false |
| `any` | Pass-through | Pass-through | Always true | Always true |
| `unknown` | Pass-through | Pass-through | Always true | Always true |
| `void` | → undefined | → undefined | `=== undefined` | `=== undefined` |
| `object` | Pass-through | Pass-through | `typeof === 'object'` | Same |
| `string` | Pass-through | String(v) | `typeof === 'string'` | `!== null && !== undefined` (spec 50) |
| `number` | Pass-through | Number(v) | `typeof === 'number'` | isNumeric string (spec -0.5) |
| `boolean` | Pass-through | Coerce | `typeof === 'boolean'` | `'true'/'false'/0/1` (spec -0.9) |
| `symbol` | Pass-through | Pass-through | `typeof === 'symbol'` | Same |
| `bigint` | → string | BigInt(v) | `typeof === 'bigint'` | isNumeric string (spec -0.5) |
| `null` | Pass-through | → null | `=== null` | Same |
| `undefined` | Pass-through | → undefined | `=== undefined` | Same |
| `regexp` | → string repr | regExpFromString | `instanceof RegExp` | String pattern (spec 2) |
| `literal` | Pass-through | Coerce to literal | `=== literal` | Loosely coerce (spec -0.5) |
| `templateLiteral` | Validate | Validate | Regex match | Same |
| `promise` | Error | Error | N/A | N/A |
| `class` | Serialize members | Construct + members | `instanceof` | Object with matching members |
| `enum` | Pass-through | By value or label | `in enum values` | Case-insensitive label |
| `union` | Match + serialize | Score + deserialize | Any member matches | Context-specific specificality |
| `intersection` | Merge all | Merge all | All match | All match |
| `array` | Map serialize | Map deserialize | `Array.isArray` | Same |
| `tuple` | Serialize each | Deserialize each | Length + element types | Same |
| `objectLiteral` | Serialize properties | Deserialize properties | Structure match | Same |
| `indexSignature` | Serialize values | Deserialize values | Key + value types | Same |

### 2. Special Class Handlers

| Class | Serialize | Deserialize | Specificality Notes |
|-------|-----------|-------------|---------------------|
| `Date` | → ISO string | `new Date(v)` | spec 1: instanceof, spec 0.5: ISO string, spec 1.5: timestamp |
| `Set<T>` | → array | `new Set(array)` | spec 1: instanceof |
| `Map<K,V>` | → array of tuples | `new Map(tuples)` | spec 1: instanceof |
| `ArrayBuffer` | → base64 | base64 → buffer | spec 10: base64 string |
| `Uint8Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Int8Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Uint16Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Int16Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Uint32Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Int32Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Float32Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `Float64Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `BigInt64Array` | → base64 | base64 → typed array | spec 10: base64 string |
| `BigUint64Array` | → base64 | base64 → typed array | spec 10: base64 string |

### 3. Reference Handling (CRITICAL)

**ALREADY IMPLEMENTED** (commit 4b8e3102) - Must preserve in rewrite.

#### Principle: Type Annotation = Serialization Output. No Magic.

Serialization is **TYPE-DRIVEN**, not runtime-state-driven. Do NOT use `isReferenceInstance()` to decide serialization output.

**Type Annotations:**
- `Reference<Options>` - FK relationship
- `BackReference<Options>` - Inverse FK
- `Inline<Options>` - Serialize as full object

#### The Rules

```typescript
class Post {
    // Rule 1: & Reference → FK only (always)
    author: User & Reference;              // → { author: 2 }

    // Rule 2: & Reference & Inline → Nested object (always)
    // Throws SerializationError if not loaded
    editor: User & Reference & Inline;     // → { editor: { id: 3, name: "..." } }

    // Rule 3: No & Reference → Embedded object (existing behavior)
    metadata: Metadata;                    // → { metadata: { ... } }
}
```

#### Behavior Matrix

| Type Annotation | JSON | BSON | MongoDB Storage |
|-----------------|------|------|-----------------|
| `& Reference` | FK only | FK only | FK only |
| `& Reference & Inline` | Nested | Nested | FK only (always) |
| `& Reference & Inline<{only:['json']}>` | Nested | FK only | FK only |

**MongoDB special case**: Database storage NEVER includes nested objects for Reference fields, regardless of `& Inline`. Enforced at adapter level.

#### Error Handling

```typescript
class Post {
    editor: User & Reference & Inline;  // Must be loaded for serialization
}

const post = await db.query(Post).findOne();  // WITHOUT joinWith('editor')
serialize<Post>(post);
// → SerializationError: Cannot serialize Post.editor: Inline reference not loaded.
```

#### Implementation Notes

- `joinWith()` is for **loading data**, not controlling serialization
- Different output shapes → use different TypeScript types (not runtime options)
- `isReferenceInstance()` / `isReferenceHydrated()` are for ORM internals, NOT serialization decisions

**Reference Proxy (ORM internals only):**
- Lazy-loading via `referenceSymbol` and `referenceItemSymbol`
- Tracks hydration state for ORM operations
- Non-PK property access throws or returns `unpopulatedSymbol`

### 4. Embedded Types (CRITICAL)

**Single Property Embedded:**
```typescript
class Price { constructor(public amount: integer) {} }
// Embedded<Price> serializes as: 34 (just the value)
```

**Multi-Property Embedded:**
```typescript
class Price { amount: integer; currency: string = 'EUR'; }
// property `price: Embedded<Price>` serializes as: { price_amount: 34, price_currency: 'EUR' }
```

**Prefix Options:**
- `Embedded<T>` - Uses property name as prefix
- `Embedded<T, { prefix: '' }>` - No prefix
- `Embedded<T, { prefix: 'custom_' }>` - Custom prefix

**Edge Cases:**
- Optional embedded: `v?: Embedded<Price>`
- Embedded in unions: `Embedded<Price> | string`
- Nested embedded (embedded within embedded)

### 5. Serialization Groups

**Usage:**
```typescript
class User {
    id: number = 0;
    password: string & Group<'credentials'> = '';
    username: string & Group<'public'> = '';
}
```

**Options:**
- `{ groups: ['a'] }` - Include ONLY properties with group 'a'
- `{ groups: [] }` - Include ONLY non-grouped properties
- `{ groupsExclude: ['b'] }` - Exclude properties with group 'b'
- `{ groupsExclude: [] }` - Exclude non-grouped properties

### 6. Exclusions

**Usage:**
```typescript
interface User {
    password: string & Excluded;           // All serializers
    secret: string & Excluded<'json'>;     // Only 'json' serializer
}
```

**Reset:**
```typescript
type Password = string & Excluded;
interface UserCreation {
    password: Password & ResetAnnotation<'excluded'>  // Removes exclusion
}
```

### 7. Naming Strategies

**NamingStrategy Class:**
```typescript
class NamingStrategy {
    getPropertyName(type: TypeProperty | TypePropertySignature, forSerializer: string): string | undefined
}
```

**Built-in:**
- `underscoreNamingStrategy` - camelCase → snake_case

**MapName Annotation:**
```typescript
class Thread {
    constructor(public id: string & MapName<'~thread'>) {}  // Maps to '~thread'
}
```

**Scoped MapName:**
```typescript
id: string & MapName<'_id', 'bson'>  // Only for BSON serializer
```

### 8. Validation System (CRITICAL)

**Built-in Validators:**

| Validator | Type | Description |
|-----------|------|-------------|
| `Pattern<T>` | string | Regex match |
| `Alpha` | string | Letters only |
| `Alphanumeric` | string | Letters + numbers |
| `Ascii` | string | ASCII chars |
| `MinLength<N>` | string/array | Min length |
| `MaxLength<N>` | string/array | Max length |
| `Includes<T>` | string/array | Contains value |
| `Excludes<T>` | string/array | Doesn't contain |
| `Decimal<Min, Max>` | string | Decimal format |
| `Email` | string | Email format |
| `Minimum<T>` | number/bigint | >= T |
| `Maximum<T>` | number/bigint | <= T |
| `ExclusiveMinimum<T>` | number/bigint | > T |
| `ExclusiveMaximum<T>` | number/bigint | < T |
| `Positive` | number/bigint | >= 0 |
| `PositiveNoZero` | number/bigint | > 0 |
| `Negative` | number/bigint | <= 0 |
| `NegativeNoZero` | number/bigint | < 0 |
| `MultipleOf<N>` | number/bigint | Divisible by N |
| `BeforeDate<T>` | Date | Before timestamp |
| `AfterDate<T>` | Date | After timestamp |
| `BeforeNow` | Date | In past |
| `AfterNow` | Date | In future |

**Custom Validators:**
```typescript
// Pre-defined
const startsWithA = (v: any) => v.startsWith('a') ? undefined : new ValidatorError(...);
type T = string & Validate<typeof startsWithA>;

// With options
function startsWith(v: any, type: Type, letter: string) { ... }
type T = string & Validate<typeof startsWith, 'a'>;
```

**Class-Level Validators:**
```typescript
class Email {
    @t.validator
    validator(): ValidatorError | void {
        if (this.email === '') return new ValidatorError('email', 'Invalid');
    }
}
```

**Validation API:**
- `is<T>(data)` - Type guard, returns boolean
- `validate<T>(data)` - Returns ValidationErrorItem[]
- `validates<T>(data)` - Simple boolean check
- `assert<T>(data)` - Throws ValidationError on failure
- `guard<T>()` - Returns reusable guard function

### 9. Integer Types with Range Constraints

| Type | Min | Max |
|------|-----|-----|
| `integer` | -∞ | +∞ (truncates) |
| `int8` | -128 | 127 |
| `uint8` | 0 | 255 |
| `int16` | -32768 | 32767 |
| `uint16` | 0 | 65535 |
| `int32` | -2147483648 | 2147483647 |
| `uint32` | 0 | 4294967295 |
| `float32` | ~-3.4e38 | ~3.4e38 |
| `float64` | ~-1.8e308 | ~1.8e308 |

**Behavior:**
- `cast<integer>(123.456)` → `123` (truncates)
- `cast<int8>(1000)` → `127` (clamps to max)

### 10. BinaryBigInt

**Types:**
- `BinaryBigInt` - Unsigned (clamps negative to 0)
- `BinaryBigInt<BinaryBigIntType.signed>` - Signed

**Behavior:**
- Serialize: bigint → string
- Deserialize: string → bigint
- Unsigned clamps negative values to 0

### 11. Default Values

**Class Defaults:**
```typescript
class User { logins: number = 0; }
// cast<User>({}) → { logins: 0 }
```

**Optional with Default:**
```typescript
class User { logins?: number = 2; }
// cast<User>({}) → { logins: 2 }
// cast<User>({ logins: undefined }) → { logins: undefined }
```

### 12. Loose vs Strict Mode

**SerializationOptions.loosely:**
- `true` (default): String coercion enabled
- `false`: Strict type checking

**Examples:**
- `cast<number>('23')` → `23` (loose)
- `cast<number>('23', { loosely: false })` → throws

### 13. Union Resolution Edge Cases

**Large Literal Unions:**
- >= 5 members use Set.has() optimization
- 86,400+ members (e.g., time strings) don't cause stack overflow

**Validation in Unions:**
```typescript
type T = (string & MinLength<3>) | (number & Positive);
// Input "-5" → tries number first, fails Positive, tries string, fails MinLength
```

**Discriminated Unions:**
```typescript
type T = { kind: 'a'; name: string } | { kind: 'b'; date: Date };
// Uses 'kind' property for O(1) lookup
```

### 14. Change Detection

**Functions:**
- `getChangeDetector(schema)` - Returns change detection function
- `buildChanges(schema, snapshot, item)` - Builds Changes object

**Changes Class:**
- `$set` - Modified properties
- `$unset` - Removed properties
- `$inc` - Incremented numeric fields

### 15. Snapshots

**Functions:**
- `createSnapshot(schema, item)` - Creates snapshot of entity
- `getConverterForSnapshot(schema)` - Returns conversion function
- `getPrimaryKeyExtractor(schema)` - Extracts PK from entity
- `getPrimaryKeyHashGenerator(schema)` - Generates hash from PK

### 16. Path Resolution

**Functions:**
- `resolvePath(path, type)` - Resolves type at path
- `pathResolver(type)` - Returns resolver function

**Path Format:**
- Dot notation: `'user.address.street'`
- Array indices: `'items.0.name'`
- Index signatures: `'configs.myKey.value'`

### 17. Downstream Package Dependencies

**BSON (@deepkit/bson):**
- Needs: sizer, bsonSerialize, bsonDeserialize registries
- Uses: ObjectId, Binary, Timestamp types
- Extends: BSONBinarySerializer

**SQL (@deepkit/sql):**
- Uses: Serializer base class
- Uses: serializeObjectLiteral, handleUnion
- Database-specific type mapping

**Mongo (@deepkit/mongo):**
- Extends: BSONBinarySerializer
- Uses: EmptySerializer for partial serialization

**At Risk Internal APIs:**
These will be removed but must be considered for downstream compatibility:
- `TemplateState`
- `TemplateRegistry`
- `TypeGuardRegistry` (different implementation)
- `executeTemplates`
- `JitStack`
- `ContainerAccessor`

### 18. Error Handling

**Error Types:**
- `ValidationError` (code: DK-T300) - Thrown by assert()
- `ValidationErrorItem` - Individual error in collection
- `SerializationError` (code: DK-T200) - Serialization failures

**Path Tracking:**
- Dot notation: `'user.address.street'`
- Named tuple elements use element name: `'age'` not `'0'`
- Array indices: `'items.5.value'`

### 19. Entity Options

**@entity decorator options:**
- `name` - Entity name
- `description` - Description
- `collection` - Collection name
- `database` - Database name
- `singleTableInheritance` - STI flag
- `indexes` - Index definitions
- `disableConstructor` - Skip constructor during deserialization

### 20. Partial Serialization

**Functions:**
- `getPartialSerializeFunction(type, registry)` - For Partial<T>
- `getPartialType(type)` - Creates Partial version of type

**Behavior:**
- All properties become optional
- Used for PATCH operations

### 21. Error Handling Patterns (CRITICAL)

**Error Classes:**
| Class | Error Code | Purpose |
|-------|------------|---------|
| `DeepkitError` | Base | Base class with code + docs URL |
| `SerializationError` | DK-T200 | Serialization/deserialization failures |
| `ValidationError` | DK-T300 | Wrapper for validation failures |
| `ValidationErrorItem` | N/A | Individual validation failure detail |
| `ValidatorError` | N/A | Returned from custom validators |

**Error in JIT-Compiled Code:**
```typescript
// CompilerContext setup
compiler.context.set('SerializationError', SerializationError);
compiler.context.set('ValidationErrorItem', ValidationErrorItem);

// throwCode() - Hard errors (serialization)
state.throwCode(type, error?, accessor?)
// → throw ValidationError.from([{code: 'type', path: ..., message: ...}])

// assignValidationError() - Soft errors (validation accumulation)
state.assignValidationError(code, message)
// → if (state.errors) state.errors.push(new ValidationErrorItem(...))
```

**Path Tracking:**
- `TemplateState.path: (string | RuntimeCode)[]`
- `extendPath(path)` - Adds path segment
- `collapsePath(path)` - Generates `"user" + '.' + "address" + '.' + i`
- `RuntimeCode` - Dynamic segments (e.g., loop variable `i`)

**Error Modes:**
1. **Hard errors** (serialization): `throwCode()` → immediate throw
2. **Soft errors** (validation): `assignValidationError()` → accumulate in `state.errors`
3. **Custom converter**: Try/catch with path enrichment

**Error Message Formats:**
- Type mismatch: `Cannot convert {value} to {type}`
- Validation item: `{path}({code}): {message} caused by value {serializedValue}`

### 22. Generic Type Handling

**Type Parameter Resolution (processor.ts):**
- `ReflectionOp.typeParameter` / `ReflectionOp.typeParameterDefault`
- Type arguments passed via `program.frame.inputs`
- If no argument: creates `TypeParameter` with name
- If argument provided: uses concrete type

**ReceiveType<T> Pattern:**
```typescript
export type ReceiveType<T> = Packed<T> | ClassType<T> | Type;

function example<T>(type?: ReceiveType<T>): Type {
    return resolveReceiveType(type);
}
// Type compiler auto-injects packed type info
```

**Generic Class Serialization:**
```typescript
interface TypeClass {
    arguments?: Type[];         // Instantiated type arguments
    extendsArguments?: Type[];  // Parent class type arguments
    typeArguments?: Type[];     // Original for display
}
```

**Caching Behavior:**
- Non-generic types: cached in `packed.__type`
- Generic types: always produce NEW instances (no caching)
- Use type alias for caching: `type GenericClassString = GenericClazz<string>`

**Nested Generics:**
- `Set<T>`: `arguments: [T]`
- `Map<K, V>`: `arguments: [K, V]`
- Serializers use `getSetTypeToArray`, `getMapTypeToArray` to convert

### 23. Binary Data Types

**Supported Types:**
```typescript
const binaryTypes = [
    Int8Array, Uint8Array, Uint8ClampedArray,
    Int16Array, Uint16Array, Int32Array, Uint32Array,
    Float32Array, Float64Array, ArrayBuffer
];
// Note: BigInt64Array, BigUint64Array, DataView handled separately
```

**JSON Serialization:**
- ArrayBuffer/TypedArray → base64 string
- `arrayBufferToBase64()`, `typedArrayToBase64()`
- `base64ToArrayBuffer()`, `base64ToTypedArray()`

**Memory Management:**
- Node Buffer pooling: `nodeBufferToArrayBuffer()` creates fresh copy
- Snapshot cloning: All binary types get proper deep copies
- TypedArray byte offset handling respected

**BinaryBigInt Types:**
```typescript
// Unsigned (clamps negative to 0)
type BinaryBigInt = bigint & TypeAnnotation<'binaryBigInt'>;

// Signed (leading sign byte: 255=negative, 0=zero, 1=positive)
type SignedBinaryBigInt = bigint & TypeAnnotation<'signedBinaryBigInt'>;
```

### 24. Union/Intersection Edge Cases (CRITICAL)

**Discriminator Detection:**
- NOT explicit discriminator lookup
- Score-based matching: each property match increments score
- Highest score wins (first on tie)
- Literal properties naturally act as discriminators

**Large Union Optimization:**
- `UNION_LITERAL_THRESHOLD = 50`
- Pure literal unions: `Set.has()` instead of if-else chain
- Prevents stack overflow for 86,400+ members

**Union with null/undefined:**
- `T | undefined` → optional property (2-member union)
- `T | null | undefined` → NOT converted to optional
- JSON: `undefined` → `null`, `null` can become `undefined`

**Nested Unions:**
- `flattenUnionTypes()` - Flattens and dedupes
- Single-member unions unboxed
- Empty unions → `never`

**Intersection Handling:**
- Object + Object: `merge([a, b])` combines properties
- Annotations accumulated from all members
- `never` types skipped, result becomes `never` if incompatible

**Error Reporting for Ambiguous Unions:**
1. Collect all errors in temp array
2. Show constraint errors (code !== 'type') from any member
3. Show structural errors from closest-matching member
4. Fallback: generic "Cannot convert X to Y"

### 25. Circular Reference Handling

**Self-Referential Classes:**
```typescript
class Node { children: Node[] = []; }
// processor uses program.resultType as placeholder
// 'number' === typeof p && p === 0 → self-reference
```

**Mutual Recursion:**
- `findExistingProgram()` tracks active programs
- `createRef()` creates placeholder updated after resolution
- Safety: `if (checks > 1000) return current`

**Runtime Stack Tracking:**
```typescript
// In buildFunction() for types with circular reference
if (hasCircularReference(type)) {
    circularCheckBeginning = `
        if (state._stack) {
            if (state._stack.includes(data)) return undefined;
        } else {
            state._stack = [];
        }
        state._stack.push(data);
    `;
}
```

**JIT Compilation:**
- `JitStack` class tracks in-progress compilations
- `has(registry, type)` - Check if being processed
- `prepare(registry, type)` - Register as in-progress
- `getOrCreate()` - Get cached or create new

### 26. Serialization Context/State Infrastructure

**SerializationOptions (Runtime):**
```typescript
interface SerializationOptions {
    groups?: string[];        // Include only these groups
    groupsExclude?: string[]; // Exclude these groups
    loosely?: boolean;        // Enable loose coercion (default: true)
}
```

**TemplateState (JIT Compilation):**
| Property | Purpose |
|----------|---------|
| `template` | Accumulated generated code |
| `setter/accessor` | Output/input variable names |
| `validation` | 'strict' \| 'loose' \| undefined |
| `propertyName` | Current property being processed |
| `parentTypes` | Stack for circular detection |
| `target` | 'serialize' \| 'deserialize' |
| `path` | Current path for error messages |
| `registry` | Template registry being used |
| `namingStrategy` | Property naming conversion |
| `jitStack` | Circular reference tracking |

**fork() Method (Nested Serialization):**
- Shared: compilerContext, registry, namingStrategy, jitStack, parentTypes
- Cloned: path, handledAnnotations, template (empty)

**TemplateRegistry Caching:**
- Templates per ReflectionKind
- Class-specific templates via `classTemplates: Map<ClassType, Template[]>`
- Cache key: `registry.id + '_' + namingStrategy.id + '_' + path`

### 27. Tuple Types

**Type Structures:**
```typescript
interface TypeTuple { types: TypeTupleMember[]; }
interface TypeTupleMember { type: Type; optional?: true; name?: string; }
interface TypeRest { type: Type; }
```

**Tuple Variations:**
- Fixed: `[string, number]` → 2 TypeTupleMember
- Optional: `[string, number?]` → member.optional = true
- Rest: `[string, ...number[]]` → member.type = TypeRest
- Named: `[name: string, age: number]` → member.name = 'name'

**Serialization (serializeTuple):**
- Fixed elements: indexed access
- Rest at start/end/middle: for-loop with `restEndOffset`
- Named tuples: names used in error paths

**Validation:**
- `isArray()` first
- Length checking (unless has rest)
- Per-element type guards

### 28. Index Signatures and Mapped Types

**Index Signature Handling:**
```typescript
interface TypeIndexSignature {
    index: Type;  // Key type (string, number, symbol, templateLiteral)
    type: Type;   // Value type
}
```

**Index Check Generation:**
```typescript
// String: 'string' === typeof i
// Number: isNumeric(i)
// Symbol: 'symbol' === typeof i
// Template literal: extendTemplateLiteral(...)
```

**Sorting Priority:** Literals → Numbers → Strings/Symbols

**Mapped Types (processor.ts handleMappedType):**
- Iterates source type members
- Evaluates mapped type expression
- Simple index → indexSignature
- Literal index → propertySignature

**MappedModifier:**
```typescript
enum MappedModifier {
    optional = 1 << 0,       // Partial<T>
    removeOptional = 1 << 1, // Required<T>
    readonly = 1 << 2,       // Readonly<T>
    removeReadonly = 1 << 3, // -readonly
}
```

**Standard Library Types:**
- `Record<K, V>` → index signature
- `Partial<T>` → all optional
- `Required<T>` → remove optional
- `Readonly<T>` → add readonly
- `Pick<T, K>` → filter properties
- `Omit<T, K>` → exclude properties

**Excess Property Checking:**
- NOT performed by default
- Non-matching properties → undefined

---

## Features At Risk Summary

| Feature | Risk Level | Reason |
|---------|------------|--------|
| **Reference serialization (type-driven)** | MEDIUM | Already implemented (4b8e3102). Must preserve: `& Reference` → FK, `& Reference & Inline` → nested. No `isReferenceInstance()` checks. |
| **Embedded flattening** | HIGH | Property name computation, prefix logic |
| **Union validation fallthrough** | HIGH | Complex scoring + error tracking |
| **Specificality system** | HIGH | 10+ levels with context-specific ranges |
| **Circular reference detection** | HIGH | JitStack + runtime stack tracking |
| **Error path tracking** | HIGH | RuntimeCode for dynamic segments |
| **TemplateState infrastructure** | HIGH | Central to all JIT, fork() must preserve state correctly |
| **Generic type instantiation** | HIGH | Non-cached, program.frame.inputs resolution |
| **Class-level validators** | MEDIUM | `@t.validator` reflection |
| **Serialization groups** | MEDIUM | Runtime filtering logic |
| **Naming strategies** | MEDIUM | Bidirectional name mapping |
| **Integer clamping** | MEDIUM | Type-specific min/max |
| **Template literal validation** | MEDIUM | Dynamic regex generation |
| **Change detection** | MEDIUM | Property-by-property comparison |
| **Snapshot creation** | MEDIUM | Deep cloning with type awareness |
| **Binary data handling** | MEDIUM | Base64 encoding, memory management |
| **Tuple rest elements** | MEDIUM | Rest at start/middle/end handling |
| **Mapped type modifiers** | MEDIUM | optional/removeOptional/readonly |
| **Large union optimization** | MEDIUM | Set.has() for 50+ literal members |
| **Index signature sorting** | MEDIUM | Number before string precedence |
| **Conditional type resolution** | MEDIUM | distribute op, infer handling |
| **Cross-package TemplateState usage** | CRITICAL | BSON, SQL, Mongo directly instantiate |
| **Template literal CartesianProduct** | MEDIUM | Exponential union expansion |
| **toFastProperties() optimization** | HIGH | V8 hidden class stability |
| **Monomorphic variable pattern** | HIGH | _context.varName for undefined |
| **ReflectionClass API** | MEDIUM | Must preserve or migrate carefully |
| **@t.serialize/@t.deserialize** | MEDIUM | Custom transformer functions |
| **disableConstructor** | MEDIUM | Object.create vs new |
| **Path resolution** | LOW | Straightforward traversal |
| **Default values** | LOW | Property initializer execution |
| **Exclusions** | LOW | Simple annotation check |
| **Named tuple elements** | LOW | Names in error paths |

---

## Additional Capability Sections (Round 2)

### 29. Decorator-Based Features

**@entity Decorator Options:**
```typescript
@entity
  .name('user')           // Unique entity name
  .collection('users')    // Database table/collection
  .disableConstructor()   // Skip constructor when deserializing
  .databaseSchema('mydb') // Database schema name
  .index(['a', 'b'], {unique: true})  // Multi-field indexes
  .singleTableInheritance()  // STI pattern
```

**@t Decorator Methods:**
```typescript
@t
  .type<T>()                    // Override property type at runtime
  .validator                     // Mark method as class-level validator
  .validate(...validators)       // Add property validators
  .serialize(fn)                 // Custom serialization function
  .deserialize(fn)               // Custom deserialization function
  .data('key', value)            // Arbitrary property metadata
```

**disableConstructor Behavior:**
- When `true`: `Object.create(classType.prototype)` instead of `new classType()`
- Default values still applied via property assignments
- Constructor body NOT executed

### 30. ReflectionClass API (CRITICAL)

**Key Methods for Serializer:**
| Method | Purpose |
|--------|---------|
| `ReflectionClass.from(type)` | Factory with caching |
| `getProperties()` | All properties |
| `getProperty(name)` | Single property (throws if not found) |
| `getPrimary()` | Primary key property |
| `getPrimaries()` | All primary keys |
| `getConstructorOrUndefined()` | Constructor parameters |
| `getMethodParameters(name)` | Method parameter types |
| `disableConstructor` | Object creation strategy |
| `getReferences()` | All Reference/BackReference properties |
| `getJitContainer()` | JIT function cache |
| `hasCircularReference()` | For stack tracking |

**Caching Levels:**
1. `classType.prototype[reflectionClassSymbol]` - Class prototype level
2. `getTypeJitContainer(type).reflectionClass` - Type-level for generics/object literals
3. `type.jit` - JIT container on Type object

**Downstream Usage:**
- ORM: Identity map, primary key extraction
- SQL: Query building, table names
- BSON: Reference serialization
- Injector: Constructor parameter resolution
- HTTP/RPC: Method parameter types

### 31. Conditional Types and Infer

**ReflectionOp Operations:**
- `extends` - Evaluates `T extends U` → boolean
- `condition` - Simple conditional (pops true/false types)
- `jumpCondition` - Branches to co-routine based on extends result
- `distribute` - Loops over union members for distributive conditionals
- `infer` - Creates TypeInfer with `set(type)` callback
- `widen` - Widens literals for infer contexts

**Distributive Behavior:**
```typescript
// Distributive (naked T)
type OnlyStrings<T> = T extends string ? T : never;
OnlyStrings<'a' | 'b' | number>  // → 'a' | 'b'

// Non-distributive (wrapped)
type DisabledDistribution<T> = [T] extends [string] ? T[] : never;
DisabledDistribution<'a' | 'b'>  // → ('a' | 'b')[]
```

**Infer Handling:**
- `TypeInfer.set(type)` callback stores inferred type
- Multiple infers: Creates union (or intersection for parameters)
- Supported in: tuples (`[infer F, ...infer R]`), template literals, functions

### 32. Complete Type Annotation Inventory

**Database/ORM:**
| Annotation | Definition | Effect |
|------------|------------|--------|
| `PrimaryKey` | `TypeAnnotation<'primaryKey'>` | Marks primary key |
| `AutoIncrement` | `TypeAnnotation<'autoIncrement'>` | Auto-increment PK |
| `UUID` | `string & TypeAnnotation<'UUIDv4'>` | UUID format |
| `MongoId` | `string & TypeAnnotation<'mongoId'>` | ObjectID format |
| `NanoId` | `string & TypeAnnotation<'nanoid'>` | NanoID format |
| `Reference<Opts>` | FK relationship | Serializes as PK only |
| `BackReference<Opts>` | Inverse FK | Many-to-many via pivot |
| `Inline<Opts>` | Serialize nested | Override Reference behavior |
| `Embedded<T, Opts>` | Flatten properties | Prefix option |
| `Index<Opts>` / `Unique<Opts>` | Database index | `IndexOptions` |
| `DatabaseField<Opts>` | Column config | Per-database |

**Serialization Control:**
| Annotation | Definition | Effect |
|------------|------------|--------|
| `MapName<Alias, Serializer?>` | Name mapping | Per-serializer |
| `Group<Name>` | Grouping | Selective serialization |
| `Excluded<Name?>` | Exclusion | Skip in serialization |
| `Data<Name, Value>` | Metadata | Runtime accessible |
| `ResetAnnotation<Name>` | Reset | Remove annotation |

**Integer Types:**
`integer`, `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`, `float`, `float32`, `float64`

**BigInt:**
`BinaryBigInt` (unsigned), `SignedBinaryBigInt` (signed)

**Validators:**
`Pattern<T>`, `Alpha`, `Alphanumeric`, `Ascii`, `Decimal<Min, Max>`, `MultipleOf<N>`,
`MinLength<N>`, `MaxLength<N>`, `Includes<T>`, `Excludes<T>`, `Minimum<T>`, `Maximum<T>`,
`Positive`, `Negative`, `PositiveNoZero`, `NegativeNoZero`, `ExclusiveMinimum<T>`,
`ExclusiveMaximum<T>`, `BeforeDate<T>`, `AfterDate<T>`, `BeforeNow`, `AfterNow`, `Email`,
`Validate<Fn, Opts?>`

### 33. JIT Caching Architecture

**Cache Locations:**
1. `packed.__type` - Type object on bytecode (non-generic only)
2. `type.jit[id]` - JIT functions per registry+namingStrategy+path
3. `classType.prototype[reflectionClassSymbol]` - ReflectionClass
4. `processor.cache[]` - Session-scoped during type computation

**Cache Key Pattern:**
```typescript
const id = registry.id + '_' + namingStrategy.id + '_' + path;
jit[id] = createSerializeFunction(...);
```

**When Caching is Disabled:**
- Generics with type arguments (`inputs.length > 0`)
- Inlined types (`options.inline === true`)
- Non-reuseCached mode (returns shallow clone)

**V8 Optimization:**
- `toFastProperties(jit)` after cache writes
- Ensures stable hidden class for JIT container

---

## Union Serialization Test Matrix

This section provides the **test oracle** for union behavior across all serialization contexts. Every test case here MUST pass after the rewrite.

### Context Summary

| Context | Mode | `loosely` | Source Format | Key Characteristics |
|---------|------|-----------|---------------|---------------------|
| HTTP Query String | deserialize | `true` | All strings | `?limit=123` becomes number 123 |
| HTTP URL Path | deserialize | `true` | All strings | `/user/123` becomes number 123 |
| HTTP JSON Body | deserialize | `true` (default) | JSON types | Dates as ISO strings or timestamps |
| CLI Arguments | deserialize | `true` | All strings | `--count 5` becomes number 5 |
| JSON Serialize | serialize | N/A | JS types | Dates become ISO strings |
| JSON Deserialize | deserialize | `true` (default) | JSON types | Standard JSON round-trip |
| SQL Database | both | `false` | DB types | Type-specific mappings, JSON columns |
| BSON/MongoDB | both | `false` | Binary | ObjectId, Binary, strict types |
| Validation (`is()`) | validate | `strict` | JS types | Only specificality=1 guards |

### Specificality Quick Reference

| Specificality | Purpose | Examples |
|---------------|---------|----------|
| **-0.9 to -0.5** | Loose coercion | `'123'` -> number, `'true'` -> boolean |
| **0.5** | Priority guard (JSON) | ISO string -> Date |
| **1** | Strict JS type check | `'number' === typeof x` |
| **1.5** | Fallback priority | number -> Date |
| **2** | Standard fallback | string-to-anything |
| **10+** | Last resort | binary as string |
| **20** | Catch-all | `any` matches anything |
| **50** | Ultimate fallback | string accepts non-null |

**Key Rules:**
- `validation='strict'` only uses specificality=1
- `serialize` skips specificality < 1
- `deserialize` uses all specificalities when `loosely=true`

---

### Test Cases: Primitive Unions

#### Case 1: `string | number` with input `"123"` (string value)

| Context | Result | Notes |
|---------|--------|-------|
| HTTP Query (`loosely=true`) | **number (C)** | Numeric string coerced to number |
| HTTP JSON Body | **string** | Already valid JSON string |
| JSON Deserialize | **string** | Valid as string, no coercion needed |
| SQL/BSON Deserialize | **string** | Strict: string matches first |
| Validation (`is()`) | **string** | Strict mode: `typeof === 'string'` |

#### Case 2: `string | number` with input `123` (number value)

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **number** | Native number matches |

#### Case 3: `string | boolean` with input `"true"` (string value)

| Context | Result | Notes |
|---------|--------|-------|
| HTTP Query (`loosely=true`) | **boolean (C)** | `'true'` -> `true` at specificality -0.9 |
| HTTP JSON Body | **string** | Valid JSON string |
| JSON Deserialize | **string** | Valid as string |
| Validation (`is()`) | **string** | Strict: matches string type |

#### Case 4: `number | boolean` with input `"1"` (string value)

| Context | Result | Notes |
|---------|--------|-------|
| HTTP Query (`loosely=true`) | **number (C)** | isNumeric() at -0.5 beats boolean's -0.9 |
| HTTP JSON Body | **FAIL** | No string in union |
| Validation (`is()`) | **FAIL** | Neither matches strict |

---

### Test Cases: Date Unions

#### Case 5: `string | Date` with input `"2024-01-01T00:00:00Z"` (ISO string)

| Context | Result | Notes |
|---------|--------|-------|
| HTTP Query (`loosely=true`) | **Date (C)** | Date guard at 0.5 matches ISO string |
| HTTP JSON Body | **Date (C)** | JSON standard: ISO string -> Date |
| JSON Deserialize | **Date (C)** | Date guard at specificality 0.5 |
| Validation (`is()`) | **string** | Strict mode: string matches at 1 |

**Key insight:** Date has a type guard at specificality 0.5 for ISO strings, which runs BEFORE string's guard at 1 during deserialization but not during strict validation.

#### Case 6: `number | Date` with input `1704067200000` (number)

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **number** | Number matches at specificality 1 |

**Note:** Date has a fallback guard at specificality 1.5 for numbers, but number's guard at 1 matches first.

---

### Test Cases: Object Unions

#### Case 7: `{a: number} | {b: string}` with input `{a: 1}`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **{a: number}** | Property `a` matches, score > 0 |

#### Case 8: `{a: number} | {a: number, b?: string}` with input `{a: 1}`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **{a: number}** | First matching type wins (equal scores) |

#### Case 9: `{a: number} | {a: number, b?: string}` with input `{a: 1, b: "x"}`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **{a: number, b?: string}** | Higher score (2 properties match) |

#### Case 10: Discriminated Union `{type: 'a', x: number} | {type: 'b', y: string}` with input `{type: 'a', x: 1}`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **{type: 'a', x: number}** | Literal 'a' provides quick discrimination |

---

### Test Cases: Unions with Validation Annotations

#### Case 11: `(string & MinLength<3>) | number` with input `"ab"` (2 chars)

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **FAIL: MinLength** | String matches type, then validation fails |

**Important:** Type matching happens FIRST, then validation annotations run.

#### Case 12: `(number & Positive) | (number & Negative)` with input `5`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **number & Positive** | First member matches type and validation |

#### Case 13: `(number & Positive) | (number & Negative)` with input `-5`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **number & Negative** | Second member: Positive fails, Negative passes |

**Validation in unions:** When first member's type matches but validation fails, try next members. Only if ALL fail, report best-match errors.

---

### Test Cases: Validation-Aware Resolution (CRITICAL)

#### Case 14: `(string & MinLength<3>) | (number & Positive)` with input `"5"` (loose mode)

| Step | Action | Result |
|------|--------|--------|
| 1 | Try number (spec -0.5) | Coerces "5" → 5 |
| 2 | Validate Positive | 5 >= 0 → PASS |
| **Final** | **number: 5** | |

#### Case 15: `(string & MinLength<3>) | (number & Positive)` with input `"-5"` (loose mode)

| Step | Action | Result |
|------|--------|--------|
| 1 | Try number (spec -0.5) | Coerces "-5" → -5 |
| 2 | Validate Positive | -5 < 0 → FAIL |
| 3 | Try string (spec 1) | "-5" is string |
| 4 | Validate MinLength<3> | length 2 < 3 → FAIL |
| **Final** | **FAIL: Positive** | Best structural match was number |

#### Case 16: Branded types `Email | Username`

```typescript
type Email = string & Pattern</@/> & MaxLength<255>;
type Username = string & Pattern</^[a-z]+$/> & MinLength<3> & MaxLength<20>;
```

| Input | Expected Member | Result |
|-------|-----------------|--------|
| `"user@example.com"` | `Email` | PASS (has @) |
| `"johndoe"` | `Username` | PASS (lowercase only) |
| `"ab"` | `Username` | FAIL: MinLength |
| `"User123"` | FAIL both | Neither pattern matches |

---

### Test Cases: Loose Coercion with Validation (HTTP Query)

#### Case 17: `SearchLimit | SearchQuery` with query params

```typescript
type SearchLimit = number & Positive & Maximum<100>;
type SearchQuery = string & MinLength<2>;
type SearchParam = SearchLimit | SearchQuery;
```

| Input String | Coercion | Candidate | Validation | Final Result |
|--------------|----------|-----------|------------|--------------|
| `"50"` | → 50 | SearchLimit | Positive ✓, Max<100> ✓ | **50 (number)** |
| `"150"` | → 150 | SearchLimit | Max<100> ✗ → try string | MinLength ✓ | **"150" (string)** |
| `"hi"` | not numeric | SearchQuery | MinLength<2> ✓ | **"hi" (string)** |
| `"x"` | not numeric | SearchQuery | MinLength<2> ✗ | **FAIL: MinLength** |
| `"-5"` | → -5 | SearchLimit | Positive ✗ → try string | MinLength ✓ | **"-5" (string)** |

**Key insight:** When number validation fails, fall back to trying string (which keeps original value).

---

### Test Cases: Edge Cases

#### Case 18: `string | number | boolean` with input `"true"`

| Context | Result | Notes |
|---------|--------|-------|
| HTTP Query (`loosely=true`) | **boolean (C)** | `'true'` -> boolean at -0.9 |
| HTTP JSON Body | **string** | Valid JSON string |
| Validation (`is()`) | **string** | Strict: string matches |

#### Case 19: `string | any` with input `{complex: true}`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **any** | `any` matches at specificality 20 |

#### Case 20: `Date | null` with input `null`

| Context | Result | Notes |
|---------|--------|-------|
| All contexts | **null** | `null` literal matches |

---

### Algorithm Specification

#### Phase 1: Discriminator Detection (O(1) fast path)

```
IF all union members are objects with a common literal property:
    Use switch on discriminator value
    RETURN matching member or FAIL
```

#### Phase 2: Primitive Shortcut

```
IF input is primitive AND union has matching primitive type:
    FOR each specificality level (sorted by context rules):
        IF guard matches:
            candidate = {member, specificality}
            BREAK to validation
```

#### Phase 3: Object Scoring

```
FOR each object member:
    score = 0
    FOR each property in member:
        IF property in input AND type matches:
            score += 1
        ELSE IF required:
            REJECT member

    extraFields = count(input keys not in member)
    finalScore = (score * 1000) + (normalizedSpec * 10) - (extraFields * 5)

    IF finalScore > bestScore:
        bestCandidate = member
```

#### Phase 4: Validation with Fallthrough

```
FOR each candidate (by score descending):
    errors = validate(input, candidate.member)
    IF no errors:
        RETURN SUCCESS with candidate.member
    ELSE:
        track as potentialMatch with errors

IF no valid candidate:
    RETURN FAIL with closest match's errors
```

---

### Specificality Ranges by Context

| Context | Min Spec | Max Spec | Notes |
|---------|----------|----------|-------|
| HTTP Query/Path | -0.9 | 50 | Full loose mode |
| HTTP JSON Body | -0.5 | 50 | Slightly less loose (preserve explicit types) |
| CLI Args | -0.9 | 50 | Full loose mode |
| JSON Deserialize | configurable | configurable | Default: 0.5 to 50 |
| SQL/BSON | 1 | 1 | Strict only |
| Validation (`is()`) | 1 | 1 | Strict only |
| Serialize | 1 | 50 | No loose, yes fallback |

---
