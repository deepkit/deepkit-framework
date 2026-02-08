# Exec Mode Redesign: Operation Tree Architecture

## Current Problem

The current Exec mode implementation conflates building and executing:

```typescript
// Current: ExecSlot captures values via closures
class ExecSlot<T> {
    constructor(private thunk: () => T) {}

    get value(): T {
        return this.thunk(); // Closure captures specific values
    }
}

// When building:
const inputSlot = new ExecSlot(() => actualData); // Captures actualData
const result = new ExecSlot(() => inputSlot.value.name); // Captures inputSlot
```

For recursive types, when we evaluate `result.value`, it may trigger building more slots, which evaluate more slots, causing infinite recursion.

## Proposed Solution: Operation Tree

Build an **operation tree** (like an AST) that describes computation without capturing values. Execute the tree by walking it with actual inputs.

### Core Interfaces

```typescript
/**
 * Execution context holds input values and provides evaluation.
 */
interface ExecRuntime {
    /** Get an input value by name */
    getInput(name: string): any;

    /** Execute an operation */
    run<T>(op: Operation<T>): T;
}

/**
 * Base interface for all operations.
 * Operations describe computation without capturing values.
 */
interface Operation<T> {
    /** Execute this operation with the given runtime */
    execute(runtime: ExecRuntime): T;
}
```

### Operation Implementations

```typescript
// Reference to an input parameter
class InputRef<T> implements Operation<T> {
    constructor(readonly name: string) {}

    execute(runtime: ExecRuntime): T {
        return runtime.getInput(this.name);
    }
}

// Literal value
class Literal<T> implements Operation<T> {
    constructor(readonly value: T) {}

    execute(runtime: ExecRuntime): T {
        return this.value;
    }
}

// Property access: target.key
class GetProperty<T> implements Operation<T> {
    constructor(
        readonly target: Operation<any>,
        readonly key: string | Operation<string>
    ) {}

    execute(runtime: ExecRuntime): T {
        const obj = runtime.run(this.target);
        const k = typeof this.key === 'string' ? this.key : runtime.run(this.key);
        return obj?.[k];
    }
}

// Function call
class CallExpr<T> implements Operation<T> {
    constructor(
        readonly fn: Function,
        readonly args: Operation<any>[]
    ) {}

    execute(runtime: ExecRuntime): T {
        const argValues = this.args.map(a => runtime.run(a));
        return this.fn(...argValues);
    }
}

// Conditional: if (cond) then else
class Conditional<T> implements Operation<T> {
    constructor(
        readonly condition: Operation<boolean>,
        readonly thenBranch: Operation<T>,
        readonly elseBranch: Operation<T>
    ) {}

    execute(runtime: ExecRuntime): T {
        return runtime.run(this.condition)
            ? runtime.run(this.thenBranch)
            : runtime.run(this.elseBranch);
    }
}

// Object creation: { key1: val1, key2: val2 }
class ObjectExpr<T> implements Operation<T> {
    constructor(readonly entries: [string | Operation<string>, Operation<any>][]) {}

    execute(runtime: ExecRuntime): T {
        const result: any = {};
        for (const [key, value] of this.entries) {
            const k = typeof key === 'string' ? key : runtime.run(key);
            result[k] = runtime.run(value);
        }
        return result;
    }
}

// Array map: arr.map(fn)
class MapExpr<T> implements Operation<T[]> {
    constructor(
        readonly array: Operation<any[]>,
        readonly elementName: string,
        readonly indexName: string,
        readonly body: Operation<T>
    ) {}

    execute(runtime: ExecRuntime): T[] {
        const arr = runtime.run(this.array);
        return arr.map((elem, idx) => {
            // Create child runtime with element bindings
            const childRuntime = runtime.withBindings({
                [this.elementName]: elem,
                [this.indexName]: idx,
            });
            return childRuntime.run(this.body);
        });
    }
}

// Mutable variable
class VarRef<T> implements Operation<T> {
    private value: T;

    constructor(initial: Operation<T>) {
        this.initialOp = initial;
    }

    execute(runtime: ExecRuntime): T {
        return this.value;
    }

    initialize(runtime: ExecRuntime): void {
        this.value = runtime.run(this.initialOp);
    }

    set(runtime: ExecRuntime, valueOp: Operation<T>): void {
        this.value = runtime.run(valueOp);
    }
}
```

### Statement Operations (Side Effects)

```typescript
// Sequence of statements
class Block implements Operation<void> {
    constructor(readonly statements: Statement[]) {}

    execute(runtime: ExecRuntime): void {
        for (const stmt of this.statements) {
            stmt.execute(runtime);
            if (runtime.hasEarlyReturn()) break;
        }
    }
}

// Property assignment: target.key = value
class SetProperty implements Statement {
    constructor(
        readonly target: Operation<any>,
        readonly key: string | Operation<string>,
        readonly value: Operation<any>
    ) {}

    execute(runtime: ExecRuntime): void {
        const obj = runtime.run(this.target);
        const k = typeof this.key === 'string' ? this.key : runtime.run(this.key);
        obj[k] = runtime.run(this.value);
    }
}

// Conditional statement
class IfStatement implements Statement {
    constructor(
        readonly condition: Operation<boolean>,
        readonly thenBlock: Statement[],
        readonly elseBlock?: Statement[]
    ) {}

    execute(runtime: ExecRuntime): void {
        if (runtime.run(this.condition)) {
            for (const stmt of this.thenBlock) {
                stmt.execute(runtime);
                if (runtime.hasEarlyReturn()) break;
            }
        } else if (this.elseBlock) {
            for (const stmt of this.elseBlock) {
                stmt.execute(runtime);
                if (runtime.hasEarlyReturn()) break;
            }
        }
    }
}

// Loop statement
class ForLoop implements Statement {
    constructor(
        readonly array: Operation<any[]>,
        readonly elementName: string,
        readonly indexName: string,
        readonly body: Statement[]
    ) {}

    execute(runtime: ExecRuntime): void {
        const arr = runtime.run(this.array);
        for (let i = 0; i < arr.length; i++) {
            const childRuntime = runtime.withBindings({
                [this.elementName]: arr[i],
                [this.indexName]: i,
            });
            for (const stmt of this.body) {
                stmt.execute(childRuntime);
                if (runtime.hasEarlyReturn()) break;
            }
            if (runtime.hasEarlyReturn()) break;
        }
    }
}
```

### Processor: The Compiled Unit

```typescript
/**
 * A Processor is the compiled representation of a type handler.
 * It contains the operation tree and can be executed with different inputs.
 */
class Processor<T> {
    constructor(
        readonly inputNames: string[],
        readonly body: Operation<T> | Statement[],
        readonly resultOp?: Operation<T>
    ) {}

    execute(inputs: Record<string, any>): T {
        const runtime = new ExecRuntimeImpl(inputs);

        if (Array.isArray(this.body)) {
            // Statement-based body
            for (const stmt of this.body) {
                stmt.execute(runtime);
                if (runtime.hasEarlyReturn()) {
                    return runtime.getEarlyReturnValue();
                }
            }
            return this.resultOp ? runtime.run(this.resultOp) : undefined as T;
        } else {
            // Expression-based body
            return runtime.run(this.body);
        }
    }
}
```

### OpContext: Build-Time Context

```typescript
/**
 * OpContext builds operations instead of executing them.
 * This replaces ExecContext for the operation tree approach.
 */
class OpContext implements Context {
    private varCounter = 0;
    private statements: Statement[] = [];

    // Input references
    private inputRefs: Map<string, InputRef<any>> = new Map();

    getInput<T>(name: string): Operation<T> {
        let ref = this.inputRefs.get(name);
        if (!ref) {
            ref = new InputRef(name);
            this.inputRefs.set(name, ref);
        }
        return ref;
    }

    // Expressions
    lit<T>(value: T): Operation<T> {
        return new Literal(value);
    }

    get<T>(target: Operation<any>, key: string | Operation<string>): Operation<T> {
        return new GetProperty(target, key);
    }

    callExpr<T>(fn: Function, ...args: Operation<any>[]): Operation<T> {
        return new CallExpr(fn, args);
    }

    objFrom<T>(entries: Record<string, Operation<any>>): Operation<T> {
        return new ObjectExpr(Object.entries(entries));
    }

    ternary<T>(cond: Operation<boolean>, then: Operation<T>, else_: Operation<T>): Operation<T> {
        return new Conditional(cond, then, else_);
    }

    // Statements
    set(target: Operation<any>, key: string | Operation<string>, value: Operation<any>): void {
        this.statements.push(new SetProperty(target, key, value));
    }

    when(cond: Operation<boolean>, then: () => void, else_?: () => void): void {
        const savedStatements = this.statements;

        this.statements = [];
        then();
        const thenBlock = this.statements;

        let elseBlock: Statement[] | undefined;
        if (else_) {
            this.statements = [];
            else_();
            elseBlock = this.statements;
        }

        this.statements = savedStatements;
        this.statements.push(new IfStatement(cond, thenBlock, elseBlock));
    }

    loop(arr: Operation<any[]>, fn: (elem: Operation<any>, idx: Operation<number>) => void): void {
        const elemName = `_elem${this.varCounter++}`;
        const idxName = `_idx${this.varCounter++}`;

        const savedStatements = this.statements;
        this.statements = [];

        fn(this.getInput(elemName), this.getInput(idxName));
        const bodyStatements = this.statements;

        this.statements = savedStatements;
        this.statements.push(new ForLoop(arr, elemName, idxName, bodyStatements));
    }

    // Variables
    var_<T>(initial: Operation<T>): VarRef<T> {
        const varRef = new VarRef(initial);
        this.statements.push(new InitVar(varRef));
        return varRef;
    }

    setVar<T>(ref: VarRef<T>, value: Operation<T>): void {
        this.statements.push(new SetVar(ref, value));
    }

    getVar<T>(ref: VarRef<T>): Operation<T> {
        return ref;
    }

    // Build the processor
    build<T>(resultOp?: Operation<T>): Processor<T> {
        return new Processor(
            [...this.inputRefs.keys()],
            this.statements.length > 0 ? this.statements : resultOp!,
            resultOp
        );
    }
}
```

### How Recursive Types Work

With the operation tree approach, recursive types work naturally:

```typescript
// Building a processor for JSONValue (recursive union)
function buildProcessor(type: Type): Processor<any> {
    // Check cache first
    let processor = processorCache.get(type);
    if (processor) return processor;

    // Create placeholder for recursive references
    const placeholder = new ProcessorPlaceholder();
    processorCache.set(type, placeholder);

    // Build the actual processor
    const ctx = new OpContext();
    const inputOp = ctx.getInput('data');
    const resultOp = buildTypeOperations(type, inputOp, ctx);
    const actualProcessor = ctx.build(resultOp);

    // Resolve placeholder
    placeholder.resolve(actualProcessor);

    return actualProcessor;
}

// When building JSONObject which contains JSONValue:
// 1. We encounter JSONValue recursively
// 2. We get the placeholder from cache
// 3. We create an InvokeProcessor operation that references the placeholder
// 4. When executed, the placeholder is already resolved to the actual processor
```

### ProcessorPlaceholder for Recursive Types

```typescript
class ProcessorPlaceholder<T> implements Processor<T> {
    private resolved?: Processor<T>;

    resolve(processor: Processor<T>): void {
        this.resolved = processor;
    }

    execute(inputs: Record<string, any>): T {
        if (!this.resolved) {
            throw new Error('Processor not yet resolved');
        }
        return this.resolved.execute(inputs);
    }
}

class InvokeProcessor<T> implements Operation<T> {
    constructor(
        readonly processor: Processor<T> | ProcessorPlaceholder<T>,
        readonly inputs: Record<string, Operation<any>>
    ) {}

    execute(runtime: ExecRuntime): T {
        const inputValues: Record<string, any> = {};
        for (const [name, op] of Object.entries(this.inputs)) {
            inputValues[name] = runtime.run(op);
        }
        return this.processor.execute(inputValues);
    }
}
```

## Benefits of This Approach

1. **Clean separation**: Build phase creates operations, execute phase runs them
2. **Natural recursion**: Processors reference other processors, not build callbacks
3. **No reset/rebind**: Each execution starts fresh with new inputs
4. **Predictable performance**: No lazy evaluation surprises
5. **Easier debugging**: Can inspect the operation tree
6. **Type-safe**: Operations are strongly typed

## Migration Path

1. Create new `Operation` and `Processor` types alongside existing code
2. Create `OpContext` that implements `Context` interface
3. Update `jit.fn` to detect when building for Exec mode and use `OpContext`
4. Gradually migrate handlers to work with operation-based approach
5. Remove `ExecSlot` and related hotfixes

## Comparison with Current Approach

| Aspect | Current (ExecSlot) | Proposed (Operation Tree) |
|--------|-------------------|---------------------------|
| Build output | Lazy thunks | Operation nodes |
| Value capture | Via closures | Via runtime lookup |
| Recursion | Needs guards/reset | Natural via placeholders |
| Reusability | Needs slot reset | Always reusable |
| Debugging | Opaque thunks | Inspectable tree |
| Performance | Lazy (sometimes wasteful) | Eager (predictable) |

## Implementation Priority

1. **Phase 1**: Define core `Operation` types and `ExecRuntime`
2. **Phase 2**: Implement `OpContext` with basic operations
3. **Phase 3**: Add statement operations (when, loop, var)
4. **Phase 4**: Implement `Processor` and placeholder mechanism
5. **Phase 5**: Integrate with `jit.fn` for Exec mode
6. **Phase 6**: Remove `ExecSlot` and hotfixes
