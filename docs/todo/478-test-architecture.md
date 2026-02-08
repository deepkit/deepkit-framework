# Issue #478: Test Architecture

## Design Principles

1. **Systematic Coverage**: Test matrix covering all combinations of literal types × operations × contexts
2. **Isolation**: Each test case tests ONE specific behavior
3. **Clarity**: Test names describe exactly what is being tested
4. **Regression Prevention**: Tests for bugs found during analysis

---

## Test Structure

### 1. Type Package Tests (`packages/type/tests/serializer.spec.ts`)

#### Section A: Literal Type Varieties
```typescript
describe('literal union - type varieties', () => {
    test('string literals');
    test('number literals');
    test('boolean literals (true | false)');
    test('bigint literals');
    test('mixed string + number');
    test('mixed string + boolean');
    test('mixed number + boolean');
    test('mixed string + number + boolean');
    test('single-member literal');
});
```

#### Section B: Edge Cases
```typescript
describe('literal union - edge cases', () => {
    test('empty string in union');
    test('zero vs string zero (0 | "0")');
    test('all-falsy union (false | 0 | "")');
    test('negative number literals');
    test('float literals');
    test('unicode string literals');
    test('special characters (newline, tab)');
});
```

#### Section C: Contexts
```typescript
describe('literal union - contexts', () => {
    test('root level (not in object)');
    test('object property');
    test('array of literals');
    test('tuple with literal');
    test('nested object property');
    test('optional property');
    test('multiple union properties');
});
```

#### Section D: Operations
```typescript
describe('literal union - operations', () => {
    test('serialize valid');
    test('serialize invalid throws');
    test('deserialize valid');
    test('deserialize invalid throws');
    test('deserialize loosely:true coercion');
    test('deserialize loosely:false strict');
    test('validate valid returns empty');
    test('validate invalid returns errors');
    test('cast valid');
    test('cast invalid throws');
    test('is() returns true/false');
});
```

#### Section E: Error Messages
```typescript
describe('literal union - error messages', () => {
    test('error uses stringifyValueWithType format');
    test('error includes value field');
    test('error path for nested property');
    test('error path for array element');
    test('error message shows expected type');
});
```

---

### 2. BSON Package Tests (`packages/bson/tests/bson-serialize.spec.ts`)

#### Section A: Serialization
```typescript
describe('BSON literal union - serialization', () => {
    test('string literals only');
    test('number literals only');
    test('boolean literals only');
    test('mixed string + number');
    test('mixed string + number + boolean');
    test('invalid value throws');
});
```

#### Section B: Sizing
```typescript
describe('BSON literal union - sizing', () => {
    test('sizer matches serializer output length');
    test('sizer throws for invalid value');
});
```

#### Section C: Round-Trip
```typescript
describe('BSON literal union - round-trip', () => {
    test('string literal preserves value');
    test('number literal preserves value');
    test('boolean literal preserves value');
    test('mixed literals preserve values');
});
```

#### Section D: Contexts
```typescript
describe('BSON literal union - contexts', () => {
    test('as object property');
    test('in array');
    test('in nested object');
    test('multiple properties');
});
```

#### Section E: Error Messages
```typescript
describe('BSON literal union - errors', () => {
    test('error uses stringifyValueWithType');
    test('error includes value field');
    test('serializer and sizer throw same error');
});
```

#### Section F: Performance
```typescript
describe('BSON literal union - performance', () => {
    test('large union does not stack overflow');
});
```

---

## Test Matrix

### Type × Operation Matrix

| Type | serialize | deserialize | validate | cast | is |
|------|-----------|-------------|----------|------|-----|
| `'a' \| 'b'` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `1 \| 2 \| 3` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `true \| false` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `1n \| 2n` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `'a' \| 1` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `'' \| 'a'` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `0 \| '0'` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `false \| 0 \| ''` | ✓ | ✓ | ✓ | ✓ | ✓ |

### Context × Package Matrix

| Context | Type Package | BSON Package |
|---------|--------------|--------------|
| Root level | ✓ | ✓ |
| Object property | ✓ | ✓ |
| Array element | ✓ | ✓ |
| Nested object | ✓ | ✓ |
| Tuple element | ✓ | N/A |
| Optional property | ✓ | ✓ |

---

## Implementation Order

### Phase 1: Fix Critical Bugs First
1. Empty string coercion bypass (CG1)
2. BigInt coercion (CG2) - or document as unsupported

### Phase 2: Add Type Package Tests
1. Edge cases (Section B)
2. Type varieties (Section A)
3. Contexts (Section C)
4. Error messages (Section E)

### Phase 3: Add BSON Package Tests
1. Serialization (Section A)
2. Sizing (Section B)
3. Round-trip (Section C)
4. Error messages (Section E)
5. Performance (Section F)

---

## File Locations

- Type tests: `packages/type/tests/serializer.spec.ts` (add after line 1833)
- BSON tests: `packages/bson/tests/bson-serialize.spec.ts` (add new describe block)

## Estimated Test Count

- Type Package: ~40 new tests
- BSON Package: ~25 new tests
- **Total: ~65 new tests**
