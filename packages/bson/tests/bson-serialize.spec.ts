import { expect, test } from '@jest/globals';
import { getBSONSerializer, getBSONSizer, getValueSize, hexToByte, uuidStringToByte } from '../src/bson-serializer';
import { BinaryBigInt, createReference, Embedded, Excluded, MongoId, nodeBufferToArrayBuffer, PrimaryKey, Reference, SignedBinaryBigInt, typeOf, uuid, UUID } from '@deepkit/type';
import bson from 'bson';
import { randomBytes } from 'crypto';
import { BSON_BINARY_SUBTYPE_DEFAULT, BSONType } from '../src/utils';
import { deserializeBSONWithoutOptimiser } from '../src/bson-parser';

const { Binary, calculateObjectSize, deserialize, Long, ObjectId: OfficialObjectId, serialize } = bson;

test('hexToByte', () => {
    expect(hexToByte('00')).toBe(0);
    expect(hexToByte('01')).toBe(1);
    expect(hexToByte('0f')).toBe(15);
    expect(hexToByte('10')).toBe(16);
    expect(hexToByte('ff')).toBe(255);
    expect(hexToByte('f0')).toBe(240);
    expect(hexToByte('50')).toBe(80);
    expect(hexToByte('7f')).toBe(127);
    expect(hexToByte('f00f', 1)).toBe(15);
    expect(hexToByte('f0ff', 1)).toBe(255);
    expect(hexToByte('f00001', 2)).toBe(1);

    expect(hexToByte('f8')).toBe(16 * 15 + 8);
    expect(hexToByte('41')).toBe(16 * 4 + 1);

    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 1)).toBe(16 * 15 + 8);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 4)).toBe(16 * 4 + 1);

    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 6)).toBe(16 * 4 + 4);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 7)).toBe(16 * 2 + 15);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 8)).toBe(16 * 11 + 7);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 10)).toBe(16 * 12 + 3);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 11)).toBe(16 * 10 + 1);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 15)).toBe(16 * 6 + 12);
});

test('basic string', () => {
    const object = { name: 'Peter' };

    const expectedSize =
            4 //size uint32
            + 1 // type (string)
            + 'name\0'.length
            + (
                4 //string size uint32
                + 'Peter'.length + 1 //string content + null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        name: string,
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

test('basic number int', () => {
    const object = { position: 24 };

    const expectedSize =
            4 //size uint32
            + 1 // type (number)
            + 'position\0'.length
            + (
                4 //int uint32
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        position: number,
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

test('basic long', () => {
    const object = { position: 3364367088039355000n };

    //23
    const expectedSize =
            4 //size uint32
            + 1 // type (number)
            + 'position\0'.length
            + (
                4 //uint32 low bits
                + 4 //uint32 high bits
            )
            + 1 //object null
    ;

    const schema = typeOf<{
        position: number,
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    // expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object)); //mongo doesnt support bigint

    const serializer = getBSONSerializer(undefined, schema);
    // const deserializer = getBSONDecoder(schema);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(serializer(object).byteLength).toBe(expectedSize);

    // const reParsed = getBSONDecoder<any>(schema)(serializer(object));
    // expect(reParsed.position).toBe(3364367088039355000n);

    expect(serializer({ position: 123456n })).toEqual(serialize({ position: Long.fromNumber(123456) }));
    expect(serializer({ position: -123456n })).toEqual(serialize({ position: Long.fromNumber(-123456) }));
    expect(serializer({ position: 3364367088039355000n })).toEqual(serialize({ position: Long.fromBigInt(3364367088039355000n) }));
    expect(serializer({ position: -3364367088039355000n })).toEqual(serialize({ position: Long.fromBigInt(-3364367088039355000n) }));

    // expect(deserializer(serializer({ position: 3364367088039355000n }))).toEqual({ position: 3364367088039355000n });
    // expect(deserializer(serializer({ position: -3364367088039355000n }))).toEqual({ position: -3364367088039355000n });
});

test('basic bigint', () => {
    const object = { position: 3364367088039355000n };

    const expectedSize =
            4 //size uint32
            + 1 // type (binary)
            + 'position\0'.length
            + (
                4 //uint32 low bits
                + 4 //uint32 high bits
            )
            + 1 //object null
    ;

    const schema = typeOf<{
        position: bigint,
    }>();

    const serializer = getBSONSerializer(undefined, schema);
    // const deserializer = getBSONDecoder(schema);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(serializer(object).byteLength).toBe(expectedSize);

    // const reParsed = deserializer(serializer(object));
    // expect(reParsed.position).toBe(3364367088039355000n);

    //this cases are valid when dynamic bigint serialization is activated
    // expect(serializer({ position: 123456n })).toEqual(serialize({ position: 123456 }));
    // expect(serializer({ position: -123456n })).toEqual(serialize({ position: -123456 }));
    // expect(serializer({ position: 3364367088039355000n })).toEqual(serialize({ position: Long.fromBigInt(3364367088039355000n) }));
    // expect(serializer({ position: -3364367088039355000n })).toEqual(serialize({ position: Long.fromBigInt(-3364367088039355000n) }));
    //
    // expect(serializer({ position: 9223372036854775807n })).toEqual(serialize({ position: Long.fromBigInt(9223372036854775807n) }));
    // expect(serializer({ position: -9223372036854775807n })).toEqual(serialize({ position: Long.fromBigInt(-9223372036854775807n) }));

    // expect(deserializer(serializer({ position: 123456n }))).toEqual({ position: 123456n });
    // expect(deserializer(serializer({ position: -123456n }))).toEqual({ position: -123456n });
    // expect(deserializer(serializer({ position: 3364367088039355000n }))).toEqual({ position: 3364367088039355000n });
    // expect(deserializer(serializer({ position: -3364367088039355000n }))).toEqual({ position: -3364367088039355000n });
    //
    // expect(deserializer(serializer({ position: 9223372036854775807n }))).toEqual({ position: 9223372036854775807n });
    // expect(deserializer(serializer({ position: -9223372036854775807n }))).toEqual({ position: -9223372036854775807n });

});

test('basic BinaryBigInt', () => {
    const object = { position: 3364367088039355000n };

    const expectedSize =
            4 //size uint32
            + 1 // type (binary)
            + 'position\0'.length
            + (
                4 //binary size
                + 1 //binary type
                + 8 //binary content
            )
            + 1 //object null
    ;

    const schema = typeOf<{
        position: BinaryBigInt,
    }>();

    const serializer = getBSONSerializer(undefined, schema);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(serializer(object).byteLength).toBe(expectedSize);

    {
        const bson = serializer({ position: 9223372036854775810n }); //force binary format
        expect(bson).toEqual(Buffer.from([
            28, 0, 0, 0, //size
            BSONType.BINARY, //type long
            112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string

            8, 0, 0, 0, //binary size, int32
            BSON_BINARY_SUBTYPE_DEFAULT, //binary type

            128, 0, 0, 0, 0, 0, 0, 2, //binary data

            0, //object null
        ]));
    }

    {
        const bson = serializer({ position: -9223372036854775810n }); //force binary format
        expect(bson).toEqual(Buffer.from([
            28, 0, 0, 0, //size
            BSONType.BINARY, //type long
            112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string

            8, 0, 0, 0, //binary size, int32
            BSON_BINARY_SUBTYPE_DEFAULT, //binary type

            128, 0, 0, 0, 0, 0, 0, 2, //binary data

            0, //object null
        ]));
    }
});

test('basic SignedBinaryBigInt', () => {
    const object = { position: 3364367088039355000n };

    const expectedSize =
            4 //size uint32
            + 1 // type (binary)
            + 'position\0'.length
            + (
                4 //binary size
                + 1 //binary type
                + 9 //binary content
            )
            + 1 //object null
    ;

    const schema = typeOf<{
        position: SignedBinaryBigInt,
    }>();

    const serializer = getBSONSerializer(undefined, schema);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(serializer(object).byteLength).toBe(expectedSize);

    {
        const bson = serializer({ position: 9223372036854775810n }); //force binary format
        expect(bson).toEqual(Buffer.from([
            29, 0, 0, 0, //size
            BSONType.BINARY, //type long
            112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string

            9, 0, 0, 0, //binary size, int32
            BSON_BINARY_SUBTYPE_DEFAULT, //binary type

            0, //signum
            128, 0, 0, 0, 0, 0, 0, 2, //binary data

            0, //object null
        ]));
    }

    {
        const bson = serializer({ position: -9223372036854775810n }); //force binary format
        expect(bson).toEqual(Buffer.from([
            29, 0, 0, 0, //size
            BSONType.BINARY, //type long
            112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string

            9, 0, 0, 0, //binary size, int32
            BSON_BINARY_SUBTYPE_DEFAULT, //binary type

            255, //signum, 255 = -1
            128, 0, 0, 0, 0, 0, 0, 2, //binary data

            0, //object null
        ]));
    }
});

// test('basic any bigint', () => {
//     const object = { position: 3364367088039355000n };
//
//     const expectedSize =
//             4 //size uint32
//             + 1 // type (binary)
//             + 'position\0'.length
//             + (
//                 4 //binary size
//                 + 1 //binary type
//                 + 9 //binary content
//             )
//             + 1 //object null
//     ;
//
//     const schema = t.schema({
//         position: t.any,
//     });
//
//     const serializer = getBSONSerializer(undefined, schema);
//     const deserializer = getBSONDecoder(schema);
//     expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
//     expect(serializer(object).byteLength).toBe(expectedSize);
//
//     const reParsed = getBSONDecoder(schema)(serializer(object));
//     expect(reParsed.position).toBe(3364367088039355000n);
//
//     expect(deserializer(serializer({ position: 123456n }))).toEqual({ position: 123456n });
//     expect(deserializer(serializer({ position: -123456n }))).toEqual({ position: -123456n });
//     expect(deserializer(serializer({ position: 3364367088039355000n }))).toEqual({ position: 3364367088039355000n });
//     expect(deserializer(serializer({ position: -3364367088039355000n }))).toEqual({ position: -3364367088039355000n });
//
//     expect(deserializer(serializer({ position: 9223372036854775807n }))).toEqual({ position: 9223372036854775807n });
//     expect(deserializer(serializer({ position: -9223372036854775807n }))).toEqual({ position: -9223372036854775807n });
//
//     {
//         const bson = serializer({ position: 9223372036854775810n }); //force binary format
//         expect(bson).toEqual(Buffer.from([
//             29, 0, 0, 0, //size
//             BSONType.BINARY, //type long
//             112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string
//
//             9, 0, 0, 0, //binary size, int32
//             BSON_BINARY_SUBTYPE_BIGINT, //binary type
//
//             1, //signum
//             128, 0, 0, 0, 0, 0, 0, 2, //binary data
//
//             0, //object null
//         ]));
//     }
//
//     {
//         const bson = serializer({ position: -9223372036854775810n }); //force binary format
//         expect(bson).toEqual(Buffer.from([
//             29, 0, 0, 0, //size
//             BSONType.BINARY, //type long
//             112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string
//
//             9, 0, 0, 0, //binary size, int32
//             BSON_BINARY_SUBTYPE_BIGINT, //binary type
//
//             255, //signum, 255 = -1
//             128, 0, 0, 0, 0, 0, 0, 2, //binary data
//
//             0, //object null
//         ]));
//     }
// });

// test('basic long bigint', () => {
//     const bla: { n: number, m: string }[] = [
//         { n: 1, m: '1' },
//         { n: 1 << 16, m: 'max uint 16' },
//         { n: (1 << 16) + 100, m: 'max uint 16 + 100' },
//         { n: 4294967296, m: 'max uint 32' },
//         { n: 4294967296 - 100, m: 'max uint 32 - 100' },
//         { n: 4294967296 - 1, m: 'max uint 32 - 1' },
//         { n: 4294967296 + 100, m: 'max uint 32 + 100' },
//         { n: 4294967296 + 1, m: 'max uint 32 + 1' },
//         { n: 4294967296 * 10 + 1, m: 'max uint 32 * 10 + 1' },
//         // {n: 9223372036854775807, m: 'max uint64'},
//         // {n: 9223372036854775807 + 1, m: 'max uint64 - 1'},
//         // {n: 9223372036854775807 - 1, m: 'max uint64 + 2'},
//     ];
//     for (const b of bla) {
//         const long = Long.fromNumber(b.n);
//         console.log(b.n, long.toNumber(), long, b.m);
//     }
// });

test('basic number double', () => {
    const object = { position: 149943944399 };

    const expectedSize =
            4 //size uint32
            + 1 // type (number)
            + 'position\0'.length
            + (
                8 //double, 64bit
            )
            + 1 //object null
    ;

    const expectedSizeNull =
            4 //size uint32
            + 1 // type (number)
            + 'position\0'.length
            + (
                0 //undefined
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);
    expect(calculateObjectSize({ position: null })).toBe(expectedSizeNull);
    expect(calculateObjectSize({ position: undefined })).toBe(5);

    const schema = typeOf<{
        position?: number,
    }>();


    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));

    expect(getBSONSerializer(undefined, schema)({ position: undefined }).byteLength).toBe(expectedSizeNull);
    expect(getBSONSerializer(undefined, schema)({}).byteLength).toBe(5);
});

test('basic boolean', () => {
    const object = { valid: true };

    const expectedSize =
            4 //size uint32
            + 1 // type (boolean)
            + 'valid\0'.length
            + (
                1 //boolean
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        valid: boolean,
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

test('basic date', () => {
    const object = { created: new Date };

    const expectedSize =
            4 //size uint32
            + 1 // type (date)
            + 'created\0'.length
            + (
                8 //date
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        created: Date,
    }>();

    const serializer = getBSONSerializer(undefined, schema);

    // expect(serializer(object).byteLength).toBe(expectedSize);
    // expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    // expect(serializer(object)).toEqual(serialize(object));

    expect(serializer({ created: new Date('2900-10-12T00:00:00.000Z') })).toEqual(serialize({ created: new Date('2900-10-12T00:00:00.000Z') }));
    expect(serializer({ created: new Date('1900-10-12T00:00:00.000Z') })).toEqual(serialize({ created: new Date('1900-10-12T00:00:00.000Z') }));
    expect(serializer({ created: new Date('1000-10-12T00:00:00.000Z') })).toEqual(serialize({ created: new Date('1000-10-12T00:00:00.000Z') }));

    // const deserializer = getBSONDecoder(schema);
    // expect(deserializer(serializer({ created: new Date('2900-10-12T00:00:00.000Z') }))).toEqual({ created: new Date('2900-10-12T00:00:00.000Z') });
    // expect(deserializer(serializer({ created: new Date('1900-10-12T00:00:00.000Z') }))).toEqual({ created: new Date('1900-10-12T00:00:00.000Z') });
    // expect(deserializer(serializer({ created: new Date('1000-10-12T00:00:00.000Z') }))).toEqual({ created: new Date('1000-10-12T00:00:00.000Z') });
});

test('basic binary', () => {
    const object = { binary: new Uint16Array(32) };

    const expectedSize =
            4 //size uint32
            + 1 // type (date)
            + 'binary\0'.length
            + (
                4 //size of binary, uin32
                + 1 //sub type
                + 32 * 2 //size of data
            )
            + 1 //object null
    ;

    expect(new Uint16Array(32).byteLength).toBe(32 * 2);

    //this doesn't support typed arrays
    // expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        binary: Uint16Array,
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);

    //doesnt support typed arrays
    // expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));

    // expect(getBSONDecoder(schema)(getBSONSerializer(undefined, schema)(object))).toEqual(object);
});


test('basic arrayBuffer', () => {
    const arrayBuffer = new ArrayBuffer(5);
    const view = new Uint8Array(arrayBuffer);
    view[0] = 22;
    view[1] = 44;
    view[2] = 55;
    view[3] = 66;
    view[4] = 77;
    const object = { binary: arrayBuffer };

    const expectedSize =
            4 //size uint32
            + 1 // type (date)
            + 'binary\0'.length
            + (
                4 //size of binary, uin32
                + 1 //sub type
                + 5 //size of data
            )
            + 1 //object null
    ;

    // expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        binary: ArrayBuffer,
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    // expect(getBSONDecoder(schema)(getBSONSerializer(undefined, schema)(object))).toEqual(object);
    // expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

test('basic Buffer', () => {
    const object = { binary: new Uint8Array(32) };

    const expectedSize =
            4 //size uint32
            + 1 // type (date)
            + 'binary\0'.length
            + (
                4 //size of binary, uin32
                + 1 //sub type
                + 32 //size of data
            )
            + 1 //object null
    ;

    // expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        binary: Uint8Array,
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    // expect(getBSONDecoder(schema)(getBSONSerializer(undefined, schema)(object))).toEqual(object);

    Buffer.alloc(2);
    Buffer.alloc(200);
    Buffer.alloc(20000);

    // expect(getBSONDecoder(schema)(getBSONSerializer(undefined, schema)({
    //     binary: Buffer.alloc(44)
    // }))).toEqual({
    //     binary: new Uint8Array(44)
    // });
});

test('basic uuid', () => {
    const uuidRandomBinary = new Binary(
        Buffer.allocUnsafe(16),
        Binary.SUBTYPE_UUID
    );

    const object = { uuid: '75ed2328-89f2-4b89-9c49-1498891d616d' };

    const expectedSize =
            4 //size uint32
            + 1 // type (date)
            + 'uuid\0'.length
            + (
                4 //size of binary
                + 1 //sub type
                + 16 //content of uuid
            )
            + 1 //object null
    ;

    expect(calculateObjectSize({ uuid: uuidRandomBinary })).toBe(expectedSize);

    const schema = typeOf<{
        uuid: UUID,
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);

    const uuidPlain = Buffer.from([0x75, 0xed, 0x23, 0x28, 0x89, 0xf2, 0x4b, 0x89, 0x9c, 0x49, 0x14, 0x98, 0x89, 0x1d, 0x61, 0x6d]);
    const uuidBinary = new Binary(uuidPlain, 4);
    const objectBinary = {
        uuid: uuidBinary
    };

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(objectBinary));

    // const bson = serialize(objectBinary);
    // const parsed = parseObject(new ParserV2(bson));
    // expect(parsed.uuid).toBe('75ed2328-89f2-4b89-9c49-1498891d616d');
});

test('basic objectId', () => {
    const object = { _id: '507f191e810c19729de860ea' };

    const expectedSize =
            4 //size uint32
            + 1 // type
            + '_id\0'.length
            + (
                12 //size of objectId
            )
            + 1 //object null
    ;

    const nativeBson = { _id: new OfficialObjectId('507f191e810c19729de860ea') };
    expect(calculateObjectSize(nativeBson)).toBe(expectedSize);

    const schema = typeOf<{
        _id: MongoId,
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(nativeBson));
});

test('basic nested', () => {
    const object = { name: { anotherOne: 'Peter2' } };

    const expectedSize =
            4 //size uint32
            + 1 //type (object)
            + 'name\0'.length
            + (
                4 //size uint32
                + 1 //type (object)
                + 'anotherOne\0'.length
                + (
                    4 //string size uint32
                    + 'Peter2'.length + 1 //string content + null
                )
                + 1 //object null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        name: {
            anotherOne: string
        },
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

test('basic map', () => {
    const object = { name: new Map([['abc', 'Peter']]) };

    const expectedSize =
            4 //size uint32
            + 1 //type (array)
            + 'name\0'.length
            + (
                4 //size uint32 of array
                + 1 //type (array)
                + '0\0'.length //key
                + (
                    4 //size uint32 of array
                    + 1 //type (string)
                    + '0\0'.length //key
                    + (
                        4 //string size uint32
                        + 'abc'.length + 1 //string content + null
                    )
                    + 1 //type (string)
                    + '1\0'.length //key
                    + (
                        4 //string size uint32
                        + 'Peter'.length + 1 //string content + null
                    )
                    + 1 //object null
                )
                + 1 //object null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize({ name: [['abc', 'Peter']] })).toBe(expectedSize);

    const schema = typeOf<{
        name: Map<string, string>
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize({ name: [['abc', 'Peter']] }));
});

test('basic set', () => {
    const object = { name: new Set(['abc', 'Peter']) };

    const expectedSize =
            4 //size uint32
            + 1 //type (array)
            + 'name\0'.length
            + (
                4 //size uint32 of array
                + 1 //type (string)
                + '0\0'.length //key
                + (
                    4 //string size uint32
                    + 'abc'.length + 1 //string content + null
                )
                + 1 //type (string)
                + '1\0'.length //key
                + (
                    4 //string size uint32
                    + 'Peter'.length + 1 //string content + null
                )
                + 1 //object null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize({ name: ['abc', 'Peter'] })).toBe(expectedSize);

    const schema = typeOf<{
        name: Set<string>
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize({ name: ['abc', 'Peter'] }));
});

test('basic array', () => {
    const object = { name: ['Peter3'] };

    const expectedSize =
            4 //size uint32
            + 1 //type (array)
            + 'name\0'.length
            + (
                4 //size uint32 of array
                + 1 //type (string)
                + '0\0'.length //key
                + (
                    4 //string size uint32
                    + 'Peter3'.length + 1 //string content + null
                )
                + 1 //object null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = typeOf<{
        name: string[]
    }>();

    expect(getBSONSerializer(undefined, schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

// test('number', () => {
//     const object = { name: 'Peter4', tags: ['a', 'b', 'c'], priority: 15, position: 149943944399, valid: true, created: new Date() };
//
//     const schema = t.schema({
//         name: t.string,
//         tags: t.array(t.string),
//         priority: t.number,
//         position: t.number,
//         valid: t.boolean,
//         created: t.date,
//     });
//
//     expect(getBSONSizer(undefined, schema)(object)).toBe(calculateObjectSize(object));
//     expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
// });
//
test('all supported base types', () => {
    const object = { name: 'Peter4', tags: ['a', 'b', 'c'], priority: 15, position: 149943944399, valid: true, created: new Date() };

    const schema = typeOf<{
        name: string,
        tags: string[],
        priority: number,
        position: number,
        valid: boolean,
        created: Date
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(calculateObjectSize(object));
    expect(getBSONSerializer(undefined, schema)(object)).toEqual(serialize(object));
});

// test('string utf8', () => {
//     const schema = typeOf<{
//         name: string,
//         any: any
//     }>();
//
//     const serialize = getBSONSerializer(undefined, schema);
//     const parse = getBSONDecoder(schema);
//
//     expect(parse(serialize({ name: 'Peter' }))).toEqual({ name: 'Peter' });
//     expect(parse(serialize({ name: 'Peter✌️' }))).toEqual({ name: 'Peter✌️' });
//     expect(parse(serialize({ name: '✌️' }))).toEqual({ name: '✌️' });
//     expect(parse(serialize({ name: '🌉' }))).toEqual({ name: '🌉' });
//     expect(parse(serialize({ name: 'πøˆ️' }))).toEqual({ name: 'πøˆ️' });
//     expect(parse(serialize({ name: 'Ѓ' }))).toEqual({ name: 'Ѓ' });
//     expect(parse(serialize({ name: '㒨' }))).toEqual({ name: '㒨' });
//     expect(parse(serialize({ name: '﨣' }))).toEqual({ name: '﨣' });
//
//     expect(parse(serialize({ any: { base: true } }))).toEqual({ any: { base: true } });
//     expect(parse(serialize({ any: { '✌️': true } }))).toEqual({ any: { '✌️': true } });
//     expect(parse(serialize({ any: { 'Ѓ': true } }))).toEqual({ any: { 'Ѓ': true } });
//     expect(parse(serialize({ any: { 㒨: true } }))).toEqual({ any: { 㒨: true } });
//     expect(parse(serialize({ any: { 﨣: true } }))).toEqual({ any: { 﨣: true } });
// });

test('optional field', () => {
    const schema = typeOf<{
        find: string,
        batchSize: number,
        limit?: number,
        skip?: number,
    }>();

    const findSerializer = getBSONSerializer(undefined, schema);
    const bson = findSerializer({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    const bsonOfficial = serialize({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    expect(bson).toEqual(bsonOfficial);
});

test('complex', () => {
    const schema = typeOf<{
        find: string,
        batchSize: number,
        limit?: number,
        filter: any,
        projection: any,
        sort: any,
        skip?: number,
    }>();

    const findSerializer = getBSONSerializer(undefined, schema);

    const bson = findSerializer({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });
    const bsonOfficial = serialize({
        find: 'user',
        batchSize: 1,
        limit: 1,
    });

    expect(bson).toEqual(bsonOfficial);
});

test('embedded', () => {
    class DecoratedValue {
        constructor(public items: string[] = []) {
        }
    }

    const object = { v: new DecoratedValue(['Peter3']) };

    const expectedSize =
            4 //size uint32
            + 1 //type (array)
            + 'v\0'.length
            + (
                4 //size uint32 of array
                + 1 //type (string)
                + '0\0'.length //key
                + (
                    4 //string size uint32
                    + 'Peter3'.length + 1 //string content + null
                )
                + 1 //object null
            )
            + 1 //object null
    ;

    expect(calculateObjectSize({ v: ['Peter3'] })).toBe(expectedSize);

    const schema = typeOf<{
        v: Embedded<DecoratedValue>
    }>();

    const bson = getBSONSerializer(undefined, schema)(object);

    const officialDeserialize = deserialize(Buffer.from(bson));
    expect(officialDeserialize.v).toEqual(['Peter3']);

    expect(bson.byteLength).toBe(expectedSize);
    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);

    expect(bson).toEqual(serialize({ v: ['Peter3'] }));

    // const back = getBSONDecoder(schema)(bson);
    // expect(back.v).toBeInstanceOf(DecoratedValue);
    // expect(back.v.items).toEqual(['Peter3']);
    // expect(back).toEqual(object);
});

test('reference', () => {
    class Entity {
        public id: number & PrimaryKey = 0;

        constructor(public title: string) {
        }
    }

    const object = { v: createReference(Entity, { id: 5 }) };

    const expectedSize =
            4 //size uint32
            + 1 //type (number)
            + 'v\0'.length
            + (
                4 //int uint32
            )
            + 1 //object null
    ;

    expect(calculateObjectSize({ v: 5 })).toBe(expectedSize);

    const schema = typeOf<{
        v: Entity & Reference
    }>();

    expect(getBSONSizer(undefined, schema)(object)).toBe(expectedSize);
    const bson = getBSONSerializer(undefined, schema)(object);

    const officialDeserialize = deserialize(Buffer.from(bson));
    expect(officialDeserialize.v).toEqual(5);

    expect(bson.byteLength).toBe(expectedSize);

    expect(bson).toEqual(serialize({ v: 5 }));

    // const back = getBSONDecoder(schema)(bson);
    // expect(back.v).toBeInstanceOf(DecoratedValue);
    // expect(back.v.items).toEqual(['Peter3']);
    // expect(back).toEqual(object);
});

test('bson length', () => {
    const nonce = randomBytes(24);

    const SaslStartCommand = typeOf<{
        saslStart: 1,
        $db: string,
        mechanism: string,
        payload: Uint8Array,
        autoAuthorize: 1,
        options: {
            skipEmptyExchange: true
        }
    }>();

    const message = {
        saslStart: 1,
        $db: 'admin',
        mechanism: 'SCRAM-SHA-1',
        payload: Buffer.concat([Buffer.from('n,,', 'utf8'), Buffer.from(`n=Peter,r=${nonce.toString('base64')}`, 'utf8')]),
        autoAuthorize: 1,
        options: { skipEmptyExchange: true }
    };

    expect(message.payload.byteLength).toBe(13 + nonce.toString('base64').length);

    const size = getBSONSizer(undefined, SaslStartCommand)(message);
    expect(size).toBe(calculateObjectSize(message));

    const bson = getBSONSerializer(undefined, SaslStartCommand)(message);

    expect(bson).toEqual(serialize(message));
});

test('arrayBuffer', () => {
    const schema = typeOf<{
        name: string,
        secondId: MongoId,
        preview: ArrayBuffer,
    }>();

    const message = {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: nodeBufferToArrayBuffer(Buffer.from('Baar', 'utf8'))
    };

    expect(Buffer.from(message.preview).toString('utf8')).toBe('Baar');

    const mongoMessage = {
        name: message.name,
        secondId: new OfficialObjectId(message.secondId),
        preview: new Binary(Buffer.from(message.preview)),
    };
    const size = getBSONSizer(undefined, schema)(message);
    expect(size).toBe(calculateObjectSize(mongoMessage));

    const bson = getBSONSerializer(undefined, schema)(message);

    expect(bson).toEqual(serialize(mongoMessage));

    // const back = getBSONDecoder(schema)(bson);
    // expect(Buffer.from(back.preview).toString('utf8')).toBe('Baar');
    // expect(back.preview).toEqual(message.preview);
});

test('typed array', () => {
    const schema = typeOf<{
        name: string,
        secondId: MongoId,
        preview: Uint16Array,
    }>();

    const message = {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: new Uint16Array(nodeBufferToArrayBuffer(Buffer.from('LAA3AEIATQBYAA==', 'base64'))), //44, 55, 66, 77, 88
    };

    expect(message.preview).toBeInstanceOf(Uint16Array);
    expect(message.preview.byteLength).toBe(10);

    const mongoMessage = {
        name: message.name,
        secondId: new OfficialObjectId(message.secondId),
        preview: new Binary(Buffer.from(new Uint8Array(message.preview.buffer, message.preview.byteOffset, message.preview.byteLength))),
    };
    const size = getBSONSizer(undefined, schema)(message);
    expect(size).toBe(calculateObjectSize(mongoMessage));

    const bson = getBSONSerializer(undefined, schema)(message);

    expect(bson).toEqual(serialize(mongoMessage));

    // const back = getBSONDecoder(schema)(bson);
    // expect(back.preview).toEqual(message.preview);
});

test('union string | number', () => {
    const schema = typeOf<{
        v: string | number,
    }>();

    expect(getBSONSizer(undefined, schema)({ v: 'abc' })).toBe(calculateObjectSize({ v: 'abc' }));
    expect(getBSONSizer(undefined, schema)({ v: 2 })).toBe(calculateObjectSize({ v: 3 }));

    expect(getBSONSerializer(undefined, schema)({ v: 'abc' })).toEqual(serialize({ v: 'abc' }));
    expect(getBSONSerializer(undefined, schema)({ v: 2 })).toEqual(serialize({ v: 2 }));
});

test('union number | class', () => {
    class MyClass {
        id: number = 0;
    }

    const schema = typeOf<{
        v: number | MyClass,
    }>();

    expect(getBSONSizer(undefined, schema)({ v: { id: 5 } })).toBe(calculateObjectSize({ v: { id: 5 } }));
    expect(getBSONSizer(undefined, schema)({ v: 2 })).toBe(calculateObjectSize({ v: 3 }));

    expect(getBSONSerializer(undefined, schema)({ v: { id: 5 } })).toEqual(serialize({ v: { id: 5 } }));
    expect(getBSONSerializer(undefined, schema)({ v: 2 })).toEqual(serialize({ v: 2 }));
});

test('index signature', () => {
    const schema = typeOf<{
        [name: string]: number
    }>();

    expect(getBSONSizer(undefined, schema)({ a: 5 })).toBe(calculateObjectSize({ a: 5 }));
    expect(getBSONSizer(undefined, schema)({ a: 5, b: 6 })).toBe(calculateObjectSize({ a: 5, b: 6 }));

    expect(getBSONSerializer(undefined, schema)({ a: 5 })).toEqual(serialize({ a: 5 }));
    expect(getBSONSerializer(undefined, schema)({ a: 5, b: 6 })).toEqual(serialize({ a: 5, b: 6 }));
});

test('index signature + properties', () => {
    const schema = typeOf<{
        id: number;
        [name: string]: number | string
    }>();

    expect(getBSONSizer(undefined, schema)({ id: 1, a: 5 })).toBe(calculateObjectSize({ id: 1, a: 5 }));
    expect(getBSONSizer(undefined, schema)({ id: 1, a: 5, b: 6 })).toBe(calculateObjectSize({ id: 1, a: 5, b: 6 }));

    expect(getBSONSerializer(undefined, schema)({ id: 1, a: 5 })).toEqual(serialize({ id: 1, a: 5 }));
    expect(getBSONSerializer(undefined, schema)({ id: 1, a: 5, b: 6 })).toEqual(serialize({ id: 1, a: 5, b: 6 }));
});

test('exclude', () => {
    const schema = typeOf<{
        id: number;
        password: string & Excluded
    }>();

    expect(getBSONSizer(undefined, schema)({ id: 1, password: 'asdasd' })).toBe(calculateObjectSize({ id: 1 }));
    expect(getBSONSerializer(undefined, schema)({ id: 1, password: 'asdasd' })).toEqual(serialize({ id: 1 }));
});

test('promise', () => {
    const schema = typeOf<{
        id: Promise<number>;
    }>();

    expect(getBSONSizer(undefined, schema)({ id: 1 })).toBe(calculateObjectSize({ id: 1 }));
    expect(getBSONSerializer(undefined, schema)({ id: 1 })).toEqual(serialize({ id: 1 }));
});

test('regepx', () => {
    const schema = typeOf<{
        id: RegExp
    }>();

    expect(getBSONSizer(undefined, schema)({ id: /asd/g })).toBe(calculateObjectSize({ id: /asd/g }));
    expect(getBSONSerializer(undefined, schema)({ id: /asd/g })).toEqual(serialize({ id: /asd/g }));
});

test('typed any and undefined', () => {
    const schema = typeOf<{
        data: any,
    }>();

    const message = {
        data: {
            $set: {},
            $inc: undefined,
        },
    };

    // expect(getValueSize({ $inc: undefined })).toBe(calculateObjectSize({ $inc: undefined })); //official BSON does not include undefined values, but we do
    expect(getValueSize({ $inc: [undefined] })).toBe(calculateObjectSize({ $inc: [undefined] }));

    // const size = getBSONSizer(undefined, schema)(message);
    // expect(size).toBe(calculateObjectSize(message)); //official bson doesnt include undefined

    //todo: not sure what the expectation here was
    const bson = getBSONSerializer(undefined, schema)(message);
    // expect(bson).toEqual(serialize(message)); //official bson doesnt include undefined

    // const back = getBSONDecoder(schema)(bson);
    // expect(back.data.$set).toEqual({});
    // expect(back.data.$inc).toEqual(undefined);
    // expect('$inc' in back.data).toEqual(true);
});

test('Excluded', () => {
    class Model {
        id: UUID & PrimaryKey = uuid();

        excludedForMongo: string & Excluded<'bson'> = 'excludedForMongo';

        constructor(public name: string) {
        }
    }

    const model = new Model('asd');

    interface Message {
        insert: string;
        $db: string;
        documents: Model[];
    }

    const fn = getBSONSerializer<Message>();
    const bson = fn({ insert: 'a', $db: 'b', documents: [model] });

    const back = deserializeBSONWithoutOptimiser(bson);
    console.log('back', back);
});
