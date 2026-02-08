# @deepkit/bson Errors

Error codes for the `@deepkit/bson` package follow the format `DK-B###`.

## DK-B001: General BSON Error

**Message:** Various BSON-related error messages.

**Causes:**
- An unexpected condition during BSON serialization or deserialization
- An error that doesn't fit into a more specific category

**Solution:**
Check the error message for details about the specific problem. If this error occurs consistently, it may indicate a bug — please report it with a minimal reproduction.

---

## DK-B010: Unknown BSON Type

**Message:** `Unknown BSON type: <type>` or `Unknown BSON type during shape learning: <type>`

**Causes:**
- The BSON data contains a type tag byte that is not a valid BSON type
- The data was produced by a newer BSON specification version not yet supported
- The binary data is corrupted or was not encoded as BSON

**Solution:**
1. Verify the data is valid BSON (e.g., produced by a MongoDB driver or `serializeBSON`)
2. Check if the data was truncated or corrupted during transmission/storage
3. Ensure the BSON producer and consumer are using compatible versions

Valid BSON types are: DOUBLE (0x01), STRING (0x02), OBJECT (0x03), ARRAY (0x04), BINARY (0x05), OBJECT_ID (0x07), BOOLEAN (0x08), DATE (0x09), NULL (0x0A), REGEX (0x0B), INT (0x10), LONG (0x12).

---

## DK-B020: Malformed BSON Data

**Message:** Various messages including:
- `Invalid BSON string: negative length`
- `Invalid BSON document: size too small`
- `Invalid BSON binary: negative length`
- `Invalid BSON array: size out of bounds`
- `Invalid BinaryBigInt: size out of bounds`
- `Unexpected end of buffer`
- `Unexpected end of buffer while reading field name`
- `Unexpected end of buffer while reading REGEX pattern`

**Causes:**
- The BSON binary data is truncated or incomplete
- The document size prefix is larger than the actual buffer
- A string, binary, or sub-document has a corrupted length prefix
- The data was partially received over a network connection
- The buffer was sliced incorrectly before parsing

**Solution:**
1. Ensure the complete BSON document is available before parsing
2. For network-received data, use `BSONStreamReader` to handle chunked delivery
3. Verify the buffer starts at the correct offset (BSON documents start with a 4-byte int32 size)
4. Check that the data source is producing valid BSON

Example with `BSONStreamReader` for chunked data:
```typescript
import { BSONStreamReader } from '@deepkit/bson';

const reader = new BSONStreamReader((buffer) => {
    // Called with each complete BSON document
    const result = deserializeBSON<MyType>(buffer);
});

// Feed chunks as they arrive
reader.feed(chunk1);
reader.feed(chunk2);
```

---

## DK-B030: Type Conversion Failed

**Message:** `Cannot convert <value> to <type>` or `Cannot convert bson type <bsonType> to <targetType>`

**Causes:**
- The BSON data contains a type that cannot be converted to the expected TypeScript type
- A string value doesn't match the expected format (e.g., invalid UUID or MongoId format)
- The BSON document was produced with a different schema than expected
- Coercion is not supported between the BSON type and the target type

**Solution:**
1. Check that the data source produces values matching your TypeScript types
2. For UUID fields, ensure the value is stored as BSON BINARY subtype 4 (UUID) or as a valid UUID string (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
3. For MongoId fields, ensure the value is stored as BSON OBJECT_ID or as a valid 24-character hex string
4. If you need to accept multiple BSON types, use a union type: `string | number`

Common conversion table:
| BSON Type | Supported Target Types |
|-----------|----------------------|
| STRING    | `string`, `number` (if numeric), `boolean` (if "true"/"false") |
| INT/LONG  | `number`, `string`, `boolean`, `bigint`, `Date` |
| DOUBLE    | `number`, `string`, `boolean`, `Date` |
| BOOLEAN   | `boolean`, `number`, `string` |
| BINARY    | `Uint8Array`, `ArrayBuffer`, `bigint` (BinaryBigInt), `UUID` |
| OBJECT_ID | `MongoId` (string) |
| DATE      | `Date` |

---

## DK-B040: Union Match Failed

**Message:** `No union member matched. Expected: <unionDescription>` or `Unknown discriminator value '<value>' for property '<prop>'` or `Cannot serialize value to union`

**Causes:**
- The BSON data doesn't match any member of a union type
- A discriminator property has a value not found in any union member
- The value being serialized doesn't match any union member type
- The union type requires specific discriminator values that the data doesn't have

**Solution:**
1. Check that the data matches one of the union member types
2. For discriminated unions, verify the discriminator property has a recognized value:
   ```typescript
   // Discriminated union — 'kind' must be 'circle' or 'square'
   type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number };
   ```
3. For literal unions, verify the value is one of the allowed literals:
   ```typescript
   // Literal union — value must be 'a', 'b', or 'c'
   type Status = 'active' | 'inactive' | 'pending';
   ```
4. If the data can be missing or null, add `null` or `undefined` to the union:
   ```typescript
   type MaybeNumber = number | null;
   ```

---

## DK-B050: Circular Reference Detected

**Message:** `Circular reference detected` or `Circular reference detected at path: <path>`

**Causes:**
- An object references itself directly or indirectly during serialization
- Two or more objects form a reference cycle (e.g., A → B → A)
- A parent-child relationship creates a circular structure

**Solution:**
1. Break the circular reference before serializing:
   ```typescript
   // Remove circular reference
   const user = { name: 'Alice', bestFriend: undefined as any };
   const friend = { name: 'Bob', bestFriend: user };
   user.bestFriend = friend; // Circular!

   // Option 1: Set to undefined before serializing
   user.bestFriend = undefined;
   const bson = serializeBSON<User>(user);
   ```
2. Use `& Reference` to serialize only the foreign key instead of the full object:
   ```typescript
   class User {
       id: number & PrimaryKey = 0;
       bestFriend: User & Reference = undefined!; // Serializes as FK only
   }
   ```
3. Design your data model to avoid circular structures in serialized output

---

## DK-B060: Type Not Serializable

**Message:** `Type '<typeName>' cannot be serialized to BSON`

**Causes:**
- The TypeScript type has no BSON representation (e.g., `symbol`, `function`, `never`)
- A union type contains no object/class members that can be deserialized
- The top-level type is not an object literal or class
- A literal type uses an unsupported value type (e.g., symbol literal)
- A Map or Set type is missing its generic type arguments

**Solution:**
1. BSON serializes object types — ensure your root type is a class or object literal:
   ```typescript
   // Works — object type
   serializeBSON<{ name: string }>({ name: 'hello' });

   // Does NOT work — primitive type at root
   serializeBSON<string>('hello'); // DK-B060
   ```
2. For Map and Set, always provide type arguments:
   ```typescript
   // Works
   type Doc = { data: Map<string, number> };

   // Does NOT work — missing type arguments
   type Doc = { data: Map };  // DK-B060
   ```
3. Avoid unsupported types: `symbol`, `Function`, `WeakMap`, `WeakSet`, `Promise` (at serialization time)

---

## DK-B070: Invalid Format

**Message:** `Invalid ObjectId hex string: expected 24 characters, got <n>` or `Invalid UUID string: expected 36 characters, got <n>`

**Causes:**
- An ObjectId string is not exactly 24 hexadecimal characters
- A UUID string is not in the standard format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, 36 characters)
- The value contains non-hex characters
- The value is empty or truncated

**Solution:**
1. For ObjectId (MongoId), provide a valid 24-character hex string:
   ```typescript
   import { ObjectId } from '@deepkit/bson';

   // Generate a new one
   const id = ObjectId.generate();  // e.g., '507f1f77bcf86cd799439011'

   // Or use a known valid value
   const doc = { id: '507f1f77bcf86cd799439011' };
   ```
2. For UUID, provide a valid RFC 4122 formatted string:
   ```typescript
   // Valid UUID format
   const doc = { id: '550e8400-e29b-41d4-a716-446655440000' };
   ```

---

## DK-B080: Validation Failed

**Message:** The original validation error message, optionally prefixed with the field path.

**Causes:**
- The `getBSONEncoder` API was used with type constraints, and the data violates those constraints
- A field fails type validation before BSON encoding (e.g., `MinLength`, `Positive`, `Email`, `Pattern`)
- Required fields are missing or have wrong types

**Solution:**
1. Fix the data to match the type constraints:
   ```typescript
   import { MinLength, Positive } from '@deepkit/type';

   type User = { name: string & MinLength<2>; age: number & Positive };

   const encoder = getBSONEncoder<User>();
   // This would throw DK-B080:
   encoder.encode({ name: '', age: -1 });

   // Fix: provide valid data
   encoder.encode({ name: 'Al', age: 25 });
   ```
2. If validation is not needed, use `serializeBSON` or `getBSONSerializer` instead — these serialize without validation
3. Check the error message for the specific field and constraint that failed

---

## DK-B090: Stream Error

**Message:** `Invalid document size`

**Causes:**
- `BSONStreamReader` received a BSON document with a size prefix of 0 or negative
- The stream data is corrupted or not valid BSON
- The stream contains non-BSON data mixed with BSON documents

**Solution:**
1. Verify the data source produces valid BSON documents
2. Each BSON document must start with a 4-byte little-endian int32 size prefix (minimum value: 5)
3. Check that the stream is not receiving mixed protocols (e.g., HTTP headers mixed with BSON)
4. If reading from a file, ensure the file pointer is at a valid document boundary

---
