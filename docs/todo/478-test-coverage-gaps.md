# Issue #478: Test Coverage Gaps Analysis (Final)

## Overview

Comprehensive analysis from two rounds of investigation identifying all test coverage gaps.

---

## CRITICAL GAPS (Must Fix - Data Integrity Risk)

### CG1: Empty String Coercion Bypass
**Risk**: CRITICAL - Silent data corruption
**Code**: `packages/type/src/serializer.ts:2070-2074`
```typescript
// BUG: +'' === 0, so empty string passes validation for unions containing 0
deserialize<0 | 1 | 2>('')  // Should throw, but coerces to 0!
deserialize<0 | 1 | 2>(' ') // Should throw, but coerces to 0!
```

### CG2: BigInt Coercion Doesn't Work
**Risk**: CRITICAL - Feature broken
**Code**: `packages/type/src/serializer.ts:2050, 2071`
```typescript
// BUG: +value produces number, not bigint
deserialize<1n | 2n | 3n>('1', { loosely: true })  // Fails - can't coerce to bigint
```

### CG3: `loosely: false` Option Not Tested
**Risk**: CRITICAL - Unknown behavior
```typescript
deserialize<1 | 2 | 3>('1', { loosely: false })  // Should throw, not tested
```

### CG4: BSON Literal Union Serialization Not Tested
**Risk**: CRITICAL - Entire feature untested
```typescript
getBSONSerializer<'a' | 'b' | 'c'>()  // NO TESTS EXIST
getBSONSizer<'a' | 'b' | 'c'>()       // NO TESTS EXIST
```

### CG5: BSON Error Format Not Verified
**Risk**: CRITICAL - UX regression possible
```typescript
// Not verified that BSON uses stringifyValueWithType() format
// Not verified that BSON error includes 'value' field
```

---

## HIGH PRIORITY GAPS

### HP1: Pure Boolean Literal Union
```typescript
serialize<true | false>(true)   // Not tested
validate<true | false>(false)   // Not tested
```

### HP2: Single-Member Literal Type
```typescript
serialize<'only'>('only')       // Not tested - boundary case
```

### HP3: Arrays of Literal Unions
```typescript
serialize<('a' | 'b')[]>(['a', 'b'])           // Not tested
deserialize<('a' | 'b')[]>(['a', 'invalid'])   // Not tested
```

### HP4: Empty String in Literal Union
```typescript
serialize<'' | 'a' | 'b'>('')   // Not tested
```

### HP5: Zero vs String Zero
```typescript
serialize<0 | '0' | 1 | '1'>(0)    // Not tested
serialize<0 | '0' | 1 | '1'>('0')  // Not tested
```

### HP6: All-Falsy Union
```typescript
serialize<false | 0 | ''>(false)  // Not tested
serialize<false | 0 | ''>(0)      // Not tested
serialize<false | 0 | ''>('')     // Not tested
```

### HP7: BSON Round-Trip
```typescript
// Serialize then deserialize preserves literal value - not tested
```

### HP8: BSON Stack Overflow Prevention
```typescript
// Large literal union in BSON doesn't cause stack overflow - not tested
```

### HP9: Literal Union as Root Type
```typescript
serialize<'a' | 'b'>('a')  // Direct, not wrapped in object - not tested
```

### HP10: BSON Mixed Type Literals
```typescript
getBSONSerializer<'a' | 1 | true>()  // String+number+boolean - not tested
```

---

## MEDIUM PRIORITY GAPS

### MP1: Negative Number Literals
```typescript
serialize<-1 | -2 | -3>(-1)
deserialize<-1 | -2 | -3>('-1', { loosely: true })
```

### MP2: Float Literals
```typescript
serialize<1.5 | 2.5 | 3.5>(1.5)
deserialize<1.5 | 2.5 | 3.5>('1.5', { loosely: true })
```

### MP3: Unicode String Literals
```typescript
serialize<'hello' | '日本語'>('日本語')
```

### MP4: Strings with Special Characters
```typescript
serialize<'a\nb' | 'a\tb'>('a\nb')
```

### MP5: Nested Property Error Paths
```typescript
validate<{ a: { b: 'x' | 'y' } }>({ a: { b: 'invalid' } })
// Error path should be "a.b"
```

### MP6: Array Element Error Paths
```typescript
validate<('a' | 'b')[]>(['a', 'invalid', 'b'])
// Error path should be "1"
```

### MP7: Multiple Literal Union Properties
```typescript
serialize<{ a: 'x' | 'y', b: 1 | 2 }>({ a: 'x', b: 1 })
```

### MP8: Optional Literal Union Property
```typescript
serialize<{ a?: 'x' | 'y' }>({})
serialize<{ a?: 'x' | 'y' }>({ a: 'x' })
```

### MP9: Literal Union in Tuple
```typescript
serialize<[string, 'a' | 'b']>(['hello', 'a'])
```

### MP10: BSON Nested Object with Literal
```typescript
getBSONSerializer<{ outer: { inner: 'a' | 'b' } }>()
```

---

## LOW PRIORITY GAPS

### LP1: Very Large Numbers
```typescript
serialize<9007199254740991 | 9007199254740992>(9007199254740991)
```

### LP2: Object Wrapper Boxing
```typescript
deserialize<'a' | 'b'>(new String('a'))  // Should handle or error clearly
```

### LP3: NaN in Literal Union (if applicable)
```typescript
// NaN handling with Set.has()
```

### LP4: -0 vs 0 Distinction
```typescript
serialize<0 | -0 | 1>(-0)  // Probably not distinguishable
```

---

## SUMMARY

| Priority | Count | Examples |
|----------|-------|----------|
| CRITICAL | 5 | Empty string bypass, BigInt, loosely:false, BSON serialization |
| HIGH | 10 | Boolean union, single-member, arrays, falsy values |
| MEDIUM | 10 | Negative numbers, floats, unicode, error paths |
| LOW | 4 | Large numbers, object wrappers, edge cases |
| **TOTAL** | **29** | |

---

## Test Architecture (Next Step)

See `docs/todo/478-test-architecture.md` for the systematic test design.
