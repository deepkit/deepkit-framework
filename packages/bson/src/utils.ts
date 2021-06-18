/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export const TWO_PWR_32_DBL_N = (1 << 16) * (1 << 16);

export const BSON_DATA_NUMBER = 1;
export const BSON_DATA_STRING = 2;
export const BSON_DATA_OBJECT = 3;
export const BSON_DATA_ARRAY = 4;
export const BSON_DATA_BINARY = 5;
export const BSON_DATA_UNDEFINED = 6;
export const BSON_DATA_OID = 7;
export const BSON_DATA_BOOLEAN = 8;
export const BSON_DATA_DATE = 9;
export const BSON_DATA_NULL = 10;
export const BSON_DATA_REGEXP = 11;
export const BSON_DATA_DBPOINTER = 12;
export const BSON_DATA_CODE = 13;
export const BSON_DATA_SYMBOL = 14;
export const BSON_DATA_CODE_W_SCOPE = 15;
export const BSON_DATA_INT = 16;
export const BSON_DATA_TIMESTAMP = 17;
export const BSON_DATA_LONG = 18;
export const BSON_DATA_DECIMAL128 = 19;
export const BSON_DATA_MIN_KEY = 0xff;
export const BSON_DATA_MAX_KEY = 0x7f;

export const enum BSONType {
    NUMBER = 1,
    STRING = 2,
    OBJECT = 3,
    ARRAY = 4,
    BINARY = 5,
    UNDEFINED = 6,
    OID = 7,
    BOOLEAN = 8,
    DATE = 9,
    NULL = 10,
    REGEXP = 11,
    DBPOINTER = 12,
    CODE = 13,
    SYMBOL = 14,
    CODE_W_SCOPE = 15,
    INT = 16,
    TIMESTAMP = 17,
    LONG = 18,
    DECIMAL128 = 19,
    MIN_KEY = 0xff,
    MAX_KEY = 0x7f,
}

export const BSON_BINARY_SUBTYPE_DEFAULT = 0;
export const BSON_BINARY_SUBTYPE_FUNCTION = 1;
export const BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
export const BSON_BINARY_SUBTYPE_UUID_OLD = 3;
export const BSON_BINARY_SUBTYPE_UUID = 4;
export const BSON_BINARY_SUBTYPE_MD5 = 5;
export const BSON_BINARY_SUBTYPE_USER_DEFINED = 128;
export const BSON_BINARY_SUBTYPE_BIGINT = 127;

export function digitByteSize(v: number): number {
    if (v < 10) return 2;
    if (v < 100) return 3;
    if (v < 1000) return 4;
    if (v < 10000) return 5;
    if (v < 100000) return 6;
    if (v < 1000000) return 7;
    if (v < 10000000) return 8;
    if (v < 100000000) return 9;
    if (v < 1000000000) return 10;
    return 11;
}
