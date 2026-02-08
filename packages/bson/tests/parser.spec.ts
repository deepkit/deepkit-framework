/**
 * Direct tests for parser functions
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { BSONType, parseArrayElements, parseArrayToArray, parseDocumentFields, parseDocumentToObject } from '../index.js';

const { serialize } = bson;

describe('parseDocumentFields', () => {
    test('basic — returns correct field names, types, and offsets', () => {
        const buffer = serialize({ a: 1, b: 'hello', c: true });

        const doc = parseDocumentFields(buffer, 0, true);

        // Verify field names
        expect(doc.keys.length).toBe(3);
        expect(doc.keys[0]).toBe('a');
        expect(doc.keys[1]).toBe('b');
        expect(doc.keys[2]).toBe('c');

        // Verify field types
        // bson-js serializes small integers as int32 (0x10)
        expect(doc.fields['a'].type).toBe(BSONType.INT);
        expect(doc.fields['b'].type).toBe(BSONType.STRING);
        expect(doc.fields['c'].type).toBe(BSONType.BOOLEAN);

        // Verify offsets exist and are positive numbers
        expect(doc.fields['a'].offset).toBeGreaterThan(0);
        expect(doc.fields['b'].offset).toBeGreaterThan(0);
        expect(doc.fields['c'].offset).toBeGreaterThan(0);

        // Verify offsets are in order (a before b before c)
        expect(doc.fields['b'].offset).toBeGreaterThan(doc.fields['a'].offset);
        expect(doc.fields['c'].offset).toBeGreaterThan(doc.fields['b'].offset);
    });

    test('without collectKeys — keys array is empty', () => {
        const buffer = serialize({ x: 1, y: 2 });

        const doc = parseDocumentFields(buffer, 0, false);

        // keys should be empty when collectKeys is false
        expect(doc.keys.length).toBe(0);

        // But fields should still be populated
        expect(doc.fields['x'].type).toBe(BSONType.INT);
        expect(doc.fields['y'].type).toBe(BSONType.INT);
    });

    test('tolerateErrors — returns partial result on malformed buffer', () => {
        // Craft a buffer where one field parses successfully but a second field's
        // name has no null terminator (readCString will throw "Unexpected end of buffer").
        //
        // The buffer length must equal the document size so the initial size check passes.
        // Layout: size=20, field "a" (int32 = 42), then a second field whose name
        // fills the rest of the buffer with non-null bytes (no null terminator).
        const buf = new Uint8Array([
            20,
            0,
            0,
            0, // doc size = 20 (indices 0-3)
            0x10, // type: int32 (index 4)
            0x61,
            0x00, // field name "a" + null (indices 5-6)
            0x2a,
            0x00,
            0x00,
            0x00, // value 42 (indices 7-10)
            0x10, // type: int32 — second field (index 11)
            0x62,
            0x63,
            0x64,
            0x65, // name bytes with no null terminator (indices 12-15)
            0x66,
            0x67,
            0x68,
            0x69, // more non-null bytes (indices 16-19)
        ]);
        // Total: 20 bytes, matches doc size

        // Without tolerateErrors, should throw (readCString finds no null terminator)
        expect(() => parseDocumentFields(buf, 0, true, false)).toThrow();

        // With tolerateErrors, should return partial result containing field "a"
        const doc = parseDocumentFields(buf, 0, true, true);
        expect(doc.error).toBeDefined();
        expect(doc.fields['a']).toBeDefined();
        expect(doc.fields['a'].type).toBe(BSONType.INT);
    });
});

describe('parseDocumentToObject', () => {
    test('basic — reconstructs object from BSON', () => {
        const buffer = serialize({ a: 1, b: 'hello', c: true });

        const result = parseDocumentToObject(buffer);

        expect(result.a).toBe(1);
        expect(result.b).toBe('hello');
        expect(result.c).toBe(true);
    });

    test('nested objects', () => {
        const buffer = serialize({ outer: { inner: 42 } });

        const result = parseDocumentToObject(buffer);

        expect(typeof result.outer).toBe('object');
        expect(result.outer.inner).toBe(42);
    });

    test('with arrays', () => {
        const buffer = serialize({ items: [1, 2, 3] });

        const result = parseDocumentToObject(buffer);

        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBe(3);
        expect(result.items[0]).toBe(1);
        expect(result.items[1]).toBe(2);
        expect(result.items[2]).toBe(3);
    });

    test('all common BSON types', () => {
        const now = new Date('2024-01-15T12:00:00.000Z');
        const oid = new bson.ObjectId('507f1f77bcf86cd799439011');
        const binData = new bson.Binary(Buffer.from([0xde, 0xad, 0xbe, 0xef]));

        const original = {
            str: 'hello world',
            int32: 42,
            dbl: 3.14,
            bool: true,
            date: now,
            nil: null,
            oid: oid,
            bin: binData,
            regex: /^test$/i,
        };

        const buffer = serialize(original);
        const result = parseDocumentToObject(buffer);

        // string
        expect(result.str).toBe('hello world');

        // int32
        expect(result.int32).toBe(42);

        // double
        expect(typeof result.dbl).toBe('number');
        expect(Math.abs(result.dbl - 3.14) < 0.001).toBe(true);

        // boolean
        expect(result.bool).toBe(true);

        // date
        expect(result.date).toBeInstanceOf(Date);
        expect(result.date.getTime()).toBe(now.getTime());

        // null
        expect(result.nil).toBe(null);

        // objectId — parsed as hex string
        expect(typeof result.oid).toBe('string');
        expect(result.oid).toBe('507f1f77bcf86cd799439011');

        // binary — parsed as Uint8Array
        expect(result.bin).toBeInstanceOf(Uint8Array);
        expect(result.bin[0]).toBe(0xde);
        expect(result.bin[1]).toBe(0xad);
        expect(result.bin[2]).toBe(0xbe);
        expect(result.bin[3]).toBe(0xef);

        // regex
        expect(result.regex).toBeInstanceOf(RegExp);
        expect(result.regex.source).toBe('^test$');
        expect(result.regex.flags).toBe('i');
    });

    test('empty document', () => {
        const buffer = serialize({});

        const result = parseDocumentToObject(buffer);

        expect(Object.keys(result).length).toBe(0);
    });

    test('string with unicode', () => {
        const buffer = serialize({ emoji: '\u00e9\u00e8\u00ea', cjk: '\u4e16\u754c' });

        const result = parseDocumentToObject(buffer);

        expect(result.emoji).toBe('\u00e9\u00e8\u00ea');
        expect(result.cjk).toBe('\u4e16\u754c');
    });

    test('large integer as double', () => {
        // Numbers larger than int32 max are stored as doubles by bson-js
        const buffer = serialize({ big: 2147483648 });

        const result = parseDocumentToObject(buffer);

        expect(result.big).toBe(2147483648);
    });

    test('negative integers', () => {
        const buffer = serialize({ neg: -42, negBig: -2147483648 });

        const result = parseDocumentToObject(buffer);

        expect(result.neg).toBe(-42);
        expect(result.negBig).toBe(-2147483648);
    });
});

describe('parseArrayElements', () => {
    test('basic — returns correct element types and offsets', () => {
        // BSON arrays are encoded as documents inside a parent document
        // Serialize { arr: [1, 'two', true] } and extract the array sub-document
        const buffer = serialize({ arr: [1, 'two', true] });

        // First parse the outer document to find the array field
        const doc = parseDocumentFields(buffer, 0, true);
        expect(doc.fields['arr']).toBeDefined();
        expect(doc.fields['arr'].type).toBe(BSONType.ARRAY);

        // Now parse the array at the offset
        const arr = parseArrayElements(buffer, doc.fields['arr'].offset);

        expect(arr.elements.length).toBe(3);

        // First element: 1 (int32)
        expect(arr.elements[0].type).toBe(BSONType.INT);

        // Second element: 'two' (string)
        expect(arr.elements[1].type).toBe(BSONType.STRING);

        // Third element: true (boolean)
        expect(arr.elements[2].type).toBe(BSONType.BOOLEAN);
    });

    test('empty array', () => {
        const buffer = serialize({ arr: [] });

        const doc = parseDocumentFields(buffer, 0, true);
        const arr = parseArrayElements(buffer, doc.fields['arr'].offset);

        expect(arr.elements.length).toBe(0);
    });

    test('homogeneous array', () => {
        const buffer = serialize({ arr: [10, 20, 30, 40, 50] });

        const doc = parseDocumentFields(buffer, 0, true);
        const arr = parseArrayElements(buffer, doc.fields['arr'].offset);

        expect(arr.elements.length).toBe(5);
        for (const elem of arr.elements) {
            expect(elem.type).toBe(BSONType.INT);
        }
    });
});

describe('parseArrayToArray', () => {
    test('basic — reconstructs array from BSON', () => {
        const buffer = serialize({ arr: [1, 'two', true] });

        // Find the array offset
        const doc = parseDocumentFields(buffer, 0, true);
        const arrOffset = doc.fields['arr'].offset;

        const result = parseArrayToArray(buffer, arrOffset);

        expect(result.length).toBe(3);
        expect(result[0]).toBe(1);
        expect(result[1]).toBe('two');
        expect(result[2]).toBe(true);
    });

    test('nested arrays', () => {
        const buffer = serialize({
            arr: [
                [1, 2],
                [3, 4],
            ],
        });

        const doc = parseDocumentFields(buffer, 0, true);
        const result = parseArrayToArray(buffer, doc.fields['arr'].offset);

        expect(result.length).toBe(2);
        expect(Array.isArray(result[0])).toBe(true);
        expect(Array.isArray(result[1])).toBe(true);
        expect(result[0][0]).toBe(1);
        expect(result[0][1]).toBe(2);
        expect(result[1][0]).toBe(3);
        expect(result[1][1]).toBe(4);
    });

    test('array with mixed types including nested objects', () => {
        const buffer = serialize({ arr: [42, 'hello', { key: 'val' }, [1, 2], true, null] });

        const doc = parseDocumentFields(buffer, 0, true);
        const result = parseArrayToArray(buffer, doc.fields['arr'].offset);

        expect(result.length).toBe(6);
        expect(result[0]).toBe(42);
        expect(result[1]).toBe('hello');
        expect(typeof result[2]).toBe('object');
        expect(result[2].key).toBe('val');
        expect(Array.isArray(result[3])).toBe(true);
        expect(result[3]).toEqual([1, 2]);
        expect(result[4]).toBe(true);
        expect(result[5]).toBe(null);
    });
});

describe('parseDocumentFields — empty document', () => {
    test('returns empty fields list for empty document', () => {
        const buffer = serialize({});

        const doc = parseDocumentFields(buffer, 0, true);

        expect(doc.keys.length).toBe(0);
        expect(Object.keys(doc.fields).length).toBe(0);
    });
});
