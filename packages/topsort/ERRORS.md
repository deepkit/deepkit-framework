# @deepkit/topsort Errors

## DK-TS001: Circular Dependency

**Message:** `Circular reference found {NodeA} -> {NodeB} -> ... -> {NodeA}`

**Causes:**
- Two or more elements depend on each other, forming a cycle
- A depends on B, B depends on C, and C depends on A
- Self-referential dependency (element depends on itself)

**Solution:**
1. Review your dependency graph to identify the cycle
2. Use the exception's `getStart()` and `getEnd()` methods to find the cycle endpoints
3. Refactor your dependencies to break the cycle:

```typescript
import { ArraySort, CircularDependencyException } from '@deepkit/topsort';

const sorter = new ArraySort<string>();
sorter.add('a', ['b']);
sorter.add('b', ['c']);
sorter.add('c', ['a']); // Creates cycle: a -> b -> c -> a

try {
    const sorted = sorter.sort();
} catch (error) {
    if (error instanceof CircularDependencyException) {
        console.log('Cycle starts at:', error.getStart());
        console.log('Cycle ends at:', error.getEnd());
        console.log('Full cycle:', error.nodes);
    }
}
```

To allow circular dependencies without throwing, set `throwCircularDependency` to `false` or use a `circularInterceptor`.

---

## DK-TS002: Element Not Found

**Message:** `Element dependency not found`

**Causes:**
- An element declares a dependency on another element that was never added to the sorter
- Typo in dependency name
- Dependency was conditionally added but the condition wasn't met

**Solution:**
1. Ensure all dependencies are added to the sorter before sorting
2. Check for typos in dependency identifiers
3. Verify conditional logic that adds dependencies:

```typescript
import { ArraySort, ElementNotFoundException } from '@deepkit/topsort';

const sorter = new ArraySort<string>();
sorter.add('a', ['b']); // 'a' depends on 'b'
// Missing: sorter.add('b');

try {
    const sorted = sorter.sort();
} catch (error) {
    if (error instanceof ElementNotFoundException) {
        console.log('Element:', error.element);
        console.log('Missing dependency:', error.dependency);
    }
}

// Fix: Add all dependencies
sorter.add('b'); // Now 'b' exists
```

---
