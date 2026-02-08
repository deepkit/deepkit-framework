# BSON Implementation Feature Inventory

This document catalogs all features in the current `@deepkit/bson` implementation that must be preserved during the rewrite.

## 1. Reference and BackReference Types

### Reference Serialization

| Scenario | Behavior | Code Location |
|----------|----------|---------------|
| `& Reference` + `forMongoDatabase: true` | Primary key only | `bson-serializer.ts:985-988` |
| `& Reference & Inline` | Full object (throws if not hydrated) | `bson-serializer.ts:1002-1009` |
| `& Reference` (no Inline) | Primary key only | `bson-serializer.ts:1010-1015` |
| `& BackReference` + `forMongoDatabase: true` | Skipped entirely | `bson-serializer.ts:863-864` |
| `& BackReference` (no forMongo) | Normal serialization | Same file, no skip |

### Reference Deserialization

**Location**: `bson-serializer.ts:1941-1965`

- If BSON element is `OBJECT` → Full object deserialization
- If BSON element is scalar (primary key) → Create reference proxy via `createReference()`
- Automatically handles both serialization modes

### Inline Annotation Scoping

**Location**: `bson-serializer.ts:991-1000`

```typescript
// Supports scoped inline annotations:
property: MyClass & Reference & Inline                    // Active for all serializers
property: MyClass & Reference & Inline<{only: ['bson']}>  // Active only for BSON
property: MyClass & Reference & Inline<{except: ['bson']}> // Inactive for BSON
```

---

## 2. Recursive and Nested Types

### Self-Referential Types

**Mechanism**: JitStack parameter tracks compilation to prevent infinite loops

**Example** (`bson-serialize.spec.ts:1267-1322`):
```typescript
class ModuleApi {
    api?: ModuleApi;              // Self-reference
    imports: ModuleApi[] = [];    // Array of self-references
}
```

### Circular Type Detection

**Location**: `hasCircularReference()` from `@deepkit/type`

- Detected at compile-time
- Allows JIT to generate appropriate handling code

### Nested Object Handling

**Serialization**: `handleObjectLiteral()` at `bson-serializer.ts:773-1018`
- Writes 4-byte size header
- Recursively processes via `executeTemplates()`
- Backfills size after all properties written

**Deserialization**: `deserializeObjectLiteral()` at `bson-deserializer-templates.ts:746-971`
- Reads size header
- Loops through fields until terminator
- Matches property names, calls type-specific handlers

### Embedded Documents (Currently Disabled)

**Location**: `bson-serializer.ts:791-835` (commented out)

The `@Embedded()` annotation system for flattening nested classes is disabled but the code structure exists for potential future use.

---

## 3. Partial/Lazy Deserialization

### seekElementSize Function

**Location**: `continuation.ts:38-94`

Zero-copy field skipping via pointer arithmetic:

| BSON Type | Skip Strategy |
|-----------|---------------|
| STRING | Read 4-byte size, advance pointer |
| OBJECT/ARRAY | Read 4-byte size, advance pointer |
| OID | Advance 12 bytes |
| INT | Advance 4 bytes |
| LONG/DATE | Advance 8 bytes |
| BINARY | Read size + subtype, advance accordingly |

### Unknown Field Handling

**Location**: `bson-deserializer-templates.ts:950-962`

```typescript
// Skip property name (scan for null terminator)
while (state.parser.buffer[state.parser.offset++] != 0);
// Skip property value
seekElementSize(elementType, state.parser);
```

### MongoDB Projection Integration

**Location**: `packages/mongo/src/client/command/find.ts:47-74`

- Server-side field filtering via `projection` parameter
- Client-side uses `Partial<T>` type for partial deserialization
- `getPartialType()` makes all properties optional

### Field-Level Lazy Access

**Location**: `continuation.ts:96-116` (`findValueInObject`)

Locate and parse specific field without full document parsing.

---

## 4. Union Type Handling

### Literal Union Optimization

**Location**: `bson-serializer.ts:1316-1374`

For pure literal unions (`'a' | 'b' | 'c'`):
- Creates `Set<literal>` for O(1) membership testing
- Uses `typeof` dispatch for BSON type selection
- Threshold: `BSON_UNION_LITERAL_THRESHOLD = 1`

### Object Union Discrimination (Scoring)

**Location**: `bson-deserializer-templates.ts:303-391`

1. Try primitive checks first (O(1) per type)
2. For object unions, compute score = number of matching properties
3. Highest score wins
4. `maxScore = type.types.length` ensures specificity

### Type Guard System

**Location**: `bson-serializer.ts:1787-1899`

**Specificality Levels**:
| Level | Meaning | Example |
|-------|---------|---------|
| 1 | Exact match | `string` ← `BSONType.STRING` |
| 1.5 | Secondary | `void` ← `BSONType.NULL` |
| 2 | Loose coercion | `string` ← `BSONType.BOOLEAN` → `"true"` |

### bsonTypeGuardObjectLiteral

**Location**: `bson-deserializer-templates.ts:974-1124`

- Iterates through object properties
- Increments `matching` score for each valid field
- Returns score (0 = no match, higher = better)

---

## 5. Special Annotated Types

### UUID (uuidAnnotation)

| Operation | Details |
|-----------|---------|
| BSON Type | BINARY (subtype 4) |
| Size | 21 bytes (4 size + 1 subtype + 16 data) |
| Format | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Serialization | `bson-serializer.ts:1118-1127`, `Writer.writeUUID()` |
| Deserialization | `BaseParser.parseUUID()` at `bson-parser.ts:239-267` |

### MongoId/ObjectId (mongoIdAnnotation)

| Operation | Details |
|-----------|---------|
| BSON Type | OID (native) |
| Size | 12 bytes (no header) |
| Format | 24-char hex string |
| Serialization | `bson-serializer.ts:1128-1137`, `Writer.writeObjectId()` |
| Deserialization | `BaseParser.parseOid()` at `bson-parser.ts:219-237` |

### BigInt (Three Modes)

**Mode 1: LONG (Default)**
- BSON Type: LONG
- Size: 8 bytes
- Range: ±9223372036854775807
- Write: `Writer.writeBigIntLong()`

**Mode 2: Binary Unsigned** (`binaryBigIntAnnotation` with `BinaryBigIntType.unsigned`)
- BSON Type: BINARY (subtype 0)
- Size: 4 + 1 + variable
- Range: Unlimited positive
- Write: `Writer.writeBigIntBinary()`

**Mode 3: Binary Signed** (`binaryBigIntAnnotation` with `BinaryBigIntType.signed`)
- BSON Type: BINARY (subtype 0)
- Size: 4 + 1 + 1 (signum) + variable
- Range: Unlimited ±
- Signum: 0 = positive, 255 = negative
- Write: `Writer.writeSignedBigIntBinary()`

### Date

| Operation | Details |
|-----------|---------|
| BSON Type | DATE (type 9) |
| Size | 8 bytes |
| Format | Milliseconds since epoch |
| Fallback | Also accepts INT, NUMBER, LONG, TIMESTAMP, STRING |

### Binary/ArrayBuffer

| Operation | Details |
|-----------|---------|
| BSON Type | BINARY (subtype 0) |
| Size | 4 + 1 + byteLength |
| Types | ArrayBuffer, Uint8Array, Int8Array, etc. |
| Output | Returns same typed array class as input |

### RegExp

| Operation | Details |
|-----------|---------|
| BSON Type | REGEXP (type 11) |
| Size | Variable (source + flags + nulls) |
| Flags | i → i, g → s (BSON convention), m → m |

---

## 6. Graceful Deserialization (Type Coercion)

A critical feature: the deserializer attempts to coerce incompatible BSON types to the target TypeScript type, returning sensible defaults or converted values instead of throwing errors.

### Coercion Behavior by Target Type

**Target: `number`** (`bson-parser.spec.ts:20-33`)
| Input BSON Type | Result |
|-----------------|--------|
| INT | Direct value |
| NUMBER | Direct value |
| LONG | `Number(bigint)` |
| STRING `'123'` | `123` (parsed) |
| BOOLEAN `true` | `1` |
| BOOLEAN `false` | `0` |
| OBJECT `{}` | `0` (default fallback) |

**Target: `bigint`** (`bson-parser.spec.ts:35-47`)
| Input BSON Type | Result |
|-----------------|--------|
| INT | `BigInt(value)` |
| NUMBER | `BigInt(value)` |
| LONG | Direct bigint |
| STRING `'123'` | `123n` |
| BOOLEAN `true` | `1n` |
| BOOLEAN `false` | `0n` |
| OBJECT `{}` | `0n` (default fallback) |

**Target: `string`** (`bson-parser.spec.ts:186-196`)
| Input BSON Type | Result |
|-----------------|--------|
| STRING | Direct value |
| INT `123` | `'123'` |
| NUMBER | String conversion |
| BOOLEAN | `'true'` / `'false'` |
| OID | Hex string |
| LONG | String conversion |
| OBJECT | **THROWS** `Cannot convert bson type OBJECT to string` |

**Target: `boolean`** (`bson-parser.spec.ts:198-209`)
| Input BSON Type | Result |
|-----------------|--------|
| BOOLEAN | Direct value |
| INT `123` | `true` (truthy) |
| INT `0` | `false` |
| STRING `'123'` | `true` (truthy via Number) |
| NUMBER | Truthy check |

**Target: `Date`** (`bson-parser.spec.ts:91-96`)
| Input BSON Type | Result |
|-----------------|--------|
| DATE | Direct value |
| STRING (ISO) | `new Date(str)` |
| INT/NUMBER | `new Date(timestamp)` |
| LONG | `new Date(Number(bigint))` |

**Target: `null`** (`bson-parser.spec.ts:49-62`)
| Input BSON Type | Result |
|-----------------|--------|
| NULL | `null` |
| UNDEFINED | `null` |
| Missing field | `null` |
| INT | **THROWS** `Cannot convert bson type INT to null` |
| OBJECT | **THROWS** |

**Target: `undefined`** (`bson-parser.spec.ts:64-73`)
| Input BSON Type | Result |
|-----------------|--------|
| NULL | `undefined` |
| UNDEFINED | `undefined` |
| Missing field | `undefined` |
| INT | **THROWS** |
| OBJECT | **THROWS** |

**Target: Literal types** (`bson-parser.spec.ts:75-83`)
| Input BSON Type | Result |
|-----------------|--------|
| ANY | Returns the literal value (ignores input) |

Example: `type T = { v: 'abc' }` always deserializes to `{ v: 'abc' }` regardless of BSON input.

**Target: Optional with initializer** (`bson-parser.spec.ts:141-152`)
```typescript
class User {
    v: Date = defaultValue;
}
```
| Input BSON Type | Result |
|-----------------|--------|
| Valid Date | Parsed date |
| NULL | `defaultValue` (initializer) |
| UNDEFINED | `defaultValue` |
| Missing | `defaultValue` |

### Implementation: createParserLookup

**Location**: `bson-deserializer-templates.ts:216-252`

```typescript
function createParserLookup(defaultReturn: () => any, parsers: [BSONType, Parse][]): Parse[] {
    const defaultParse = function (parser: BaseParser, elementType: BSONType) {
        seekElementSize(elementType, parser);  // Skip over the value
        return defaultReturn();                 // Return default (0, 0n, false, etc.)
    };
    // Create array of 20 handlers, defaultParse for unhandled types
    const result = [defaultParse, defaultParse, ...];
    for (const [index, parse] of parsers) {
        result[index] = parse;  // Override with specific handlers
    }
    return result;
}
```

This pattern:
1. Creates a lookup table indexed by BSON type code
2. Unhandled types return a sensible default (not throw)
3. Specific handlers convert compatible types
4. The `seekElementSize` ensures we advance past the value even when using default

### When Errors ARE Thrown

Errors only occur for truly incompatible conversions:
- `string` ← `OBJECT` (can't stringify arbitrary object)
- `null` ← `INT` (null is explicit, not coercible)
- `undefined` ← `INT` (undefined is explicit)
- `ArrayBuffer` ← `STRING` (binary types need BINARY)
- Union with no matching member

---

## 7. Type Coercion Tables

### Number Parsers

**Location**: `bson-deserializer-templates.ts:88-99`

```typescript
const numberParsers = createParserLookup(() => 0, [
    [BSONType.INT, parser => parser.parseInt()],
    [BSONType.NUMBER, parser => parser.parseNumber()],
    [BSONType.LONG, parser => Number(parser.parseLong())],
    [BSONType.TIMESTAMP, parser => Number(parser.parseLong())],
    [BSONType.BOOLEAN, parser => (parser.parseBoolean() ? 1 : 0)],
    [BSONType.BINARY, parser => Number(parser.parseBinaryBigInt())],
    [BSONType.STRING, parser => Number(parser.parseString())],
]);
```

### BigInt Parsers

**Location**: `bson-deserializer-templates.ts:111-122`

Similar table for bigint with appropriate conversions.

### Boolean Parsers

**Location**: `bson-deserializer-templates.ts:254-266`

```typescript
const booleanParsers = createParserLookup(() => false, [
    [BSONType.BOOLEAN, parser => parser.parseBoolean()],
    [BSONType.NULL, parser => 0],
    [BSONType.INT, parser => !!parser.parseInt()],
    [BSONType.NUMBER, parser => !!parser.parseNumber()],
    [BSONType.STRING, parser => !!Number(parser.parseString())],
    // ...
]);
```

---

## 7. Tuple and Array Handling

### Array Serialization

**Location**: `bson-serializer.ts:1496-1527`

- BSON arrays are objects with numeric keys ("0", "1", "2"...)
- Each element: type byte + key name + value
- Terminates with null byte
- Size backfilled after all elements

### Array Deserialization

**Location**: `bson-deserializer-templates.ts:642-679`

- Reads size header
- Loops reading type byte + skipping numeric key + parsing value
- Builds result array with `push()`

### Tuple Handling

**Location**: `bson-serializer.ts:1529-1642` (serialize), `bson-deserializer-templates.ts:427-532` (deserialize)

- Supports rest elements: `[string, ...number[], boolean]`
- Handles optional tuple members
- Computes `restEndOffset` for proper element assignment

---

## 8. Index Signatures

### Serialization

**Location**: `bson-serializer.ts:919-969`

- Iterates with `for (const i in value)`
- Filters out already-handled named properties
- Uses `getIndexCheck()` to validate key type
- Dynamically writes property name

### Deserialization

**Location**: `bson-deserializer-templates.ts:872-896`

- Uses `parser.eatObjectPropertyName()` for runtime key reading
- Checks against all index signature patterns
- Falls back to `seekElementSize()` for unmatched keys

---

## 9. Error Handling

### Validation Errors

**Location**: `bson-deserializer-templates.ts:63-69`

Union mismatch error format:
```
ValidationError: No union member matched. Expected: string | number | MyClass
```

### Invalid BSON Type

**Location**: `bson-deserializer-templates.ts:58-61`

```typescript
function throwInvalidBsonType(type: Type, state: TemplateState) {
    return state.throwCode(type, 'invalid BSON type', `'bson type ' + BSONType[state.elementType]`);
}
```

### Missing Required Fields

**Location**: `bson-deserializer-templates.ts:829-836`

Per-property tracking with `valueSetVar` flags, throws if required field not set.

---

## 10. ValueWithBSONSerializer Wrapper

**Location**: `bson-serializer.ts:284-289`

```typescript
export class ValueWithBSONSerializer {
    constructor(public value: any, public type: Type) {}
}
```

**Factory Functions**:
- `wrapValue<T>(value, type)` - Generic wrapper
- `wrapObjectId(value)` - MongoId wrapper
- `wrapUUID(value)` - UUID wrapper

**Purpose**: Runtime type hints for `any` structures (e.g., dynamic MongoDB queries).

---

## 11. Options and Configuration

### BSONSerializerOptions

**Location**: `bson-serializer.ts:1644-1653`

```typescript
interface BSONSerializerOptions {
    forMongoDatabase?: true;  // Changes Reference/BackReference behavior
}
```

### NamingStrategy

Supports custom property name mapping via `NamingStrategy` class.

### Validation Modes

- `strict`: Only exact type matches
- `loose`: Allows type coercion (default)

---

## 12. MongoDB Integration Requirements

The `@deepkit/mongo` package has deep integration with `@deepkit/bson`. Any rewrite must preserve these integration points.

### Core APIs Used

| API | Location | Purpose |
|-----|----------|---------|
| `getBSONSerializer` | `connection.ts:965` | Serialize all outbound commands |
| `getBSONSizer` | `connection.ts:966` | Calculate buffer size before serialization |
| `getBSONDeserializer` | `command.ts:119` | Deserialize all responses |
| `deserializeBSONWithoutOptimiser` | `command.ts:142` | Fallback for error responses |
| `BsonStreamReader` | `connection.ts:767` | Parse chunked TCP responses |
| `Writer` | `connection.ts:971` | Write message headers |
| `ObjectId.generate()` | `persistence.ts:131` | Auto-generate `_id` fields |
| `ValueWithBSONSerializer` | `mongo-serializer.ts:42` | Wrap special types |

### MongoBinarySerializer

**Location**: `mongo-serializer.ts:29-38`

```typescript
class MongoBinarySerializer extends BSONBinarySerializer {
    name = 'mongo';  // For Excluded<'mongo'> handling

    constructor() {
        super({ forMongoDatabase: true });  // Critical option!
    }
}
```

### Wire Protocol Format

**OP_MSG Structure** (`connection.ts:973-998`):
```
[4 bytes] messageLength
[4 bytes] requestID
[4 bytes] responseTo
[4 bytes] opcode (2013 for OP_MSG)
[4 bytes] flagBits (0)
[1 byte]  kind (0)
[...bytes] BSON document
```

The serializer writes directly after the 21-byte header.

### Special Type Wrapping

**MongoAnySerializer** (`mongo-serializer.ts:40-88`) wraps types for BSON:

| Type | Wrapping |
|------|----------|
| `string & UUID` | `ValueWithBSONSerializer(value, uuidType)` |
| `string & MongoId` | `ValueWithBSONSerializer(value, mongoIdType)` |
| `bigint & BinaryBigInt` | `ValueWithBSONSerializer(value, bigintType)` |
| Unhydrated Reference | Serialize primary key only |
| `undefined` | Serialize as `null` |

### Streaming Response Handling

**BsonStreamReader** (`connection.ts:767-808`):
- Receives chunked data via `feed(data)`
- Parses BSON documents as they complete
- Handles multiple documents per TCP packet
- Handles documents split across packets

### Partial Type Deserialization

**FindCommand** (`find.ts:84-141`):
- With projection: Uses `Partial<T>[]` response type
- Without projection: Uses `T[]` response type
- Cached in `jit.mdbFindPartial` / `jit.mdbFind`

**Query Resolver** (`query.resolver.ts:242, 279`):
```typescript
const partialDeserialize = getPartialSerializeFunction(
    this.classSchema.type,
    serializer.deserializeRegistry
);
```

### Error Fallback

**Command Response** (`command.ts:139-161`):
- If typed deserialization fails → try `deserializeBSONWithoutOptimiser`
- Extracts MongoDB error responses even if type mismatch
- Preserves protocol-level error handling

### Critical Invariants

1. **BSON format must match MongoDB wire protocol** - Any format deviation breaks all operations
2. **Message size field must be correct** - Used for TCP framing
3. **`forMongoDatabase: true` must be respected** - Controls Reference/BackReference behavior
4. **`name = 'mongo'` serializer identity** - Controls `Excluded<'mongo'>` filtering
5. **ObjectId must be 12 bytes** - MongoDB protocol requirement
6. **UUID must be Binary subtype 4** - MongoDB UUID convention

---

## Implementation Checklist for Rewrite

### Must Preserve
- [ ] Reference/BackReference with `forMongoDatabase` option
- [ ] Inline annotation with scoping (`only`/`except`)
- [ ] Recursive type handling via JitStack
- [ ] Partial deserialization with `seekElementSize`
- [ ] Union discrimination with scoring
- [ ] Literal union O(1) optimization
- [ ] Type guard specificality levels (1, 1.5, 2)
- [ ] All special types: UUID, MongoId, BigInt (3 modes), Date, Binary, RegExp
- [ ] **Graceful deserialization** - type coercion with sensible defaults
  - [ ] `number` ← string/boolean/object with fallback to `0`
  - [ ] `bigint` ← string/boolean/object with fallback to `0n`
  - [ ] `string` ← number/boolean/OID (but throw for object)
  - [ ] `boolean` ← number/string (truthy conversion)
  - [ ] `Date` ← string (ISO)/number (timestamp)
  - [ ] Literals always return literal value
  - [ ] Optional with initializer returns default on null/undefined/missing
- [ ] Type coercion lookup tables (`createParserLookup` pattern)
- [ ] Tuple with rest elements
- [ ] Index signatures
- [ ] ValueWithBSONSerializer wrapper
- [ ] Error messages with paths
- [ ] `loosely` mode for union type guards

### Intentionally Removed
- ~~`getBSONSizer`~~ - Replaced by single-pass serialization with dynamic buffer
- ~~`Writer` class~~ - Not needed; mongo can use DataView for header

### MongoDB Integration (Critical)
- [ ] `getBSONSerializer` / `getBSONDeserializer` public APIs
- [ ] `BsonStreamReader` for chunked response parsing
- [ ] `ObjectId.generate()` producing 12-byte BSON OID
- [ ] `ValueWithBSONSerializer` wrapper class
- [ ] `forMongoDatabase` option behavior
- [ ] `deserializeBSONWithoutOptimiser` fallback for untyped parsing
- [ ] Serializer returns `Uint8Array` (mongo handles wire protocol header separately)

### Architectural Changes from Current Implementation

**Removed: AutoBuffer Class**

Current `AutoBuffer` has multiple issues:
1. Class indirection costs **16.8%** overhead
2. Re-serializes entire object on overflow
3. Requires `getBSONSizer` for pre-allocation

**Benchmark Results** (`buffer-indirection.ts`):
| Strategy | Overhead |
|----------|----------|
| Pass as parameters | **-8.8%** (faster than baseline!) |
| AutoBuffer class | **16.8%** |
| Module globals | **23.9%** |

**New approach: Pass buffer/view/offset as parameters**

```typescript
// JIT generates functions with buffer params
function serialize_User(
    buffer: Uint8Array,
    view: DataView,
    o: number,
    data: User
): number {
    view.setInt32(o, 0, true); o += 4;  // doc size
    // ... inline writes ...
    return o;  // return final offset
}

// Thin wrapper manages global buffer
let globalBuffer = new Uint8Array(4096);
let globalView = new DataView(globalBuffer.buffer);

function serialize<T>(fn: SerializeFn<T>, data: T): Uint8Array {
    const size = fn(globalBuffer, globalView, 0, data);
    return globalBuffer.subarray(0, size);
}
```

**Removed: `getBSONSizer`**
- No size pre-calculation needed
- Single-pass serialization
- Mongo package needs minor update

**Removed: `Writer` class dependency**
- Mongo uses it only for 21-byte wire protocol header
- Can be replaced with DataView
- Serializer returns `Uint8Array.subarray()` view into global buffer

### Can Improve
- [ ] Use DataView instead of manual byte extraction
- [ ] Use Uint32Array for aligned writes
- [ ] Pre-compute property headers as u32 constants
- [ ] Hidden class stability in object construction
- [ ] String decoding optimization (manual vs TextDecoder)
