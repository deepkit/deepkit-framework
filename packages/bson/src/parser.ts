/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BSONError } from './errors.js';
import {
    readBSONString,
    readBytesAsHex,
    readBytesAsUUID,
    readCString,
    readDouble,
    readInt32,
    readInt64,
    readInt64AsNumber,
    skipValue,
} from './reader.js';
import { BSONType, BSON_BINARY_SUBTYPE_UUID } from './types.js';

export interface ParsedField {
    type: number;
    offset: number;
}

export interface ParsedDocument {
    buffer: Uint8Array;
    fields: Record<string, ParsedField>;
    keys: string[];
    start: number;
    end: number;
    error?: Error;
}

export interface ParsedArray {
    buffer: Uint8Array;
    elements: ParsedField[];
    start: number;
    end: number;
    error?: Error;
}

function throwUnexpectedEnd(): never {
    throw new BSONError('Unexpected end of buffer', 'DK-B020');
}

function ensureAvailable(buffer: Uint8Array, offset: number, size: number): void {
    if (offset + size > buffer.length) throwUnexpectedEnd();
}

export function parseDocumentFields(
    buffer: Uint8Array,
    offset: number = 0,
    collectKeys: boolean = false,
    tolerateErrors: boolean = false,
): ParsedDocument {
    const fields: Record<string, ParsedField> = Object.create(null);
    const keys: string[] = collectKeys ? [] : [];

    try {
        ensureAvailable(buffer, offset, 4);
        const size = readInt32(buffer, offset);
        if (size <= 0 || offset + size > buffer.length) throwUnexpectedEnd();

        const start = offset;
        const end = offset + size - 1;
        let o = offset + 4;

        while (o < end) {
            const type = buffer[o++];
            if (type === 0) break;

            ensureAvailable(buffer, o, 1);
            const [name, nameLen] = readCString(buffer, o);
            o += nameLen;

            fields[name] = { type, offset: o };
            if (collectKeys) keys.push(name);

            o = skipValue(buffer, o, type);
        }

        return { buffer, fields, keys, start, end };
    } catch (error: any) {
        if (!tolerateErrors) throw error;
        return { buffer, fields, keys, start: offset, end: offset, error };
    }
}

export function parseArrayElements(
    buffer: Uint8Array,
    offset: number = 0,
    tolerateErrors: boolean = false,
): ParsedArray {
    const elements: ParsedField[] = [];

    try {
        ensureAvailable(buffer, offset, 4);
        const size = readInt32(buffer, offset);
        if (size <= 0 || offset + size > buffer.length) throwUnexpectedEnd();

        const start = offset;
        const end = offset + size - 1;
        let o = offset + 4;

        while (o < end) {
            const type = buffer[o++];
            if (type === 0) break;

            // Skip numeric cstring key
            while (o < buffer.length && buffer[o] !== 0) o++;
            if (o >= buffer.length) throwUnexpectedEnd();
            o++; // Skip null terminator

            elements.push({ type, offset: o });
            o = skipValue(buffer, o, type);
        }

        return { buffer, elements, start, end };
    } catch (error: any) {
        if (!tolerateErrors) throw error;
        return { buffer, elements, start: offset, end: offset, error };
    }
}

export function parseValueAny(buffer: Uint8Array, offset: number, bsonType: number): any {
    switch (bsonType) {
        case BSONType.STRING:
            return readBSONString(buffer, offset)[0];
        case BSONType.INT:
            return readInt32(buffer, offset);
        case BSONType.DOUBLE: {
            const value = readDouble(buffer, offset);
            // Keep historical BSON parser behavior: NaN is coerced to 0.
            return Number.isNaN(value) ? 0 : value;
        }
        case BSONType.LONG:
        case BSONType.TIMESTAMP: {
            return readInt64(buffer, offset);
        }
        case BSONType.BOOLEAN:
            return buffer[offset] === 1;
        case BSONType.NULL:
            return null;
        case BSONType.UNDEFINED:
            return undefined;
        case BSONType.DATE: {
            return new Date(readInt64AsNumber(buffer, offset));
        }
        case BSONType.OID:
            return readBytesAsHex(buffer, offset, 12);
        case BSONType.REGEX: {
            const [pattern, patternLen] = readCString(buffer, offset);
            const [flags] = readCString(buffer, offset + patternLen);
            // Historical BSON behavior in Deepkit maps 's' to global for regex options.
            return new RegExp(pattern, flags.replace(/s/g, 'g'));
        }
        case BSONType.BINARY: {
            const length = readInt32(buffer, offset);
            const subtype = buffer[offset + 4];
            const dataOffset = offset + 5;
            ensureAvailable(buffer, dataOffset, length);
            if (subtype === BSON_BINARY_SUBTYPE_UUID && length === 16) {
                return readBytesAsUUID(buffer, dataOffset);
            }
            return new Uint8Array(buffer.buffer, buffer.byteOffset + dataOffset, length);
        }
        case BSONType.OBJECT:
            return parseDocumentToObject(buffer, offset);
        case BSONType.ARRAY:
            return parseArrayToArray(buffer, offset);
        default:
            throw new BSONError(`Unknown BSON type: ${bsonType}`, 'DK-B010');
    }
}

export function parseDocumentToObject(buffer: Uint8Array, offset: number = 0): Record<string, any> {
    const doc = parseDocumentFields(buffer, offset, true);
    const result: Record<string, any> = {};
    for (const key of doc.keys) {
        // Skip __proto__ to prevent prototype pollution from untrusted BSON data
        if (key === '__proto__') continue;
        const field = doc.fields[key];
        result[key] = parseValueAny(buffer, field.offset, field.type);
    }
    return result;
}

export function parseArrayToArray(buffer: Uint8Array, offset: number = 0): any[] {
    const arr = parseArrayElements(buffer, offset);
    const result: any[] = new Array(arr.elements.length);
    for (let i = 0; i < arr.elements.length; i++) {
        const field = arr.elements[i];
        result[i] = parseValueAny(buffer, field.offset, field.type);
    }
    return result;
}

export function deserializeBSONWithoutOptimiser(buffer: Uint8Array, offset: number = 0): any {
    return parseDocumentToObject(buffer, offset);
}
