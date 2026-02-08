/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * BSON type codes as defined in the BSON specification.
 * @see https://bsonspec.org/spec.html
 *
 * ## Type Mapping: Deepkit/TypeScript → BSON
 *
 * ### Fixed-Size Types (value size is constant)
 *
 * | Deepkit Type                                       | BSON Type      | Value Size |
 * |----------------------------------------------------|----------------|------------|
 * | `boolean`                                          | BOOLEAN (0x08) | 1 byte     |
 * | `null`                                             | NULL (0x0A)    | 0 bytes    |
 * | `integer`, `int8`, `int16`, `int32`, `uint8`, `uint16` | INT (0x10) | 4 bytes    |
 * | `uint32`, `float`, `float32`, `float64`            | DOUBLE (0x01)  | 8 bytes    |
 * | `bigint`                                           | LONG (0x12)    | 8 bytes    |
 * | `Date`                                             | DATE (0x09)    | 8 bytes    |
 * | `MongoId`                                          | OID (0x07)     | 12 bytes   |
 * | `UUID`                                             | BINARY (0x05)  | 4+1+16 bytes (length + subtype + data) |
 *
 * Note: uint32 maps to DOUBLE because max uint32 (4,294,967,295) exceeds signed int32 max (2,147,483,647).
 * Plain `number` without type brand uses runtime check: INT if fits in int32 range, else DOUBLE.
 *
 * ### Variable-Size Types
 *
 * | Deepkit Type                        | BSON Type      | Size Formula                    |
 * |-------------------------------------|----------------|---------------------------------|
 * | `string`                            | STRING (0x02)  | 4 + utf8_length + 1             |
 * | `Uint8Array`, `ArrayBuffer`, etc.   | BINARY (0x05)  | 4 + 1 + data_length             |
 * | `BinaryBigInt`                      | BINARY (0x05)  | 4 + 1 + ceil(hex_digits/2)      |
 * | `SignedBinaryBigInt`                | BINARY (0x05)  | 4 + 1 + 1 + ceil(hex_digits/2)  |
 * | `Array<T>`                          | ARRAY (0x04)   | 4 + encoded_elements + 1        |
 * | `object` / `interface`              | OBJECT (0x03)  | 4 + encoded_fields + 1          |
 * | `RegExp`                            | REGEX (0x0B)   | pattern_cstring + options_cstring |
 *
 * ### Binary Subtypes (for BINARY 0x05)
 *
 * | Subtype | Code | Use                              |
 * |---------|------|----------------------------------|
 * | DEFAULT | 0x00 | Generic binary (Uint8Array, etc.)|
 * | UUID    | 0x04 | UUID type annotation             |
 *
 * ### Property Encoding
 *
 * Each property is encoded as: type_byte(1) + name_cstring(n+1) + value(v)
 * Document structure: size_int32(4) + properties + null_terminator(1)
 */
export enum BSONType {
    DOUBLE = 0x01,
    STRING = 0x02,
    OBJECT = 0x03,
    ARRAY = 0x04,
    BINARY = 0x05,
    UNDEFINED = 0x06, // Deprecated
    OID = 0x07,
    BOOLEAN = 0x08,
    DATE = 0x09,
    NULL = 0x0a,
    REGEX = 0x0b,
    DB_POINTER = 0x0c, // Deprecated
    CODE = 0x0d,
    SYMBOL = 0x0e, // Deprecated
    CODE_W_SCOPE = 0x0f, // Deprecated
    INT = 0x10,
    TIMESTAMP = 0x11,
    LONG = 0x12,
    DECIMAL128 = 0x13,
    MIN_KEY = 0xff,
    MAX_KEY = 0x7f,
}

/**
 * BSON binary subtypes.
 */
export const BSON_BINARY_SUBTYPE_DEFAULT = 0x00;
export const BSON_BINARY_SUBTYPE_UUID = 0x04;

/**
 * ObjectId byte length.
 */
export const OBJECT_ID_BYTE_LENGTH = 12;

/**
 * UUID byte length.
 */
export const UUID_BYTE_LENGTH = 16;

/**
 * Default initial buffer size for serialization.
 */
export const DEFAULT_BUFFER_SIZE = 256;

/**
 * Int32 range for determining if a number fits in int32.
 */
export const INT32_MIN = -2147483648;
export const INT32_MAX = 2147483647;

/**
 * Type for the deserializer function.
 */
export type BSONDeserializer<T> = (buffer: Uint8Array, offset?: number) => T;
