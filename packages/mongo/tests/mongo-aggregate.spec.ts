import { expect, test } from '@jest/globals';
import {
    entity, MongoId, PrimaryKey, ReflectionClass,
} from '@deepkit/type';
import { createDatabase } from './utils';
import { AggregateCommand } from '../src/client/command/aggregate';

Error.stackTraceLimit = 100;

@entity.name('Model').collection('test_aggregate')
export class Model {
    _id: MongoId & PrimaryKey = '';

    prodId: string = '';

    constructor(public name: string) {
    }
}


test('raw AggregateCommand', async () => {
    const db = await createDatabase('testing');
    await db.query(Model).deleteMany();

    const item = new Model('foo');
    item.prodId = 'AA';

    const item2 = new Model('foo2');
    item2.prodId = 'AA';

    const item3 = new Model('foo3');
    item3.prodId = 'BB';

    await db.persist(item);
    await db.persist(item2);
    await db.persist(item3);

    /* Expected Query result example
    [
      {
        _id: { prodId: 'AA' },
        uniqueIds: [ '63e69569a82a66fedb000001', '63e69569a82a66fedb000002' ],
        count: 2
      }
    ]
     */

    class ResultId {
        prodId!: string;
    }

    class DoubleEntries {
        _id!: ResultId;
        uniqueIds!: MongoId[];
        count!: number;
    }

    // this will find records with the same prodId and list their _id
    const pipeline = [{
        $group: {
            _id: {prodId: '$prodId'}, uniqueIds: {$addToSet: '$_id'}, count: {$sum: 1},
        },
    }, {
        $match: {
            count: {$gte: 2},
        },
    },];

    const resultSchema = ReflectionClass.from(DoubleEntries);
    const schema = ReflectionClass.from(Model);
    const command = new AggregateCommand(schema, pipeline, resultSchema);
    const res = await db.adapter.client.execute(command);

    // console.log(res);

    expect(res).toMatchObject([{
        _id: {prodId: 'AA'}, uniqueIds: [expect.any(String), expect.any(String)], count: 2
    }]);

});
