import * as Moment from 'moment';

export let moment: typeof Moment = (() => {
    throw new Error('Moment.js not installed')
}) as any;

declare function require(moduleName: string): any;

try {
    moment = require('moment');
} catch (e) {
}

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

export const BSON_BINARY_SUBTYPE_DEFAULT = 0;
export const BSON_BINARY_SUBTYPE_FUNCTION = 1;
export const BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
export const BSON_BINARY_SUBTYPE_UUID_OLD = 3;
export const BSON_BINARY_SUBTYPE_UUID = 4;
export const BSON_BINARY_SUBTYPE_MD5 = 5;
export const BSON_BINARY_SUBTYPE_USER_DEFINED = 128;

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