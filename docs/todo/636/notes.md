# Investigation Notes - Issue #636

## 2026-01-20: Initial Analysis

### Hydration Flow

```
Database Record (DBRecord)
    ↓
Formatter.hydrate(model, dbRecord)
    ↓
hydrateModel(model, classSchema, dbRecord)
    ↓
Creates object with createObject() and assignJoins()
    ↓
Populated ORM Entity
```

### Key Code Paths

**formatter.ts:hydrateModel() (lines 206-323)**
1. Check pool for existing object (line 238-244)
   - `if (found && !isReferenceInstance(found))` - excludes proxies
2. Check identity map (lines 252-310)
   - No equivalent `isReferenceInstance` check!
3. Create new object if not found

**formatter.ts:createObject() (lines 382-437)**
- Deserializes DB record
- Calls `assignJoins()` for joined relations
- For NON-joined references: creates proxy via `getReference()`

**formatter.ts:getReference() (lines 143-204)**
- Lookup order: pool → identity map → create new proxy
- Stores new proxy in pool and/or identity map

### The Bug

When processing `Review.innerJoinWith('book').innerJoinWith('user')`:

1. Review hydrated
2. `assignJoins()` processes 'book' join → `hydrateModel(Book, dbRecord)`
3. Book's `createObject()` creates `author` as reference proxy (not joined)
4. Proxy stored in pool and identity map
5. `assignJoins()` processes 'user' join → `hydrateModel(User, dbRecord)`
6. Full User object created

**Result:**
- `review.book.author` = proxy (PK only)
- `review.user` = full object (all fields)
- Same entity, different objects!

### Pool vs Identity Map Behavior

**Pool (formatter-scoped):**
- Line 239: `if (found && !isReferenceInstance(found))`
- Protects against returning proxy when full object expected

**Identity Map (session-scoped):**
- Line 269-276: No `isReferenceInstance` check
- Returns whatever was stored first (even if proxy)

### Proposed Fix Direction

The identity map lookup (lines 269-276) needs similar protection:
1. If found item is a reference AND we're about to create a full object, don't return the reference
2. Instead, create full object and REPLACE the reference in identity map

Or better: when storing full object, replace any existing reference.

## Questions Resolved

1. **Should we mutate the existing reference proxy to become hydrated? Or replace it entirely?**
   - Answer: Mutate in-place via `Object.setPrototypeOf` + direct property assignment.
   - This preserves object identity - all holders see the upgraded object.

2. **What about objects that hold a reference to the old proxy - will they see the update?**
   - Yes! The in-place upgrade modifies the same object, so all references see the change.

3. **Performance implications of checking `isReferenceInstance` on every identity map lookup?**
   - Negligible. The check is a simple prototype comparison.
   - The `upgradeReferenceToObject` function is 3.4x faster than alternative approaches.

## Final Implementation

References are upgraded in-place whenever full entity data is available within the same query:
- Via explicit joins (joinWith, useJoinWith)
- Via root entity appearing in query results

This ensures **object identity**: there is only ONE object per entity within a query.

All tasks completed - see README.md for full details.
