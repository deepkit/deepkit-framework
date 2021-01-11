/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import 'reflect-metadata';
import bson from 'bson';
const { calculateObjectSize, serialize } = bson;
import BSON from 'bson-ext';
import { BenchSuite } from '../bench';
import { t } from '@deepkit/type';
import { createBSONSizer, getBSONSerializer } from '@deepkit/bson';

export async function main() {
    const bsonNative = new BSON([BSON.Binary, BSON.Code, BSON.DBRef, BSON.Decimal128, BSON.Double, BSON.Int32, BSON.Long, BSON.Map, BSON.MaxKey, BSON.MinKey, BSON.ObjectId, BSON.BSONRegExp, BSON.Symbol, BSON.Timestamp]);

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
            name: 'Peter',
            ready: true,
            priority: 0,
            tags: ['a', 'b', 'c', 'd'],
        });
    }

    const schema = t.schema({
        cursor: {
            firstBatch: t.array(itemSchema)
        }
    });

    const suite = new BenchSuite(`BSON serializer array of ${count} items`);
    const data = { cursor: { firstBatch: items } };

    const serializer = getBSONSerializer(schema);
    const bson = serializer({ cursor: { firstBatch: [items[0]] } });
    console.log('buffer official size', calculateObjectSize(items[0]));
    console.log('buffer deepkit size', createBSONSizer(itemSchema)(items[0]));

    console.log('buffer deepkit', getBSONSerializer(itemSchema)(items[0]));
    console.log('buffer official', serialize(items[0]));
    // const parsed = createBSONParser(itemSchema)(serializer({cursor: {firstBatch: [items[0]]}}));
    // console.log('buffer parsed', parsed.cursor.firstBatch[0]);

    // process.exit(1);

    // const buffer = Buffer.alloc(16);
    // const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // suite.add('Buffer 4x uint8', () => {
    //     buffer[0] = 2;
    //     buffer[1] = 4;
    //     buffer[2] = 8;
    //     buffer[3] = 12;
    // });
    //
    // suite.add('DataView setUint8', () => {
    //     dataView.setUint8(0, 2);
    //     dataView.setUint8(1, 4);
    //     dataView.setUint8(2, 8);
    //     dataView.setUint8(3, 12);
    // });
    //
    // suite.add('DataView setUint32', () => {
    //     dataView.setUint32(0, 23344, true)
    // });


    const sizer = createBSONSizer(schema);
    suite.add('deepkit/bson sizer', () => {
        const size = sizer(data);
        Buffer.alloc(size);
    });

    suite.add('js-bson calculateObjectSize', () => {
        const size = calculateObjectSize(data);
        Buffer.alloc(size);
    });

    const serializer1Item = getBSONSerializer(itemSchema);
    suite.add('deepkit/bson stringify 1 item', () => {
        serializer1Item(items[0]);
    });

    suite.add('JSON.stringify 1 item', () => {
        Buffer.from(JSON.stringify(items[0]), 'utf8');
    });

    suite.add('BSON js serialize 1 item', () => {
        serialize(items[0]);
    });

    suite.add('deepkit/bson stringify 10k', () => {
        serializer(data);
    });

    suite.add('BSON js serialize 10k', () => {
        serialize(data);
    });

    suite.add('BSON native serialize 10k', () => {
        bsonNative.serialize(data);
    });

    suite.add('JSON.stringify 10k', () => {
        Buffer.from(JSON.stringify(data), 'utf8');
    });

    suite.run();
}

