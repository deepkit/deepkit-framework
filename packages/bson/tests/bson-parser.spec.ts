import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import bson from 'bson';
import { findValueInObject, parseObject, ParserV2 } from '../src/bson-parser';
import { getClassSchema, t } from '@deepkit/type';
import { getBSONDecoder } from '../src/bson-jit-parser';
import { BSONType } from '../src/utils';
import { getBSONSerializer } from '../src/bson-serialize';

const { deserialize, serialize } = bson;

test('basic', () => {
    const obj = {
        id: 123,
        name: 'Peter 1',
        tags: ['a', 'b', 'c'],
        priority: 0
    };

    const bson = serialize(obj);

    const items = parseObject(new ParserV2(bson));
    expect(items).toEqual(obj);

    expect(findValueInObject(new ParserV2(bson), (elementType, name) => {
        return name === 'id';
    })).toBe(123);

    expect(findValueInObject(new ParserV2(bson), (elementType, name) => {
        return elementType === BSONType.INT;
    })).toBe(123);

    expect(findValueInObject(new ParserV2(bson), (elementType, name) => {
        return elementType === BSONType.STRING;
    })).toBe('Peter 1');

    expect(findValueInObject(new ParserV2(bson), (elementType, name) => {
        return elementType === BSONType.STRING;
    })).toBe('Peter 1');
});

test('createBSONParser', () => {
    const obj = {
        number: 13,
        cursor: {
            firstBatch: [{ name: 'Peter' }, { name: 'Marc' }, { name: 'Bar' }],
            test: ['a', 'b', 'c']
        },
        ok: 1,
    };

    const schema = t.schema({
        number: t.number,
        cursor: t.type({
            firstBatch: t.array({
                name: t.string
            }),
            test: t.array(t.string),
        }),
        ok: t.number,
    });

    const bson = serialize(obj);

    const parsed = getBSONDecoder(schema)(bson);
    expect(parsed).toEqual(obj);
});


test('invalidation', () => {
    const schema = t.schema({
        username: t.string
    });

    {
        expect(getBSONDecoder(schema)(serialize({ username: 'Peter', foo: 'bar' }))).toEqual({ username: 'Peter' });
    }

    {
        schema.addProperty('foo', t.string);
        const obj = { username: 'Peter', foo: 'bar' };
        expect(getBSONDecoder(schema)(serialize(obj))).toEqual(obj);
    }
});


test('undefined array', () => {
    const schema = t.schema({
        username: t.string,
        organisations: t.array(t.string)
    });

    {
        const bson = serialize({ username: 'Peter' });
        //organisations stays undefined
        expect(getBSONDecoder(schema)(bson)).toEqual({ username: 'Peter' });
    }

    {
        const bson = serialize({ username: 'Peter', organisations: [] });
        //organisations stays undefined
        expect(getBSONDecoder(schema)(bson)).toEqual({ username: 'Peter', organisations: [] });
    }
});


test('constructor vars', () => {
    class UserBase {
        @t
        id: string = 'abc';

        @t
        version: number = 1;

        constructor(@t public name: string) {
        }
    }

    class User extends UserBase {
        @t
        connections: number = 10;
    }

    expect(getClassSchema(UserBase).getProperty('name').methodName).toBe('constructor');
    expect(getClassSchema(User).getProperty('name').methodName).toBe('constructor');

    expect(getClassSchema(User).getMethodProperties('constructor').includes(getClassSchema(User).getProperty('name'))).toBe(true);

    const bson = getBSONSerializer(User)(new User('peter'));
    const json = deserialize(Buffer.from(bson));
    expect(json.name).toBe('peter');
    const back = getBSONDecoder(User)(bson);
    expect(back.name).toBe('peter');

});