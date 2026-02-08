# Failing Tests Analysis (86 failures)

Analysis of test failures in `packages/type/` after the JIT/CSP refactor.

**Test Summary:** 86 failed, 1750 passed, 51 test suites (16 failed)

**Progress:** Down from 106 failures (20 tests fixed)

---

## Summary by Category

| # | Category | Count | Root Cause | Key Files |
|---|----------|-------|------------|-----------|
| 1 | Validation Not Running | 22 | Validation handlers not invoked during `is()` / `validate()` | `src/validator.ts`, `src/typeguard.ts` |
| 2 | Object/Record Serialization | 11 | Index signatures producing empty objects `{}` | `src/serializer/handlers.ts` |
| 3 | Class Instance Instantiation | 9 | Deserialize returns plain objects instead of class instances | `src/serializer/handlers.ts` |
| 4 | Union Resolution | 8 | Union type scoring/member selection failures | `src/serializer/union.ts` |
| 5 | Default Value Handling | 7 | Missing properties with defaults not populated | `src/serializer/handlers.ts` |
| 6 | NanoId Validation | 8 | NanoId pattern/length not validated | `src/validator.ts` |
| 7 | TypedArray/Binary | 5 | Base64 encoding/decoding issues | `src/serializer/handlers.ts` |
| 8 | Circular/Recursive Types | 4 | SyntaxError or incorrect behavior | `src/serializer/state.ts` |
| 9 | Partial/undefined Handling | 4 | `Partial<T>` and explicit undefined | `src/serializer/handlers.ts` |
| 10 | MapName/Property Mapping | 3 | Property name mapping not applied | `src/serializer/handlers.ts` |
| 11 | Reference Handling | 3 | FK/Reference serialization issues | `src/serializer/handlers.ts` |
| 12 | Custom Iterable | 2 | Deprecated API not supported | `src/serializer/compat.ts` |
| 13 | Test Suite Error | 1 | BigInt serialization in Jest | N/A |

---

## Priority 1: Validation Not Running (22 tests) - HIGHEST IMPACT

**Root Cause:** The `is()` and `validate()` functions are not invoking validation handlers. When checking types with constraints (MinLength, email, positive, etc.), the validators never run.

**Pattern:** All tests show `validate<T>(...)` returning empty arrays or `is<T>(...)` returning `true` when it should return validation errors or `false`.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| validation.spec.ts | primitives | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | custom validator pre defined | `is<MyType>('nope')` = false | true |
| validation.spec.ts | custom validator with arguments | `is<MyType>('nope')` = false | true |
| validation.spec.ts | multiple custom validators | validators called 1x each | 0 calls |
| validation.spec.ts | decorator validator | `[{code:'length',...}]` | `[]` |
| validation.spec.ts | simple interface | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | simple class | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | path | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | class with union literal | errors.length = 1 | 0 |
| validation.spec.ts | named tuple | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | inherited validations | `[{code:'minLength',...}]` | `[]` |
| validation.spec.ts | mapped type | errors.length > 0 | `[]` |
| validation.spec.ts | assert union | `validates<'a'\|'b'>('c')` = false | true |
| validation.spec.ts | inline object | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | readonly constructor properties | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | class with statics | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | date | `[{code:'type',...}]` | `[]` |
| validation.spec.ts | array with multiple errors | 2 errors | `[]` |
| validation.spec.ts | union with constraints (#577) | 1 error | 0 |
| validation.spec.ts | union with multiple constrained (#577) | 1 error | 0 |
| validation.spec.ts | union with nested objects (#577) | >= 1 error | 0 |
| validation.spec.ts | union with object structural (#577) | >= 1 error | 0 |

**Fix:** Ensure validation pipeline is invoked in `is()` and `validate()`. Check that type constraints (decorators like `MinLength`, `Positive`, custom validators) are being processed.

---

## Priority 2: Object/Record Serialization (11 tests)

**Root Cause:** Index signature types (`Record<K,V>`, `{[key: string]: T}`) and object literals produce empty objects `{}`. The handler is not iterating over input object properties.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| integration4.spec.ts | complex recursive union type 1 | `{username:'Peter'}` | `{}` |
| integration4.spec.ts | complex recursive union type 2 | `{username:'Peter'}` | `{}` |
| type-spec.spec.ts | record removes undefined | `{foo:'bar'}` | `{}` |
| type-spec.spec.ts | record allows undefined | `{foo:'bar'}` | `{}` |
| type-spec.spec.ts | model 1 | `{filter:{$regex:/Peter/},...}` | `{filter:{},...}` |
| type-spec.spec.ts | nullable container | `{tags:null,...}` | `{}` |
| type-spec.spec.ts | union with default fields | `{__kind:'Foo',a:'a'}` | `{__kind:'Foo'}` |
| type-spec.spec.ts | union with almost same member | `{a:'a',b:2}` | `{a:'a'}` |
| change-detection.spec.ts | change-detection object | `{id:1,tags:{a:true,b:true}}` | `{id:1,tags:{}}` |
| change-detection.spec.ts | array in object | detect change | no change detected |
| change-detection.spec.ts | object in object | detect change | no change detected |
| advanced.spec.ts | circular generic 1 | `{id:5}` | `{}` |
| issues/complex-union.spec.ts | complex union | `{session_variables:{...}}` | `{session_variables:{}}` |

**Fix:** In `src/serializer/handlers.ts`, the handler for object literals with index signatures needs to iterate over all properties of the input object, not just defined schema properties.

---

## Priority 3: Class Instance Instantiation (9 tests)

**Root Cause:** Deserialization returns plain `Object` instead of class instances. Constructor is not being called.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| type-spec.spec.ts | model | `toBeInstanceOf(Model)` | `Object` |
| type-spec.spec.ts | union basics | `toBeInstanceOf(Model)` | `Object` |
| type-spec.spec.ts | union 3 | `toBeInstanceOf(Model)` | `Object` |
| type-spec.spec.ts | constructor argument | `toBeInstanceOf(Product)` | `Object` |
| type-spec.spec.ts | partial returns the model | `toBeInstanceOf(Config)` | `Object` |
| type-spec.spec.ts | constructor property not assigned | `Derived{id:'foo'}` | `Object{id:'unrelated'}` |
| type-spec.spec.ts | dynamic properties | `back1.getType()` | `getType is not a function` |
| nanoid.spec.ts | NanoId in entity | `toBeInstanceOf(Entity)` | `Object` |
| mixin.spec.ts | mixin base | `toBeInstanceOf(User)` | `Object` |
| typeguard.spec.ts | union classes with generic | `toBeInstanceOf(Group)` | `Object` |

**Fix:** In class type handler, ensure `new ClassType(...)` or `Object.create(ClassType.prototype)` is used instead of plain object creation.

---

## Priority 4: Union Resolution (8 tests)

**Root Cause:** Union type scoring and member selection failing. Either throws "No union member matches" when valid, or picks wrong member.

| Test File | Test Name | Error |
|-----------|-----------|-------|
| integration4.spec.ts | union loosely | `ValidationError: Cannot convert to a. No union member matches` |
| type-spec.spec.ts | optional basics | `ValidationError: Cannot convert to string \| undefined` |
| type-spec.spec.ts | nullable basics | `ValidationError: Cannot convert to string \| null` |
| typeguard.spec.ts | set | `is<Set<string>>(new Set(['a', 2]))` = true (should be false) |
| typeguard.spec.ts | map | Map with wrong type passes |
| typeguard.spec.ts | object literal methods | `is<{m:()=>void}>({m:false})` = true |
| typeguard.spec.ts | multiple index signature | Numeric index not enforced |
| receive-type.spec.ts | function with ReceiveType | Type not validated in closure |

**Fix:** Review `src/serializer/union.ts` scoring logic. Ensure proper type coercion for `undefined` and `null` union members.

---

## Priority 5: Default Value Handling (7 tests)

**Root Cause:** Properties with default values not populated when value is missing or explicitly `undefined`.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| type-spec.spec.ts | with implicit default value | `{id:23,created:Date}` | `{id:23}` |
| type-spec.spec.ts | explicitly set undefined triggers default | `created` is Date | `undefined` |
| type-spec.spec.ts | explicitely set undefined on required | `created` is Date | `undefined` |
| type-spec.spec.ts | partial explicitly set undefined optional | `'created' in result` = true | false |
| type-spec.spec.ts | partial explicitly set undefined required | `'created' in result` = true | false |
| type-spec.spec.ts | partial allowed undefined | `'created' in result` = true | false |
| type-spec.spec.ts | partial keeps explicitely undefined | `{title:null}` | `{}` |

**Fix:** Check `property.hasDefault()` and call `property.getDefaultValue()` when input is missing or undefined.

---

## Priority 6: NanoId Validation (8 tests)

**Root Cause:** NanoId pattern validation not being executed. All NanoId strings pass regardless of length/format.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| nanoid.spec.ts | validation - invalid length | `is<NanoId>('tooshort')` = false | true |
| nanoid.spec.ts | validation error messages | errors.length = 1 | 0 |
| nanoid.spec.ts | deserialization - invalid throws | throws | no throw |
| nanoid.spec.ts | in entity serialization roundtrip | instanceof Entity | Object |
| nanoid.spec.ts | optional property | `is<{id?:NanoId}>({id:'invalid'})` = false | true |
| nanoid.spec.ts | nullable property | `is<{id:NanoId\|null}>({id:'invalid'})` = false | true |
| nanoid.spec.ts | in union type | `is<NanoId\|number>('invalid')` = false | true |
| nanoid.spec.ts | array | `is<NanoId[]>(['valid','invalid'])` = false | true |

**Note:** These are related to Priority 1 (validation not running). Fix validation and these should resolve.

---

## Priority 7: TypedArray/Binary (5 tests)

**Root Cause:** TypedArray deserialization returns `ArrayBuffer` instead of the specific TypedArray type (Int8Array, Float32Array). Base64 encoding also incorrect.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| typedarray.spec.ts | mapping | `Int8Array` | `ArrayBuffer` |
| typedarray.spec.ts | Int8Array | `Int8Array` | `ArrayBuffer` |
| typedarray.spec.ts | Float32Array | `'AACAQ+Tqs0Y='` | `'APU='` |
| change-detection.spec.ts | arrayBuffer | valid base64 | `InvalidCharacterError` |
| change-detection.spec.ts | typedArray | valid base64 | `InvalidCharacterError` |

**Fix:** Ensure TypedArray handler creates the correct typed array view, not just ArrayBuffer. Check base64 encoding logic.

---

## Priority 8: Circular/Recursive Types (4 tests)

**Root Cause:** Circular type references generating invalid JavaScript code with `SyntaxError: Unexpected identifier 'Object'`.

| Test File | Test Name | Error |
|-----------|-----------|-------|
| type-spec.spec.ts | omit circular reference 1 | `SyntaxError: Unexpected identifier 'Object'` |
| type-spec.spec.ts | omit circular reference 2 | Same |
| type-spec.spec.ts | omit circular reference 3 | Same |
| type-spec.spec.ts | relation 2 | `TypeError: array.map is not a function` |

**Fix:** Add recursion guards in `src/serializer/state.ts`. Track visited types to prevent infinite loops in code generation.

---

## Priority 9: Partial/undefined Handling (4 tests)

**Related to Priority 5.** Explicit `undefined` values not preserved in `Partial<T>` results.

---

## Priority 10: MapName/Property Mapping (3 tests)

**Root Cause:** Property name mapping (`@MapName` decorator) not applied during serialization/deserialization.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| type-spec.spec.ts | mapName interface | `{type:'abc'}` | `{}` |
| type-spec.spec.ts | mapName class | `{id:'1',type:'abc'}` | `{}` |
| type-spec.spec.ts | Map part of union | Date key as string | Date object |

**Fix:** Check property's mapped name annotation and use it for property access.

---

## Priority 11: Reference Handling (3 tests)

**Root Cause:** Foreign key references not being serialized correctly.

| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| type-spec.spec.ts | relation 1 | `{lead:12}` (FK only) | `{lead:{id:12,...}}` (full object) |
| type-spec.spec.ts | primary key only for reference | valid handling | `TypeError: Cannot use 'in' on 34` |
| type-spec.spec.ts | relation 2 | array handling | `array.map is not a function` |

**Fix:** Detect reference types and serialize only the primary key, not the full object.

---

## Priority 12: Custom Iterable (2 tests)

**Root Cause:** `executeTypeArgumentAsArray` API deprecated and throws error.

| Test File | Test Name |
|-----------|-----------|
| use-cases.spec.ts | custom iterable |
| use-cases.spec.ts | custom iterable manual |

**Fix:** Migrate to new TypeHandler API per deprecation notice.

---

## Priority 13: Test Suite Error (1 test)

| Test File | Test Name | Error |
|-----------|-----------|-------|
| serializer.spec.ts | (entire suite) | `TypeError: Do not know how to serialize a BigInt` |

**Fix:** Jest issue with BigInt serialization. Add `BigInt.prototype.toJSON` or use custom serializer.

---

## Other Notable Failures

| Test File | Test Name | Error |
|-----------|-----------|-------|
| integration2.spec.ts | class validator | Class `validator()` method not invoked |
| type-infer-runtime.spec.ts | dynamic type definition | MinLength validation not running |
| issues/type-annotation.spec.ts | property serialization | `firstname2` missing after cast |

---

## Recommended Fix Order (by impact)

1. **Validation handlers** (22+ tests) - Fix `is()` / `validate()` to invoke validation pipeline
2. **Object/Record serialization** (11 tests) - Fix index signature iteration
3. **Class instantiation** (9 tests) - Ensure constructors are called
4. **Union resolution** (8 tests) - Fix scoring and `null`/`undefined` handling
5. **Default values** (7 tests) - Apply defaults for missing properties
6. **TypedArray handling** (5 tests) - Fix type construction and encoding
7. **Circular types** (4 tests) - Add recursion guards
8. **Property mapping** (3 tests) - Apply MapName during serialization
9. **Reference handling** (3 tests) - Serialize only FK for references

---

## Test Files by Failure Count

| File | Failures |
|------|----------|
| validation.spec.ts | 22 |
| type-spec.spec.ts | 20+ |
| nanoid.spec.ts | 8 |
| typeguard.spec.ts | 6 |
| change-detection.spec.ts | 5 |
| typedarray.spec.ts | 3 |
| integration4.spec.ts | 3 |
| use-cases.spec.ts | 2 |
| advanced.spec.ts | 1 |
| mixin.spec.ts | 1 |
| integration2.spec.ts | 1 |
| type-infer-runtime.spec.ts | 1 |
| receive-type.spec.ts | 1 |
| issues/complex-union.spec.ts | 1 |
| issues/type-annotation.spec.ts | 1 |
| serializer.spec.ts | 1 (suite error) |

---

*Generated: 2026-01-22*
*Previous: 106 failures -> Current: 86 failures (20 fixed)*
