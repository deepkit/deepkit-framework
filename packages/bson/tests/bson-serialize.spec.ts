import 'jest-extended';
import 'reflect-metadata';
import {createBSONSizer, getBSONSerializer, getBSONSizer, getValueSize, hexToByte, uuidStringToByte} from '../src/bson-serialize';
import {f, jsonSerializer, t} from '@deepkit/type';
import * as Moment from 'moment';
import {Binary, calculateObjectSize, deserialize, Long, ObjectId, serialize} from 'bson';
import {getBSONDecoder} from '../src/bson-jit-parser';
import {randomBytes} from 'crypto';
import {parseObject, ParserV2} from '../src/bson-parser';

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
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 7)).toBe(16 * 2 + 15)
    ;
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 8)).toBe(16 * 11 + 7);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 10)).toBe(16 * 12 + 3);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 11)).toBe(16 * 10 + 1);
    expect(uuidStringToByte('bef8de96-41fe-442f-b70c-c3a150f8c96c', 15)).toBe(16 * 6 + 12);
});

test('basic string', () => {
    const object = {name: 'Peter'};

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

    const schema = t.schema({
        name: t.string,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic number int', () => {
    const object = {position: 24};

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

    const schema = t.schema({
        position: t.number,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic long', () => {
    const object = {position: 3364367088039355000n};

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

    const schema = t.schema({
        position: t.number,
    });

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);

    const numbers: BigInt[] = [0n, 1n, 65536n, 4294967296n];
    for (const number of numbers) {
        const bson = getBSONSerializer(schema)({
            position: number
        });

        const long = Long.fromNumber(Number(number));
        const lowBytes = Buffer.alloc(4);
        lowBytes.writeUInt32LE(long.getLowBits(), 0);

        const heightBytes = Buffer.alloc(4);
        heightBytes.writeUInt32LE(long.getHighBits(), 0);

        console.log('expect', number);
        expect(bson).toEqual(Buffer.from([
            23, 0, 0, 0, //size
            18, //type long
            112, 111, 115, 105, 116, 105, 111, 110, 0, //position\n string

            lowBytes[0], lowBytes[1], lowBytes[2], lowBytes[3], //low byte
            heightBytes[0], heightBytes[1], heightBytes[2], heightBytes[3], //low byte

            0, //object null
        ]));
    }

    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };

    const reParsed = getBSONDecoder(schema)(getBSONSerializer(schema)(object));
    expect(reParsed.position).toBe(3364367088039355000n);

    //there's a bug in BSON.js, https://github.com/mongodb/js-bson/issues/384 so we can't compare
    // expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic long bigint', () => {
    const bla: { n: number, m: string }[] = [
        {n: 1, m: '1'},
        {n: 1 << 16, m: 'max uint 16'},
        {n: (1 << 16) + 100, m: 'max uint 16 + 100'},
        {n: 4294967296, m: 'max uint 32'},
        {n: 4294967296 - 100, m: 'max uint 32 - 100'},
        {n: 4294967296 - 1, m: 'max uint 32 - 1'},
        {n: 4294967296 + 100, m: 'max uint 32 + 100'},
        {n: 4294967296 + 1, m: 'max uint 32 + 1'},
        {n: 4294967296 * 10 + 1, m: 'max uint 32 * 10 + 1'},
        // {n: 9223372036854775807, m: 'max uint64'},
        // {n: 9223372036854775807 + 1, m: 'max uint64 - 1'},
        // {n: 9223372036854775807 - 1, m: 'max uint64 + 2'},
    ];
    for (const b of bla) {
        const long = Long.fromNumber(b.n);
        console.log(b.n, long.toNumber(), long, b.m);
    }
});

test('basic number double', () => {
    const object = {position: 149943944399};

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
    expect(calculateObjectSize({position: null})).toBe(expectedSizeNull);
    expect(calculateObjectSize({position: undefined})).toBe(5);

    const schema = t.schema({
        position: t.number,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));

    expect(getBSONSerializer(schema)({position: null}).byteLength).toBe(expectedSizeNull);
    expect(getBSONSerializer(schema)({position: undefined}).byteLength).toBe(5);

    expect(getBSONSerializer(schema)({position: null}).byteLength).toEqual(expectedSizeNull);
    expect(getBSONSerializer(schema)({position: undefined}).byteLength).toEqual(5);

    expect(getBSONSerializer(schema)({position: null})).toEqual(serialize({position: null}));
    expect(getBSONSerializer(schema)({position: undefined})).toEqual(serialize({}));
    expect(getBSONSerializer(schema)({position: undefined})).toEqual(serialize({position: undefined}));
});

test('basic boolean', () => {
    const object = {valid: true};

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

    const schema = t.schema({
        valid: t.boolean,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic date', () => {
    const object = {created: new Date};

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

    const schema = t.schema({
        created: t.date,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic moment', () => {
    const object = {created: Moment()};

    const expectedSize =
        4 //size uint32
        + 1 // type (date)
        + 'created\0'.length
        + (
            8 //date
        )
        + 1 //object null
    ;

    const bsonObject = {created: object.created.toDate()};
    expect(calculateObjectSize(bsonObject)).toBe(expectedSize);

    const schema = t.schema({
        created: t.moment,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(bsonObject));
});

test('basic binary', () => {
    const object = {binary: new Uint16Array(32)};

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

    const schema = t.schema({
        binary: t.type(Uint16Array),
    });

    expect(schema.getProperty('binary').type).toBe('Uint16Array');

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);

    //doesnt support typed arrays
    // expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));

    expect(getBSONDecoder(schema)(getBSONSerializer(schema)(object))).toEqual(object);
});


test('basic arrayBuffer', () => {
    const arrayBuffer = new ArrayBuffer(5)
    const view = new Uint8Array(arrayBuffer);
    view[0] = 22;
    view[1] = 44;
    view[2] = 55;
    view[3] = 66;
    view[4] = 77;
    const object = {binary: arrayBuffer};

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

    const schema = t.schema({
        binary: t.type(ArrayBuffer),
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONDecoder(schema)(getBSONSerializer(schema)(object))).toEqual(object);
    // expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic Buffer', () => {
    const object = {binary: new Uint8Array(32)};

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

    const schema = t.schema({
        binary: t.type(Uint8Array),
    });

    expect(schema.getProperty('binary').type).toBe('Uint8Array');

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONDecoder(schema)(getBSONSerializer(schema)(object))).toEqual(object);

    Buffer.alloc(2);
    Buffer.alloc(200);
    Buffer.alloc(20000);

    expect(getBSONDecoder(schema)(getBSONSerializer(schema)({
        binary: Buffer.alloc(44)
    }))).toEqual({
        binary: new Uint8Array(44)
    });
});

test('basic uuid', () => {
    const uuid = new Binary(
        Buffer.allocUnsafe(16),
        Binary.SUBTYPE_UUID
    );

    const object = {uuid: uuid};

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

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = t.schema({
        uuid: t.uuid,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(getBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));

    const uuidPlain = Buffer.from([0x75, 0xed, 0x23, 0x28, 0x89, 0xf2, 0x4b, 0x89, 0x9c, 0x49, 0x14, 0x98, 0x89, 0x1d, 0x61, 0x6d]);
    const uuidBinary = new Binary(uuidPlain, 4);
    const objectBinary = {
        uuid: uuidBinary
    };

    expect(getBSONSerializer(schema)(objectBinary).byteLength).toBe(expectedSize);
    expect(getBSONSerializer(schema)(objectBinary)).toEqual(serialize(objectBinary));

    const bson = serialize(objectBinary);
    const parsed = parseObject(new ParserV2(bson));
    expect(parsed.uuid).toBe('75ed2328-89f2-4b89-9c49-1498891d616d');
});

test('basic objectId', () => {
    const object = {_id: new ObjectId};

    const expectedSize =
        4 //size uint32
        + 1 // type (date)
        + '_id\0'.length
        + (
            12 //size of objectId
        )
        + 1 //object null
    ;

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = t.schema({
        _id: t.mongoId,
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic nested', () => {
    const object = {name: {anotherOne: 'Peter2'}};

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

    const schema = t.schema({
        name: {
            anotherOne: t.string,
        },
    });

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic map', () => {
    const object = {name: {anotherOne: 'Peter2'}};

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

    const schema = t.schema({
        name: t.map(t.string)
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('basic array', () => {
    const object = {name: ['Peter3']};

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

    const schema = t.schema({
        name: t.array(t.string),
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('number', () => {
    const object = {name: 'Peter4', tags: ['a', 'b', 'c'], priority: 15, position: 149943944399, valid: true, created: new Date()};

    const schema = t.schema({
        name: t.string,
        tags: t.array(t.string),
        priority: t.number,
        position: t.number,
        valid: t.boolean,
        created: t.date,
    });

    expect(createBSONSizer(schema)(object)).toBe(calculateObjectSize(object));
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('all supported types', () => {
    const object = {name: 'Peter4', tags: ['a', 'b', 'c'], priority: 15, position: 149943944399, valid: true, created: new Date()};

    const schema = t.schema({
        name: t.string,
        tags: t.array(t.string),
        priority: t.number,
        position: t.number,
        valid: t.boolean,
        created: t.date,
    });

    expect(createBSONSizer(schema)(object)).toBe(calculateObjectSize(object));
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
});

test('string utf8', () => {
    const schema = t.schema({
        name: t.string,
        any: t.any,
    });

    const serialize = getBSONSerializer(schema);
    const parse = getBSONDecoder(schema);

    expect(parse(serialize({name: 'Peter'}))).toEqual({name: 'Peter'});
    expect(parse(serialize({name: 'Peter✌️'}))).toEqual({name: 'Peter✌️'});
    expect(parse(serialize({name: '✌️'}))).toEqual({name: '✌️'});
    expect(parse(serialize({name: '🌉'}))).toEqual({name: '🌉'});
    expect(parse(serialize({name: 'πøˆ️'}))).toEqual({name: 'πøˆ️'});
    expect(parse(serialize({name: 'Ѓ'}))).toEqual({name: 'Ѓ'});
    expect(parse(serialize({name: '㒨'}))).toEqual({name: '㒨'});
    expect(parse(serialize({name: '﨣'}))).toEqual({name: '﨣'});

    expect(parse(serialize({any: {base: true}}))).toEqual({any: {base: true}});
    expect(parse(serialize({any: {'✌️': true}}))).toEqual({any: {'✌️': true}});
    expect(parse(serialize({any: {'Ѓ': true}}))).toEqual({any: {'Ѓ': true}});
    expect(parse(serialize({any: {㒨: true}}))).toEqual({any: {㒨: true}});
    expect(parse(serialize({any: {﨣: true}}))).toEqual({any: {﨣: true}});
});

test('optional field', () => {
    const findSchema = t.schema({
        find: t.string,
        batchSize: t.number,
        limit: t.number.optional,
        skip: t.number.optional,
    });

    const findSerializer = getBSONSerializer(findSchema);
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
    const findSchema = t.schema({
        find: t.string,
        batchSize: t.number,
        limit: t.number.optional,
        filter: t.any,
        projection: t.any,
        sort: t.any,
        skip: t.number.optional,
    });

    const findSerializer = getBSONSerializer(findSchema);

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

test('any objectId', () => {
    const schema = t.schema({
        _id: t.any,
        q: t.any,
    });

    {
        const doc = {_id: new ObjectId('507f191e810c19729de860ea')};
        const bson = getBSONSerializer(schema)(doc);
        const bsonOfficial = serialize(doc);

        expect(bson).toEqual(bsonOfficial);
        const parsed = deserialize(bson);
        expect(parsed._id).toBeInstanceOf(ObjectId);
        expect(parsed._id.toHexString()).toBe('507f191e810c19729de860ea');

        const parsed2 = getBSONDecoder(schema)(bson);
        expect(parsed2._id).toBe('507f191e810c19729de860ea');
    }

    {
        const doc = {q: {id: new ObjectId('507f191e810c19729de860ea')}};
        const bson = getBSONSerializer(schema)(doc);
        const bsonOfficial = serialize(doc);

        expect(bson).toEqual(bsonOfficial);
        const parsed = deserialize(bson);
        expect(parsed.q.id).toBeInstanceOf(ObjectId);
        expect(parsed.q.id.toHexString()).toBe('507f191e810c19729de860ea');

        const parsed2 = getBSONDecoder(schema)(bson);
        expect(parsed2.q.id).toBe('507f191e810c19729de860ea');
    }
});

test('objectId string', () => {
    const schema = t.schema({
        id: t.mongoId,
    });

    {
        const doc = {id: new ObjectId('507f191e810c19729de860ea')};
        const bson = getBSONSerializer(schema)(doc);

        const bsonOfficial = serialize({id: new ObjectId('507f191e810c19729de860ea')});
        expect(bson).toEqual(bsonOfficial);

        const parsed = deserialize(bson);
        expect(parsed.id).toBeInstanceOf(ObjectId);
        expect(parsed.id.toHexString()).toBe('507f191e810c19729de860ea');

        const parsed2 = getBSONDecoder(schema)(bson);
        expect(parsed2.id).toBe('507f191e810c19729de860ea');
    }

    {
        const doc = {id: '507f191e810c19729de860ea'};
        const bson = getBSONSerializer(schema)(doc);

        const bsonOfficial = serialize({id: new ObjectId('507f191e810c19729de860ea')});
        expect(bson).toEqual(bsonOfficial);

        const parsed = deserialize(bson);
        expect(parsed.id).toBeInstanceOf(ObjectId);
        expect(parsed.id.toHexString()).toBe('507f191e810c19729de860ea');

        const parsed2 = getBSONDecoder(schema)(bson);
        expect(parsed2.id).toBe('507f191e810c19729de860ea');
    }
});


test('model 1, missing `public`', () => {
    class User {
        @f ready?: boolean;

        @f.array(f.string) tags: string[] = [];

        @f priority: number = 0;

        constructor(
            @f.primary id: number,
            @f public name: string
        ) {
        }
    }

    {
        const user = new User(1, 'Peter ' + 1);
        user.ready = true;
        user.priority = 5;
        user.tags = ['a', 'b', 'c'];

        const bson = getBSONSerializer(User)(user);
        const size = getBSONSizer(User)(user);
        expect(size).toBe(calculateObjectSize(user));

        console.log('deserialize', deserialize(bson));
        expect(getBSONDecoder(User)(bson)).toEqual(deserialize(bson));
    }

    {
        const user = {
            ready: true,
            priority: 5,
            tags: ['a', 'b', 'c'],
            id: null,
            name: 'Peter 1',
        };
        const bson = getBSONSerializer(User)(user);
        expect(getBSONDecoder(User)(bson)).toEqual(deserialize(bson));
    }
});

test('decorated', () => {
    class DecoratedValue {
        @t.array(t.string).decorated
        items: string[] = [];
    }

    const object = {v: ['Peter3']};

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

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = t.schema({
        v: t.type(DecoratedValue),
    });

    expect(getBSONSerializer(schema)(object).byteLength).toBe(expectedSize);
    expect(createBSONSizer(schema)(object)).toBe(expectedSize);

    const bson = getBSONSerializer(schema)(object);
    expect(bson).toEqual(serialize(object));

    expect(getBSONDecoder(schema)(bson)).toEqual(object);

});

test('reference', () => {
    class User {
        @t.primary id: number = 1;

        @t.array(User).backReference()
        managedUsers: User[] = [];

        @t name!: string;

        //self reference
        @t.optional.reference()
        manager?: User;
    }

    {
        const object = new User();
        object.name = 'Peter';
        (object as any).manager = null;

        const bson = getBSONSerializer(User)(object);
        expect(getBSONDecoder(User)(bson)).toEqual(deserialize(bson));
        expect(bson).toEqual(serialize(object));
    }

    const updateSchema = t.schema({
        update: t.string,
        $db: t.string,
        updates: t.array({
            q: t.any,
            u: t.any,
            multi: t.boolean,
        })
    });

    {
        const object = {
            update: 'Nix',
            $db: 'admin',
            updates: [{
                q: {id: 213},
                u: {
                    manager: null
                }
            }]
        };

        expect(getBSONSizer(updateSchema)(object)).toBe(calculateObjectSize(object));
        const bson = getBSONSerializer(updateSchema)(object);
        expect(getBSONDecoder(updateSchema)(bson)).toEqual(deserialize(bson));
    }
});

test('bson length', () => {
    const nonce = randomBytes(24);

    class SaslStartCommand extends t.class({
        saslStart: t.literal(1),
        $db: t.string,
        mechanism: t.string,
        payload: t.type(Uint8Array),
        autoAuthorize: t.literal(1),
        options: {
            skipEmptyExchange: t.literal(true)
        }
    }) {
    }

    const message = {
        saslStart: 1,
        '$db': 'admin',
        mechanism: 'SCRAM-SHA-1',
        payload: Buffer.concat([Buffer.from('n,,', 'utf8'), Buffer.from(`n=Peter,r=${nonce.toString('base64')}`, 'utf8')]),
        autoAuthorize: 1,
        options: {skipEmptyExchange: true}
    };

    expect(message.payload.byteLength).toBe(13 + nonce.toString('base64').length);

    const size = getBSONSizer(SaslStartCommand)(message);
    expect(size).toBe(calculateObjectSize(message));

    const bson = getBSONSerializer(SaslStartCommand)(message);

    expect(bson).toEqual(serialize(message));

});

test('arrayBuffer', () => {
    const schema = t.schema({
        name: t.string,
        secondId: t.mongoId,
        preview: t.type(ArrayBuffer),
    })

    const message = jsonSerializer.for(schema).deserialize({
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: 'QmFhcg==', //Baar
    });

    expect(Buffer.from(message.preview).toString('utf8')).toBe('Baar');

    const mongoMessage = {
        name: message.name,
        secondId: new ObjectId(message.secondId),
        preview: new Binary(Buffer.from(message.preview)),
    }
    const size = getBSONSizer(schema)(message);
    expect(size).toBe(calculateObjectSize(mongoMessage));

    const bson = getBSONSerializer(schema)(message);

    expect(bson).toEqual(serialize(mongoMessage));

    const back = getBSONDecoder(schema)(bson);
    expect(Buffer.from(back.preview).toString('utf8')).toBe('Baar');
    expect(back.preview).toEqual(message.preview);
});

test('typed array', () => {
    const schema = t.schema({
        name: t.string,
        secondId: t.mongoId,
        preview: t.type(Uint16Array),
    })

    const message = jsonSerializer.for(schema).deserialize({
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: 'LAA3AEIATQBYAA==', //44, 55, 66, 77, 88
    });

    expect(message.preview).toBeInstanceOf(Uint16Array);
    expect(message.preview.byteLength).toBe(10);

    const mongoMessage = {
        name: message.name,
        secondId: new ObjectId(message.secondId),
        preview: new Binary(Buffer.from(new Uint8Array(message.preview.buffer, message.preview.byteOffset, message.preview.byteLength))),
    }
    const size = getBSONSizer(schema)(message);
    expect(size).toBe(calculateObjectSize(mongoMessage));

    const bson = getBSONSerializer(schema)(message);

    expect(bson).toEqual(serialize(mongoMessage));

    const back = getBSONDecoder(schema)(bson);
    expect(back.preview).toEqual(message.preview);
});

test('typed any and undefined', () => {
    const schema = t.schema({
        data: t.any,
    })

    const message = jsonSerializer.for(schema).deserialize({
        data: {
            $set: {},
            $inc: undefined,
        },
    });

    expect(getValueSize({$inc: undefined})).toBe(calculateObjectSize({$inc: undefined}));
    expect(getValueSize({$inc: [undefined]})).toBe(calculateObjectSize({$inc: [undefined]}));

    const size = getBSONSizer(schema)(message);
    expect(size).toBe(calculateObjectSize(message));

    const bson = getBSONSerializer(schema)(message);

    expect(bson).toEqual(serialize(message));

    const back = getBSONDecoder(schema)(bson);
    expect(back.data.$set).toEqual({});
    expect(back.data.$inc).toEqual(undefined);
});

test('test map map', () => {
    const schema = t.schema({
        data: t.map(t.map(t.string)),
    });

    const message = jsonSerializer.for(schema).deserialize({
        data: {foo: {bar: 'abc'}},
    });

    const size = getBSONSizer(schema)(message);
    expect(size).toBe(calculateObjectSize(message));

    const bson = getBSONSerializer(schema)(message);
    expect(bson).toEqual(serialize(message));

    expect(getBSONDecoder(schema)(bson)).toEqual(message);
});

test('test array array', () => {
    const schema = t.schema({
        data: t.array(t.array(t.string)),
    });

    const message = jsonSerializer.for(schema).deserialize({
        data: [['abc']],
    });

    const size = getBSONSizer(schema)(message);
    expect(size).toBe(calculateObjectSize(message));

    const bson = getBSONSerializer(schema)(message);

    expect(bson).toEqual(serialize(message));
    expect(getBSONDecoder(schema)(bson)).toEqual(message);
});
