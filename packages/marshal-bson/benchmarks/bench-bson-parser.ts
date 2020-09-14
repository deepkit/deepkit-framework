import 'reflect-metadata';
import {deserialize, ObjectId, serialize} from 'bson';
import * as BSON from 'bson-ext';
import {BaseParser, parseObject, ParserV2, ParserV3} from '../src/bson-parser';
import {BenchSuite} from '@deepkit/core';
import {t} from '@deepkit/marshal';
import {getBSONDecoder} from '../src/bson-jit-parser';

// buildStringIndex(Buffer.from('abcdefgh!'));
// process.exit(1);

const bsonNative = new BSON([BSON.Binary, BSON.Code, BSON.DBRef, BSON.Decimal128, BSON.Double, BSON.Int32, BSON.Long, BSON.Map, BSON.MaxKey, BSON.MinKey, BSON.ObjectId, BSON.BSONRegExp, BSON.Symbol, BSON.Timestamp]);

class Obj {
    @t.mongoId id!: string;
    @t name!: string;
    @t.array(t.string) tags!: string[];
}

const obj = {
    id: new ObjectId(),
    name: '😂', //F0 9F 98 82
    tags: ['a', 'b', 'c', 'a', 'b', 'c'],
    '™£': 3,
    priority: 'µ',
    sum: '∑',
    '😂': 2,
};
console.log('obj', obj);
console.log('obj parsed generic v2', parseObject(new ParserV2(serialize(obj))));
console.log('obj parsed generic v3', parseObject(new ParserV3(serialize(obj))));
console.log('obj parsed JIT', getBSONDecoder(Obj)(serialize(obj)));

const itemSchema = t.schema({
    id: t.number,
    name: t.string,
    ready: t.boolean,
    priority: t.number,
    tags: t.array(t.string),
})
const items: any[] = [];

const count = 10_000;
for (let i = 0; i < count; i++) {
    items.push({
        // _id: new ObjectId(),
        id: i,
        name: 'Peter',
        ready: true,
        priority: 0,
        tags: ['a', 'b', 'c'],
    });
}

const schema = t.schema({
    cursor: {
        firstBatch: t.array(itemSchema)
    }
});

const bson = serialize({cursor: {firstBatch: items}});
const json = JSON.stringify({cursor: {firstBatch: items}});
const suite = new BenchSuite(`BSON Parser array with ${count} objects`);

const parser = getBSONDecoder(schema);
parser(bson);
parseObject(new ParserV3(bson));

suite.add('Marshal JS JIT', () => {
    const items = parser(bson);
});

suite.add('Marshal JS generic ParserV1', () => {
    const items = parseObject(new BaseParser(bson));
});

suite.add('Marshal JS generic ParserV2', () => {
    const items = parseObject(new ParserV2(bson));
});

suite.add('Marshal JS generic ParserV3', () => {
    const items = parseObject(new ParserV3(bson));
});

suite.add('official js-bson parser', () => {
    const items = deserialize(bson);
});

suite.add('official bson-ext, c++ native', () => {
    const items = bsonNative.deserialize(bson);
});

suite.add('JSON.parse()', () => {
    const items = JSON.parse(json);
});

const parserItem = getBSONDecoder(itemSchema);
const bsonOneItem = serialize(items[0]);
suite.add('Marshal JIT 1 item', () => {
    const items = parserItem(bsonOneItem);
});

const jsonOneItem = JSON.stringify(items[0]);
suite.add('JSON.parse() 1x', () => {
    const items = JSON.parse(jsonOneItem);
});

suite.run();
