import * as bson from 'bson';
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MongoId, UUID, float32, float64, int8, int16, int32, uint8, uint16, uint32 } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

describe('BSON Serializer - Fixed Size Types', () => {
    describe('Date', () => {
        test('serialize Date', () => {
            interface Doc {
                created: Date;
            }
            const serialize = getBSONSerializer<Doc>();
            const date = new Date('2024-01-15T10:30:00.000Z');
            expectBytes(serialize({ created: date }), bson.serialize({ created: date }));
        });

        test('serialize epoch date', () => {
            interface Doc {
                epoch: Date;
            }
            const serialize = getBSONSerializer<Doc>();
            const date = new Date(0);
            expectBytes(serialize({ epoch: date }), bson.serialize({ epoch: date }));
        });

        test('serialize future date', () => {
            interface Doc {
                future: Date;
            }
            const serialize = getBSONSerializer<Doc>();
            const date = new Date('2099-12-31T23:59:59.999Z');
            expectBytes(serialize({ future: date }), bson.serialize({ future: date }));
        });
    });

    describe('UUID', () => {
        test('serialize UUID', () => {
            interface Doc {
                id: UUID;
            }
            const serialize = getBSONSerializer<Doc>();
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const [buffer, size] = serialize({ id: uuid });

            // BSON binary format: type(1) + name "id\0"(3) + length(4) + subtype(1) + data(16)
            // Document: size(4) + field + terminator(1)
            expect(size).toBe(4 + 1 + 3 + 4 + 1 + 16 + 1); // 30 bytes

            // Check type byte
            expect(buffer[4]).toBe(0x05); // BINARY type

            // Check length
            const view = new DataView(buffer.buffer);
            expect(view.getInt32(8, true)).toBe(16);

            // Check subtype
            expect(buffer[12]).toBe(0x04); // UUID subtype
        });

        test('serialize UUID matches bson-js', () => {
            interface Doc {
                id: UUID;
            }
            const serialize = getBSONSerializer<Doc>();
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            expectBytes(serialize({ id: uuid }), bson.serialize({ id: new bson.UUID(uuid) }));
        });
    });

    describe('MongoId (ObjectId)', () => {
        test('serialize MongoId', () => {
            interface Doc {
                _id: MongoId;
            }
            const serialize = getBSONSerializer<Doc>();
            const oid = '507f1f77bcf86cd799439011';
            const [buffer, size] = serialize({ _id: oid });

            // BSON OID format: type(1) + name "_id\0"(4) + data(12)
            // Document: size(4) + field + terminator(1)
            expect(size).toBe(4 + 1 + 4 + 12 + 1); // 22 bytes

            // Check type byte
            expect(buffer[4]).toBe(0x07); // OID type
        });

        test('serialize MongoId matches bson-js', () => {
            interface Doc {
                _id: MongoId;
            }
            const serialize = getBSONSerializer<Doc>();
            const oid = '507f1f77bcf86cd799439011';
            expectBytes(serialize({ _id: oid }), bson.serialize({ _id: new bson.ObjectId(oid) }));
        });
    });

    describe('All number brands', () => {
        test('int8 serializes as INT', () => {
            interface Doc {
                val: int8;
            }
            const serialize = getBSONSerializer<Doc>();
            const result = serialize({ val: 127 });
            expect(result[0][4]).toBe(0x10); // INT type
            expectBytes(result, bson.serialize({ val: 127 }));
        });

        test('int16 serializes as INT', () => {
            interface Doc {
                val: int16;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 32767 });

            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('int32 serializes as INT', () => {
            interface Doc {
                val: int32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 2147483647 });

            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint8 serializes as INT', () => {
            interface Doc {
                val: uint8;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 255 });

            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint16 serializes as INT', () => {
            interface Doc {
                val: uint16;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 65535 });

            expect(buffer[4]).toBe(0x10); // INT type
        });

        test('uint32 serializes as DOUBLE (exceeds int32 range)', () => {
            interface Doc {
                val: uint32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 4294967295 });

            expect(buffer[4]).toBe(0x01); // DOUBLE type
        });

        test('float32 serializes as DOUBLE', () => {
            interface Doc {
                val: float32;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 3.14 });

            expect(buffer[4]).toBe(0x01); // DOUBLE type
        });

        test('float64 serializes as DOUBLE', () => {
            interface Doc {
                val: float64;
            }
            const serialize = getBSONSerializer<Doc>();
            const [buffer, size] = serialize({ val: 3.141592653589793 });

            expect(buffer[4]).toBe(0x01); // DOUBLE type
        });
    });

    describe('bigint', () => {
        test('bigint serializes as LONG', () => {
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

    describe('Mixed fixed-size document', () => {
        test('document with multiple fixed-size fields', () => {
            interface Doc {
                _id: MongoId;
                count: int32;
                score: float64;
                active: boolean;
                created: Date;
            }

            const serialize = getBSONSerializer<Doc>();
            const doc = {
                _id: '507f1f77bcf86cd799439011',
                count: 42,
                score: 98.5,
                active: true,
                created: new Date('2024-01-15T10:30:00.000Z'),
            };

            const expected = bson.serialize({
                _id: new bson.ObjectId(doc._id),
                count: 42,
                score: 98.5,
                active: true,
                created: doc.created,
            });

            expectBytes(serialize(doc), expected);
        });
    });
});
