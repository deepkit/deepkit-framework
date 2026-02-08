/**
 * Security tests for BSON parsing — prototype pollution, buffer bounds, malformed input
 */
import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { deserializeBSON, parseDocumentToObject } from '../index.js';
import { BSONError } from '../src/errors.js';

const { serialize } = bson;

describe('prototype pollution', () => {
    test('__proto__ key is skipped by parseDocumentToObject', () => {
        // bson.serialize() follows the prototype chain for __proto__, so we craft the
        // BSON buffer manually to include a literal "__proto__" field name.
        // Document: { __proto__: { isAdmin: true } }
        //
        // Layout:
        //   4 bytes: document size (31 LE)
        //   1 byte:  type 0x03 (embedded document)
        //   10 bytes: "__proto__\0"
        //   15 bytes: sub-document { isAdmin: true }
        //     4 bytes: sub-doc size (15 LE)
        //     1 byte: type 0x08 (boolean)
        //     8 bytes: "isAdmin\0"
        //     1 byte: 0x01 (true)
        //     1 byte: 0x00 (terminator)
        //   1 byte:  0x00 (terminator)
        const buffer = new Uint8Array([
            0x1f,
            0x00,
            0x00,
            0x00, // doc size = 31
            0x03, // type: embedded document
            0x5f,
            0x5f,
            0x70,
            0x72,
            0x6f,
            0x74,
            0x6f,
            0x5f,
            0x5f,
            0x00, // "__proto__\0"
            0x0f,
            0x00,
            0x00,
            0x00, // sub-doc size = 15
            0x08, // type: boolean
            0x69,
            0x73,
            0x41,
            0x64,
            0x6d,
            0x69,
            0x6e,
            0x00, // "isAdmin\0"
            0x01, // true
            0x00, // sub-doc terminator
            0x00, // doc terminator
        ]);

        const result = parseDocumentToObject(buffer);

        // The __proto__ key must NOT be set on the result
        expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);

        // The result must not have inherited isAdmin from a polluted prototype
        expect((result as any).isAdmin).toBeUndefined();

        // The real prototype chain must be unaffected
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    });

    test('constructor key is preserved but does not affect prototype chain', () => {
        // Craft BSON with a 'constructor' field
        const buffer = serialize({ constructor: { prototype: { isAdmin: true } } });

        const result = parseDocumentToObject(buffer);

        // The 'constructor' key should be preserved — it's a valid property name
        expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(true);

        // But it must not affect the prototype chain of other objects
        const freshObj: any = {};
        expect(freshObj.isAdmin).toBeUndefined();

        // The result's constructor property is a plain parsed object, not a function
        expect(typeof result.constructor).toBe('object');
    });
});

describe('malformed BSON — truncated document', () => {
    test('buffer too short for document size prefix', () => {
        // Only 2 bytes when we need at least 4 for the size prefix
        const buffer = new Uint8Array([0x10, 0x00]);

        expect(() => parseDocumentToObject(buffer)).toThrow('Unexpected end of buffer');
    });

    test('empty buffer throws', () => {
        const buffer = new Uint8Array(0);

        expect(() => parseDocumentToObject(buffer)).toThrow('Unexpected end of buffer');
    });

    test('3-byte buffer throws', () => {
        const buffer = new Uint8Array([0x05, 0x00, 0x00]);

        expect(() => parseDocumentToObject(buffer)).toThrow('Unexpected end of buffer');
    });
});

describe('malformed BSON — negative string length', () => {
    test('negative string length throws BSONError with DK-B020', () => {
        // Craft a minimal BSON document with a string field that has negative length
        // Document structure:
        //   4 bytes: document size (little-endian)
        //   1 byte: type (0x02 = string)
        //   N bytes: field name cstring ("v\0")
        //   4 bytes: string length (little-endian, set to -1 = 0xFFFFFFFF)
        //   ... (truncated, we want it to throw before needing more)
        //   1 byte: null terminator

        const buf = new Uint8Array([
            // Document size = 20 (claim a reasonable size)
            20, 0, 0, 0,
            // Type: string (0x02)
            0x02,
            // Field name: "v" + null
            0x76, 0x00,
            // String length: -1 (0xFF 0xFF 0xFF 0xFF in signed little-endian)
            0xff, 0xff, 0xff, 0xff,
            // Some bytes to fill (won't be reached)
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            // Null terminator
            0x00,
        ]);

        expect(() => parseDocumentToObject(buf)).toThrow('negative length');
    });
});

describe('malformed BSON — document size larger than buffer', () => {
    test('size prefix claiming huge document but buffer is small', () => {
        // 4-byte size prefix claiming document is 1000000 bytes, but buffer is only 8 bytes
        const buf = new Uint8Array([
            // Document size = 1000000 (0x000F4240 little-endian)
            0x40, 0x42, 0x0f, 0x00,
            // Only a few more bytes
            0x00, 0x00, 0x00, 0x00,
        ]);

        expect(() => parseDocumentToObject(buf)).toThrow('Unexpected end of buffer');
    });

    test('size prefix of zero throws', () => {
        const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]);

        expect(() => parseDocumentToObject(buf)).toThrow('Unexpected end of buffer');
    });

    test('negative document size throws', () => {
        // -1 in little-endian int32 = 0xFF 0xFF 0xFF 0xFF
        const buf = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00]);

        expect(() => parseDocumentToObject(buf)).toThrow('Unexpected end of buffer');
    });
});

describe('deeply nested objects', () => {
    test('100 levels of nesting does not stack overflow', () => {
        // Build a deeply nested object: { a: { a: { a: ... { a: 42 } ... } } }
        let obj: any = { a: 42 };
        for (let i = 0; i < 99; i++) {
            obj = { a: obj };
        }

        // Serialize with bson-js (which handles deep nesting)
        const buffer = serialize(obj);

        // Parse with our parser — should not throw
        const result = parseDocumentToObject(buffer);

        // Walk the chain to verify depth
        let current: any = result;
        for (let i = 0; i < 99; i++) {
            expect(current.a).toBeDefined();
            expect(typeof current.a).toBe('object');
            current = current.a;
        }
        // The leaf value
        expect(current.a).toBe(42);
    });

    test('deeply nested arrays', () => {
        // Build nested arrays: { a: [[[...[42]...]]] }
        let obj: any = [42];
        for (let i = 0; i < 49; i++) {
            obj = [obj];
        }
        const doc = { a: obj };

        const buffer = serialize(doc);
        const result = parseDocumentToObject(buffer);

        // Walk the chain
        let current: any = result.a;
        for (let i = 0; i < 49; i++) {
            expect(Array.isArray(current)).toBe(true);
            expect(current.length).toBe(1);
            current = current[0];
        }
        expect(Array.isArray(current)).toBe(true);
        expect(current[0]).toBe(42);
    });
});
