# V8 Bytecode Analysis for Object Building

## TL;DR

- Direct return `return {...}` is 25% faster than `var s3={...}; return s3;`
- Adding properties conditionally triggers hidden class transitions (54% overhead)
- V8 uses `SetNamedProperty` for post-creation additions (slower than `DefineNamedOwnProperty`)

## Bytecode Comparison

### 1. Direct Return (Optimal)

```javascript
function directReturn(s0) {
  return { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
}
```

**Bytecode (40 bytes, 1 register):**

```
CreateObjectLiteral [0], [0], #41    ; Create object boilerplate
Star0                                 ; Store directly to r0 (return register)
GetNamedProperty a0, [1], [1]         ; Get s0.tags
DefineNamedOwnProperty r0, [1], [3]   ; Set tags on r0
GetNamedProperty a0, [2], [5]         ; Get s0.priority
DefineNamedOwnProperty r0, [2], [7]   ; Set priority
GetNamedProperty a0, [3], [9]         ; Get s0.id
DefineNamedOwnProperty r0, [3], [11]  ; Set id
GetNamedProperty a0, [4], [13]        ; Get s0.name
DefineNamedOwnProperty r0, [4], [15]  ; Set name
Ldar r0                               ; Load r0 to accumulator
Return                                ; Return accumulator
```

**Performance: 23.4M ops/s**

### 2. Variable + Return (25% slower)

```javascript
function varThenReturn(s0) {
  var s3 = { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
  return s3;
}
```

**Bytecode (43 bytes, 2 registers):**

```
CreateObjectLiteral [0], [0], #41
Star1                                 ; Store to r1 (NOT return register!)
GetNamedProperty a0, [1], [1]
DefineNamedOwnProperty r1, [1], [3]   ; All operations on r1
GetNamedProperty a0, [2], [5]
DefineNamedOwnProperty r1, [2], [7]
GetNamedProperty a0, [3], [9]
DefineNamedOwnProperty r1, [3], [11]
GetNamedProperty a0, [4], [13]
DefineNamedOwnProperty r1, [4], [15]
Mov r1, r0                            ; *** EXTRA: Copy r1 to r0 ***
Ldar r0
Return
```

**Performance: 17.5M ops/s (25% slower)**

The extra `Mov r1, r0` instruction and the extra register allocation add overhead.

### 3. With Optional Property (54% slower)

```javascript
function withOptional(s0) {
  var s3 = { tags: s0.tags, priority: s0.priority, id: s0.id, name: s0.name };
  if ('ready' in s0) {
    s3.ready = s0.ready ?? null;
  }
  return s3;
}
```

**Bytecode (69 bytes, 2 registers):**

```
; ... same as varThenReturn for base object ...

LdaConstant [5]                       ; Load "ready" string
Star1
Ldar a0
TestIn r1, [17]                       ; Test "ready" in s0
JumpIfFalse [18]                      ; Skip if not present

; *** Adding property after creation ***
GetNamedProperty a0, [5], [19]        ; Get s0.ready
Mov r0, r1
JumpIfUndefinedOrNull [4]             ; Null coalescing
Jump [3]
LdaNull
SetNamedProperty r1, [5], [21]        ; *** Uses SetNamedProperty (triggers HC transition) ***

Ldar r0
Return
```

**Performance:**

- With property present: 10.8M ops/s (54% slower than direct)
- Without property: 17.0M ops/s (27% slower, same as varThenReturn)

## Why SetNamedProperty is Slower

`DefineNamedOwnProperty` is used during object creation - V8 knows the final shape.

`SetNamedProperty` is used for post-creation modifications:

1. Checks if property already exists
2. Triggers hidden class transition if adding new property
3. May invalidate inline caches

## Hidden Class Transitions

When `withOptional` produces objects with different shapes:

- Input WITH ready: `{tags, priority, id, name, ready}` → Hidden Class A
- Input WITHOUT ready: `{tags, priority, id, name}` → Hidden Class B

This causes:

1. **Polymorphism** - Function produces multiple object shapes
2. **IC pollution** - Inline caches must handle multiple maps
3. **Deoptimization** - V8 may fall back to dictionary mode

V8 trace output shows `wrong map` deoptimization:

```
[bailout (kind: deopt-lazy, reason: wrong map): begin...]
```

## Recommendations

1. **Use direct return for all-required types:**

   ```javascript
   // Good: 23M ops/s
   return {a: s0.a, b: s0.b, c: s0.c};

   // Bad: 17M ops/s
   var s3 = {a: s0.a, b: s0.b, c: s0.c};
   return s3;
   ```

2. **Accept hidden class transition cost for optional properties:**

   - The `var s3={...}; if (cond) s3.opt = val; return s3;` pattern is unavoidable
   - Alternative (spread) is even worse due to object copying

3. **Minimize polymorphism where possible:**
   - Consider always including optional properties as `undefined` if performance is critical
   - But this increases object size and may not be desirable

## Test Commands

```bash
# Print bytecode
node --allow-natives-syntax --print-bytecode --print-bytecode-filter=functionName file.js

# Trace deoptimizations
node --trace-deopt --allow-natives-syntax file.js

# Optimization status
node --allow-natives-syntax file.js
# Then use %GetOptimizationStatus(fn) in code
```

## Optimization Status Flags

```
1   = function
2   = never_optimized
4   = always_optimized
8   = maybe_deopted
16  = OPTIMIZED
32  = TURBOFAN
64  = interpreted
128 = MAGLEV
256 = sparkplug
```
