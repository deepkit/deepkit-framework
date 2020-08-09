import 'jest-extended';
import 'reflect-metadata';
import {getBSONSerializer, createBSONSizer, hexToByte, uuidStringToByte} from '../src/bson-serialize';
import {t} from '@super-hornet/marshal';
import * as Moment from 'moment';
import {calculateObjectSize, serialize, Binary, ObjectId} from 'bson';

test('hexToByte', () => {
    expect(hexToByte('00')).toBe(0);
    expect(hexToByte('01')).toBe(1);
    expect(hexToByte('0f')).toBe(15);
    expect(hexToByte('10')).toBe(16);
    expect(hexToByte('ff')).toBe(255);
    expect(hexToByte('f0')).toBe(240);
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

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
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

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = t.schema({
        position: t.number,
    });

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
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

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(bsonObject));
});

test('basic binary', () => {
    const object = {binary: Buffer.alloc(32)};

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

    expect(calculateObjectSize(object)).toBe(expectedSize);

    const schema = t.schema({
        binary: t.type(ArrayBuffer),
    });

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
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

    expect(createBSONSizer(schema)(object)).toBe(expectedSize);
    expect(getBSONSerializer(schema)(object)).toEqual(serialize(object));
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