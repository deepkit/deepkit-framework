import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MongoId, UUID, float32, float64, int8, int16, int32, uint8, uint16, uint32 } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

describe('BSON Serializer - All Primitive Types', () => {
    describe('string', () => {
        test('basic string', () => {
            interface Doc {
                name: string;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ name: 'hello' }), bson.serialize({ name: 'hello' }));
        });

        test('empty string', () => {
            interface Doc {
                name: string;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ name: '' }), bson.serialize({ name: '' }));
        });

        test('unicode string', () => {
            interface Doc {
                name: string;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ name: '你好世界' }), bson.serialize({ name: '你好世界' }));
        });

        test('emoji string', () => {
            interface Doc {
                name: string;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ name: '🎉🚀' }), bson.serialize({ name: '🎉🚀' }));
        });
    });

    describe('number (plain - runtime check)', () => {
        test('integer in int32 range', () => {
            interface Doc {
                val: number;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ val: 42 }), bson.serialize({ val: 42 }));
        });

        test('float', () => {
            interface Doc {
                val: number;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ val: 3.14 }), bson.serialize({ val: 3.14 }));
        });

        test('large integer (exceeds int32)', () => {
            interface Doc {
                val: number;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ val: 9007199254740991 }), bson.serialize({ val: 9007199254740991 }));
        });
    });

    describe('number brands (fast path)', () => {
        test('int8', () => {
            interface Doc {
                val: int8;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 127 });
            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('int16', () => {
            interface Doc {
                val: int16;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 32767 });
            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('int32', () => {
            interface Doc {
                val: int32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 2147483647 });
            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint8', () => {
            interface Doc {
                val: uint8;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 255 });
            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint16', () => {
            interface Doc {
                val: uint16;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 65535 });
            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint32', () => {
            interface Doc {
                val: uint32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 4294967295 });
            expect(buffer[4]).toBe(0x01); // DOUBLE type (exceeds int32)
        });

        test('float32', () => {
            interface Doc {
                val: float32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 3.14 });
            expect(buffer[4]).toBe(0x01); // DOUBLE type
        });

        test('float64', () => {
            interface Doc {
                val: float64;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 3.141592653589793 });
            expect(buffer[4]).toBe(0x01); // DOUBLE type
        });
    });

    describe('boolean', () => {
        test('true', () => {
            interface Doc {
                active: boolean;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ active: true }), bson.serialize({ active: true }));
        });

        test('false', () => {
            interface Doc {
                active: boolean;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ active: false }), bson.serialize({ active: false }));
        });
    });

    describe('bigint', () => {
        test('positive bigint', () => {
            interface Doc {
                val: bigint;
            }
            const serialize = getBSONSerializer<Doc>();
            const result = serialize({ val: 9007199254740993n });
            expect(result[0][4]).toBe(0x12); // LONG type
            expectBytes(result, bson.serialize({ val: bson.Long.fromBigInt(9007199254740993n) }));
        });

        test('negative bigint', () => {
            interface Doc {
                val: bigint;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ val: -9007199254740993n }), bson.serialize({ val: bson.Long.fromBigInt(-9007199254740993n) }));
        });
    });

    describe('null', () => {
        test('null value', () => {
            interface Doc {
                val: null;
            }
            const serialize = getBSONSerializer<Doc>();
            const result = serialize({ val: null });
            expect(result[0][4]).toBe(0x0a); // NULL type
            expectBytes(result, bson.serialize({ val: null }));
        });
    });

    describe('Date', () => {
        test('current date', () => {
            interface Doc {
                created: Date;
            }
            const serialize = getBSONSerializer<Doc>();
            const date = new Date('2024-01-15T10:30:00.000Z');
            const result = serialize({ created: date });
            expect(result[0][4]).toBe(0x09); // DATE type
            expectBytes(result, bson.serialize({ created: date }));
        });

        test('epoch date', () => {
            interface Doc {
                date: Date;
            }
            const serialize = getBSONSerializer<Doc>();
            expectBytes(serialize({ date: new Date(0) }), bson.serialize({ date: new Date(0) }));
        });
    });

    describe('UUID', () => {
        test('UUID string', () => {
            interface Doc {
                id: UUID;
            }
            const serialize = getBSONSerializer<Doc>();
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const result = serialize({ id: uuid });
            expect(result[0][4]).toBe(0x05); // BINARY type
            expectBytes(result, bson.serialize({ id: new bson.UUID(uuid) }));
        });
    });

    describe('MongoId', () => {
        test('ObjectId string', () => {
            interface Doc {
                _id: MongoId;
            }
            const serialize = getBSONSerializer<Doc>();
            const oid = '507f1f77bcf86cd799439011';
            const result = serialize({ _id: oid });
            expect(result[0][4]).toBe(0x07); // OID type
            expectBytes(result, bson.serialize({ _id: new bson.ObjectId(oid) }));
        });
    });

    describe('Uint8Array (binary)', () => {
        test('basic binary', () => {
            interface Doc {
                data: Uint8Array;
            }
            const serialize = getBSONSerializer<Doc>();
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const result = serialize({ data });
            expect(result[0][4]).toBe(0x05); // BINARY type
            expectBytes(result, bson.serialize({ data: new bson.Binary(data) }));
        });

        test('empty binary', () => {
            interface Doc {
                data: Uint8Array;
            }
            const serialize = getBSONSerializer<Doc>();
            const data = new Uint8Array([]);
            expectBytes(serialize({ data }), bson.serialize({ data: new bson.Binary(data) }));
        });
    });

    describe('ArrayBuffer', () => {
        test('basic ArrayBuffer', () => {
            interface Doc {
                data: ArrayBuffer;
            }
            const serialize = getBSONSerializer<Doc>();
            const data = new Uint8Array([1, 2, 3, 4, 5]).buffer;
            const result = serialize({ data });
            expect(result[0][4]).toBe(0x05); // BINARY type
            expectBytes(result, bson.serialize({ data: new bson.Binary(new Uint8Array(data)) }));
        });
    });

    describe('RegExp', () => {
        test('basic regex', () => {
            interface Doc {
                pattern: RegExp;
            }
            const serialize = getBSONSerializer<Doc>();
            const regex = /hello/i;
            const result = serialize({ pattern: regex });
            expect(result[0][4]).toBe(0x0b); // REGEX type
            expectBytes(result, bson.serialize({ pattern: new bson.BSONRegExp('hello', 'i') }));
        });

        test('regex with multiple flags', () => {
            interface Doc {
                pattern: RegExp;
            }
            const serialize = getBSONSerializer<Doc>();
            const regex = /test/im;
            expectBytes(serialize({ pattern: regex }), bson.serialize({ pattern: new bson.BSONRegExp('test', 'im') }));
        });
    });

    describe('Mixed document', () => {
        test('all primitive types together', () => {
            interface Doc {
                _id: MongoId;
                name: string;
                age: int32;
                score: float64;
                active: boolean;
                created: Date;
                data: Uint8Array;
            }

            const serialize = getBSONSerializer<Doc>();
            const doc = {
                _id: '507f1f77bcf86cd799439011',
                name: 'Test User',
                age: 30,
                score: 98.5,
                active: true,
                created: new Date('2024-01-15T10:30:00.000Z'),
                data: new Uint8Array([1, 2, 3]),
            };

            const expected = bson.serialize({
                _id: new bson.ObjectId(doc._id),
                name: doc.name,
                age: doc.age,
                score: doc.score,
                active: doc.active,
                created: doc.created,
                data: new bson.Binary(doc.data),
            });

            expectBytes(serialize(doc), expected);
        });
    });
});
