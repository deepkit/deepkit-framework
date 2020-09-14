import 'jest-extended';
import 'reflect-metadata';
import {deserialize, serialize} from 'bson';
import {parseObject, ParserV2} from '../src/bson-parser';
import {t} from '@deepkit/marshal';
import {getBSONDecoder} from '../src/bson-jit-parser';

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
});

test('createBSONParser', () => {
    const obj = {
        number: 13,
        cursor: {
            firstBatch: [{name: 'Peter'}, {name: 'Marc'}, {name: 'Bar'}],
            test: ['a', 'b', 'c']
        },
        ok: true,
    };

    const schema = t.schema({
        number: t.number,
        cursor: t.type({
            firstBatch: t.array({
                name: t.string
            }),
            test: t.string,
        }),
        ok: t.number,
    });

    const bson = serialize(obj);
    console.log('deserialized', deserialize(bson));

    const parsed = getBSONDecoder(schema)(bson);
    expect(parsed).toEqual(obj);
});


test('invalidation', () => {
    const schema = t.schema({
        username: t.string
    });

    {
        expect(getBSONDecoder(schema)(serialize({username: "Peter", foo: "bar"}))).toEqual({username: "Peter"});
    }

    {
        schema.addProperty('foo', t.string);
        const obj = {username: "Peter", foo: "bar"};
        expect(getBSONDecoder(schema)(serialize(obj))).toEqual(obj);
    }
});


test('undefined array', () => {
    const schema = t.schema({
        username: t.string,
        organisations: t.array(t.string)
    });

    {
        const bson = serialize({username: "Peter"});
        //organisations stays undefined
        expect(getBSONDecoder(schema)(bson)).toEqual({username: "Peter"});
    }

    {
        const bson = serialize({username: "Peter", organisations: []});
        //organisations stays undefined
        expect(getBSONDecoder(schema)(bson)).toEqual({username: "Peter", organisations: []});
    }
});