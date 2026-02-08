# BSON Test Cleanup Plan

## Summary of Issues Found

| Issue | Count | Severity | Files |
|-------|-------|----------|-------|
| Internal path imports | ALL | 🔴 CRITICAL | All test files |
| `AutoBuffer._buffer` access | 13 | 🔴 CRITICAL | bson-serialize.spec.ts |
| Internal utility tests | 22+ | 🟡 MEDIUM | bson-serialize.spec.ts |

## Understanding the API

**Clarification on `*WithoutOptimiser` functions:**

These are NOT "internal bypass" functions. They are **legitimate public API** for untyped BSON operations:

- `serializeBSONWithoutOptimiser(data)` - Serialize ANY JS object to BSON (no type reflection)
- `deserializeBSONWithoutOptimiser(buffer)` - Parse BSON to plain JS objects (no type coercion)

These are useful for:
- Parsing arbitrary BSON from external sources (MongoDB wire protocol)
- Creating BSON from plain objects without type definitions
- Testing the raw BSON format

**Recommendation:** Keep these in public API, but consider renaming:
- `serializeBSONWithoutOptimiser` → `encodeBSON` or `bsonEncode`
- `deserializeBSONWithoutOptimiser` → `decodeBSON` or `bsonDecode`

## Cleanup Tasks

### Task 1: Fix imports to use public index

**Problem:** Tests import from internal paths (`../src/*.js`) instead of public index.

**Solution:** Change all imports to use `../index.js`:

```typescript
// Before
import { deserializeBSON } from '../src/bson-deserializer.js';
import { deserializeBSONWithoutOptimiser } from '../src/bson-parser.js';
import { serializeBSON, serializeBSONWithoutOptimiser } from '../src/bson-serializer.js';

// After
import {
    deserializeBSON,
    deserializeBSONWithoutOptimiser,
    serializeBSON,
    serializeBSONWithoutOptimiser,
} from '../index.js';
```

**Files:**
- [ ] bson-serialize.spec.ts
- [ ] bson-parser.spec.ts
- [ ] type-spec.spec.ts
- [ ] stream.spec.ts (verify)

### Task 2: Fix AutoBuffer._buffer access

**Problem:** Tests directly access private `_buffer` property.

**Location:** bson-serialize.spec.ts lines 1631-1666

**Solution:**
- If testing buffer contents, use the public `buffer` getter
- If testing internal buffer management, delete those tests (implementation detail)

### Task 3: Remove/relocate internal utility tests

**Problem:** Tests for `hexToByte()`, `uuidStringToByte()`, `getValueSize()` test implementation details.

**Options:**
1. **Delete them** - These are internal utilities, test through public API
2. **Keep minimal smoke tests** - Just verify they don't crash
3. **Move to unit tests** - Separate file for internal unit tests (won't block rewrite)

**Recommendation:** Option 3 - Move to `tests/internal/` folder. These can be deleted when we rewrite, but won't block us.

### Task 4: Update test helpers in type-spec.spec.ts

**Problem:** `serializeToJson()` and `deserializeFromJson()` use internal APIs.

**Solution:** Rewrite helpers to use public API only:
```typescript
// Before
function serializeToJson<T>(type: ReceiveType<T>, value: T): T {
    const bson = serializeBSONWithoutOptimiser(type, value);
    return deserializeBSONWithoutOptimiser<T>(type, bson);
}

// After
function roundTrip<T>(type: ReceiveType<T>, value: T): T {
    const bson = serializeBSON<T>(value, undefined, type);
    return deserializeBSON<T>(bson, undefined, undefined, type);
}
```

## Cleanup Order

1. **Task 4 first** - Fix helpers (other tests depend on them)
2. **Task 1** - Replace WithoutOptimiser calls (bulk find/replace)
3. **Task 2** - Fix AutoBuffer access
4. **Task 3** - Move internal tests to separate folder

## Verification

After each task:
```bash
# Tests must still pass (even though build is broken, we're not changing src/)
# We'll verify after the rewrite
```

## Files After Cleanup

```
tests/
├── bson-serialize.spec.ts   # Public API serialization tests
├── bson-parser.spec.ts      # Public API parsing tests
├── type-spec.spec.ts        # Roundtrip/type tests
├── stream.spec.ts           # Streaming tests (already clean)
└── internal/                # Optional: internal utility tests
    └── utilities.spec.ts    # hexToByte, uuidStringToByte, getValueSize
```

## Status

- [x] Task 1: Fix imports to use public index (all 4 test files updated)
- [ ] Task 2: AutoBuffer._buffer access - **DEFER to rewrite** (lines 1644-1679 in bson-serialize.spec.ts)
- [ ] Task 3: Internal utility tests (hexToByte, etc.) - **DEFER to rewrite**
- [ ] Verify tests pass after rewrite

## Notes

**AutoBuffer._buffer access:**
Tests at lines 1641-1680 in bson-serialize.spec.ts test buffer reallocation behavior.
This is an implementation detail that may change in the rewrite. These tests will be
reviewed/deleted when we rewrite AutoBuffer (or remove it entirely).

**Internal utility tests:**
Tests for `hexToByte`, `uuidStringToByte` at top of bson-serialize.spec.ts test
internal utilities. These are fine to keep for now - they test functions that ARE
exported, even if they're implementation details.
