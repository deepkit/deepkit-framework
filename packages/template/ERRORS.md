# Template Errors

## DK-TPL001: No expression for optimise arguments

**Message:** No expression for optimise arguments

**Causes:**
- The TSX optimizer received an empty array of expressions to optimize
- A JSX element was processed but produced no valid expressions to render

**Solution:**
This is an internal compiler error in the template compilation process. Before reporting:

1. Ensure your JSX/TSX templates contain valid content and are not empty
2. Check that your template returns valid JSX elements
3. Clean your build output and rebuild: `npm run clean && npm run build`
4. Verify you are using compatible versions of `@deepkit/template` and TypeScript

If the issue persists after these steps, please report it with your template code as a GitHub issue.

---

## DK-TPL002: concatExpressions requires 2+ expressions

**Message:** concatExpressions requires at least 2 expressions

**Causes:**
- The expression concatenation function was called with fewer than 2 expressions
- An internal optimization step incorrectly routed a single expression to the concatenation function

**Solution:**
This is an internal compiler error in the template optimization pipeline. Before reporting:

1. Check that your template expressions are valid and not empty
2. Verify that string concatenations in your template use valid operands
3. Clean your build output and rebuild: `npm run clean && npm run build`
4. Try simplifying complex template expressions

If the issue persists after these steps, please report it with your template code as a GitHub issue.

---

## DK-TPL003: Could not build binary expression

**Message:** Could not build binary expression

**Causes:**
- The optimizer failed to construct a binary expression from the provided expressions
- The expression list became empty during the normalization process
- An unexpected state occurred during the concatenation of multiple expressions

**Solution:**
This is an internal compiler error in the TSX optimization phase. Before reporting:

1. Check that your template expressions evaluate to valid values
2. Ensure string interpolations are not producing undefined or null values unexpectedly
3. Clean your build output and rebuild: `npm run clean && npm run build`
4. Try breaking complex expressions into simpler parts

If the issue persists after these steps, please report it with your template code as a GitHub issue.

---

## DK-TPL004: Expected ObjectExpression

**Message:** Expect ObjectExpression, got {actual type}

**Causes:**
- During JSX transformation, the last argument to `Object.assign()` was not an object literal
- The JSX compiler encountered an unexpected AST node type when extracting children from props
- A spread operator or other non-object syntax was used where an object literal was expected

**Solution:**
This error occurs during the conversion of JSX to optimized render calls. Before reporting:

1. Ensure your JSX follows standard patterns with object literals for props
2. Avoid complex dynamic spreading in JSX props that might produce non-object expressions
3. Check that spread operators (`...props`) are used with actual objects
4. Clean your build output and rebuild: `npm run clean && npm run build`

Example of correct JSX prop usage:
```tsx
// Correct: Object spread with an object literal or variable
<Component {...{ prop1: value1 }} />
<Component {...myPropsObject} />

// May cause issues: Complex expressions that don't resolve to objects
<Component {...(condition ? props1 : undefined)} />
```

If the issue persists after these steps, please report it as a GitHub issue with a minimal reproduction.

---
