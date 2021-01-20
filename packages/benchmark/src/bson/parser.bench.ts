/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import bson from 'bson';
import BSON from 'bson-ext';
import { BenchSuite } from '../bench';
import { t } from '@deepkit/type';
import { getBSONDecoder, parseObject, ParserV2, BaseParser, ParserV3 } from '@deepkit/bson';
const { deserialize, ObjectId, serialize } = bson;

const bsonNative = new BSON([BSON.Binary, BSON.Code, BSON.DBRef, BSON.Decimal128, BSON.Double, BSON.Int32, BSON.Long, BSON.Map, BSON.MaxKey, BSON.MinKey, BSON.ObjectId, BSON.BSONRegExp, BSON.Symbol, BSON.Timestamp]);

class Obj {
    @t.mongoId id!: string;
    @t name!: string;
    @t.array(t.string) tags!: string[];
}

export async function main() {

    const obj = {
        id: new ObjectId(),
        name: '😂', //F0 9F 98 82
        tags: ['a', 'b', 'c', 'a', 'b', 'c'],
        '™£': 3,
        priority: 'µ',
        f: '2H₂ + O₂ ⇌ 2H₂O',
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
    });
    const items: any[] = [];

    const count = 10_000;
    for (let i = 0; i < count; i++) {
        items.push({
            // _id: new ObjectId(),
            id: i,
            name: 'x'.repeat(5),
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

    const bson = serialize({ cursor: { firstBatch: items } });
    const json = JSON.stringify({ cursor: { firstBatch: items } });
    const suite = new BenchSuite(`BSON Parser array with ${count} objects`);

    const parser = getBSONDecoder(schema);
    parser(bson);

    suite.add('_deepkit/bson JS JIT', () => {
        const items = parser(bson);
    });

    suite.add('_deepkit/bson JS generic ParserV1, decodeUTF8', () => {
        const items = parseObject(new BaseParser(bson));
    });

    suite.add('_deepkit/bson JS generic ParserV2, assume ASCII prop names', () => {
        const items = parseObject(new ParserV2(bson));
    });

    suite.add('_deepkit/bson JS generic ParserV3, TextDecoder', () => {
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
    suite.add('_deepkit/bson JIT 1 item', () => {
        const items = parserItem(bsonOneItem);
    });

    const jsonOneItem = JSON.stringify(items[0]);
    suite.add('JSON.parse() 1 item', () => {
        const items = JSON.parse(jsonOneItem);
    });

    suite.run();
}
