import 'jest-extended';
import 'reflect-metadata';
import {FieldDecoratorResult, t, Types} from '@super-hornet/marshal';
import {calculateObjectSize, serialize} from 'bson';
import {createBSONSizer, getBSONSerializer, JS_INT_MAX, JS_INT_MIN} from '../src/bson-serialize';
import {getBSONDecoder} from '../src/bson-jit-parser';
import * as Moment from 'moment';

enum MyEnum {
    first, second, third,
}
enum MyEnum2 {
    first = 'first', second = 'second', third = 'third',
}

class DecoratedValue {
    @t.array(t.string).decorated
    items: string[] = []
}

const ab = new ArrayBuffer(2);
const view = new Uint8Array(ab);
view[0] = 11;
view[1] = 22;

test('compare ab', () => {
    const other = new Uint8Array([11, 22]).buffer;
    expect(ab).toEqual(other);
});

const types: [FieldDecoratorResult<any>, any, any?][] = [
    [t.string, "Hello Peter"],
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
    [t.date, new Date("1987-10-12T00:00:00.000Z")],
    [t.date, new Date("2020-08-09T19:02:28.397Z")],
    [t.moment, Moment(new Date("1987-10-12T00:00:00.000Z"))],
    [t.moment, Moment(new Date("2020-08-09T19:02:28.397Z"))],
    [t.enum(MyEnum), MyEnum.first],
    [t.enum(MyEnum), MyEnum.second],
    [t.enum(MyEnum), MyEnum.third],
    [t.enum(MyEnum2), MyEnum2.first],
    [t.enum(MyEnum2), MyEnum2.second],
    [t.enum(MyEnum2), MyEnum2.third],
    [t.type({name: t.string}), {name: 'Peter'}],
    [t.array(t.string), ['Peter']],
    [t.map(t.string), {name: 'Peter'}],
    [t.any, {name: 'Peter', ready: false}],
    [t.type(ArrayBuffer), ab],
    [t.type(Uint8Array), new Uint8Array([22, 44, 55, 66])],
    [t.type(Int16Array), new Int16Array([22, 44, 55, 66])],
    [t.union(), {name: 'Peter'}],
    [t.partial({name: t.string}), {}],
    [t.partial({name: t.string}), {name: 'Peter'}],
    [t.type(DecoratedValue), ['a', 'b', 'c']],
];

test('nix', () => {});

for (const type of types) {
    const [field, value, expected] = type;

    test(`types round-trip: ${field.toString()}: ${value}`, () => {
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
        }

        const bsonMarshal = getBSONSerializer(s)(obj);

        const decoded = getBSONDecoder(s)(bsonMarshal);
        expect(decoded).toEqual(expectedObj);

        expect(getBSONDecoder(s)(getBSONSerializer(s)({}))).toEqual({});
        expect(getBSONDecoder(sOptional)(getBSONSerializer(sOptional)({}))).toEqual({});
        expect(getBSONDecoder(sOptional)(getBSONSerializer(sOptional)({field: null}))).toEqual({field: null});
        expect(getBSONDecoder(sNullable)(getBSONSerializer(sNullable)({field: null}))).toEqual({field: null});

        const type = field.buildPropertySchema().type;
        const blacklist: Types[] = [
            'moment',
            'uuid',
            'objectId',
            'arrayBuffer',
            'Uint8Array',
            'Int16Array'
        ];
        if (blacklist.includes(type)) return;

        expect(createBSONSizer(s)(obj)).toEqual(calculateObjectSize(obj));

        //official BSON serializer has a bug not serializing LONG correctly
        if (field.buildPropertySchema().type === 'number' && (value > JS_INT_MAX || value < JS_INT_MIN)) return;

        const bsonOfficial = serialize(obj);
        expect(bsonMarshal).toEqual(bsonOfficial);
    });
}