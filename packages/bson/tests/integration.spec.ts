import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { entity, FieldDecoratorResult, t, Types } from '@deepkit/type';
import bson from 'bson';
import { createBSONSizer, getBSONSerializer, JS_INT_MAX, JS_INT_MIN } from '../src/bson-serialize';
import { getBSONDecoder } from '../src/bson-jit-parser';

const { calculateObjectSize, serialize, deserialize } = bson;

enum MyEnum {
    first, second, third,
}

enum MyEnum2 {
    first = 'first', second = 'second', third = 'third',
}

class DecoratedValue {
    constructor(
        @t.array(t.string).decorated
        public c: string[] = []
    ) {
    }
}

class DecoratedValue2 {
    @t.array(t.string).decorated
    public items: string[] = [];
}

@entity.name('myModel')
class MyModel {
    @t.literal('a').discriminant public type: string = 'a';

    @t items: DecoratedValue = new DecoratedValue;

    constructor(@t public name: string) {
    }
}

class SimpleModel {
    @t items: DecoratedValue = new DecoratedValue;

    constructor(@t public name: string) {
    }
}

const ab = new ArrayBuffer(2);
const uint8Array = new Uint8Array(ab);

uint8Array[0] = 11;
uint8Array[1] = 22;

test('compare ab', () => {
    const other = new Uint8Array([11, 22]).buffer;
    expect(ab).toEqual(other);
});

const decoratedValue2 = new DecoratedValue2();
decoratedValue2.items = ['a', 'b', 'c'];








const types: [type: FieldDecoratorResult<any>, value: any, expected?: any, dontComarepToMongo?: true][] = [
    [t.string, 'Hello Peter'],
    [t.number, 1],
    [t.number, 0],
    [t.number, -1],
    [t.number, -90071992547409920],
    [t.number, 90071992547409920],
    [t.number, 134.444444445],
    [t.number, -134.444444445],
    [t.number, 212313134.444444445],
    [t.number, -1212313134.444444445],
    [t.boolean, false],
    [t.boolean, true],
    [t.boolean, true],
    [t.uuid, 'bef8de96-41fe-442f-b70c-c3a150f8c96c'],
    [t.uuid, 'bef8de92-41fe-442f-b70c-c3a150f8c961'],
    [t.mongoId, '507f191e810c19729de860ea'],
    [t.date, new Date('1987-10-12T00:00:00.000Z')],
    [t.date, new Date('2020-08-09T19:02:28.397Z')],
    [t.enum(MyEnum), MyEnum.first],
    [t.enum(MyEnum), MyEnum.second],
    [t.enum(MyEnum), MyEnum.third],
    [t.enum(MyEnum2), MyEnum2.first],
    [t.enum(MyEnum2), MyEnum2.second],
    [t.enum(MyEnum2), MyEnum2.third],
    [t.type({ name: t.string }), { name: 'Peter' }],
    [t.union(t.string, MyModel), 'asd'],
    [t.union(t.string, MyModel), {name: 'foo'}, new MyModel('foo'), true],
    [t.union(t.string, SimpleModel), 'asd'],
    [t.union(t.string, SimpleModel), {name: 'foo'}, new SimpleModel('foo')],
    [t.union(t.mongoId, SimpleModel), '507f191e810c19729de860ea', undefined, true],
    [t.union(t.mongoId, SimpleModel), {name: 'foo'}, new SimpleModel('foo')],
    [t.union(t.string, t.array(t.string)), 'asd'],
    [t.union(t.string, t.array(t.string)), ['a', 'b']],
    [t.union(t.string, t.uuid), 'asd'],
    [t.union(t.string, t.uuid), '3c25985e-4e25-45db-9e8a-a487cc78929a'],
    [t.union(t.string, t.mongoId), 'asd'],
    [t.union(t.string, t.mongoId), '507f191e810c19729de860ea', undefined, true],
    [t.union(t.string, t.uuid, t.date), '3c25985e-4e25-45db-9e8a-a487cc78929a'],
    [t.union(t.string, t.uuid, t.date), 'asd'],
    [t.union(t.string, t.map(t.string)), 'asd'],
    [t.union(t.string, t.map(t.string)), { first: 'asd', second: 'asd' }],
    [t.union(t.string, t.partial(MyModel)), 'asd'],
    [t.union(t.string, t.partial(MyModel)), { name: 'asd' }],
    [t.union(t.string, t.type(ArrayBuffer)), 'asd'],
    [t.union(t.string, t.type(ArrayBuffer)), ab, undefined, true],
    [t.union(t.string, t.type(Uint8Array)), uint8Array, undefined, true],
    [t.type(DecoratedValue), new DecoratedValue(['a', 'b']), undefined, true],
    [t.type(DecoratedValue2), decoratedValue2, undefined, true],
    [t.union(t.string, MyModel), { type: 'a', name: 'Peter', items: new DecoratedValue(['a', 'b']), }, undefined, true],
    [t.array(t.string), ['Peter', 'b']],
    [t.array(t.number.optional), [1, undefined, 2], undefined, true], //bson-js converts the undefined into null
    [t.array(t.string.optional), ['Peter', undefined, 'Bar'], undefined, true], //bson-js converts the undefined into null
    [t.array(t.string.nullable), ['Peter', null, 'Bar']],
    [t.array(t.union(t.string, t.number)), ['Peter', 23, 'Bar']],
    [t.array(t.union(t.boolean, t.number)), [false, 23, true]],
    [t.map(t.string), { name: 'Peter' }],
    [t.any, { name: 'Peter', ready: false }],
    [t.type(ArrayBuffer), ab],
    [t.type(Uint8Array), new Uint8Array([22, 44, 55, 66])],
    [t.type(Int16Array), new Int16Array([22, 44, 55, 66])],
    [t.union(t.type({ type: t.literal('m'), name: t.string })), { type: 'm', name: 'Peter' }],
    [t.partial({ name: t.string }), {}],
    [t.partial({ name: t.string }), { name: 'Peter' }],
    [t.any, new RegExp('/abc/', 'g')],
    [t.any, new RegExp(/abc/, 'g')],
    [t.any, /abc/g],
    [t.any, /abc/i],
    [t.any, /abc/m],
    [t.any, /abc/gim],
];

for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const [field, value, expected, dontCompareToBSONJS] = type;
    const property = (field as FieldDecoratorResult<any>).buildPropertySchema('test_' + i);

    test(`types round-trip #${i} ${property.toString()}: ${value}`, () => {
        const s = t.schema({
            field: field
        });

        const sOptional = t.schema({
            field: field.optional
        });

        const sNullable = t.schema({
            field: field.nullable
        });

        const obj = {
            field: value
        };

        const expectedObj = {
            field: expected ?? value
        };

        expect(sOptional.getProperty('field').isOptional).toBe(true);
        expect(sNullable.getProperty('field').isNullable).toBe(true);

        const bsonDeepkit = getBSONSerializer(s)(obj);
        // console.log('back', obj, deserialize(Buffer.from(bsonDeepkit)));

        const decoded = getBSONDecoder(s)(bsonDeepkit);
        expect(decoded).toEqual(expectedObj);

        expect(getBSONDecoder(s)(getBSONSerializer(s)({}))).toEqual({});

        //optional
        // expect(getBSONDecoder(sOptional)(getBSONSerializer(sOptional)({}))).toEqual({});
        const optionalTrip = getBSONDecoder(sOptional)(getBSONSerializer(sOptional)({field: undefined}));
        expect(optionalTrip).toEqual({field: undefined});
        expect('field' in optionalTrip).toEqual(true);

        //null
        expect(getBSONDecoder(sNullable)(getBSONSerializer(sNullable)({field: undefined}))).toEqual({field: null});
        expect('field' in getBSONDecoder(sNullable)(getBSONSerializer(sNullable)({field: undefined}))).toEqual(true);
        const nullTrip = getBSONDecoder(sNullable)(getBSONSerializer(sNullable)({field: null}));
        expect(nullTrip).toEqual({field: null});

        const type = field.buildPropertySchema().type;
        const blacklist: Types[] = [
            'uuid',
            'objectId',
            'arrayBuffer',
            'Uint8Array',
            'Int16Array'
        ];
        if (blacklist.includes(type)) return;

        if (dontCompareToBSONJS) return;

        expect(createBSONSizer(s)(obj)).toEqual(calculateObjectSize(obj));

        //official BSON serializer has a bug not serializing LONG correctly
        if (field.buildPropertySchema().type === 'number' && (value > JS_INT_MAX || value < JS_INT_MIN)) return;

        const bsonOfficial = serialize(obj);
        expect(obj).toEqual(deserialize(serialize(obj)));
        expect(bsonDeepkit).toEqual(bsonOfficial);
    });
}
