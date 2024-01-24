import { expect, test } from '@jest/globals';

import { MongoId, PrimaryKey, ReflectionClass, entity } from '@deepkit/type';

import { UpdateCommand } from '../src/client/command/update';
import { createDatabase } from './utils';

Error.stackTraceLimit = 100;

@entity.name('Model').collection('test_convert')
export class Model {
    _id: MongoId & PrimaryKey = '';

    a: number = 0;

    constructor(public name: string) {}
}

@entity.name('ModelString').collection('test_convert')
export class ModelString {
    _id: MongoId & PrimaryKey = '';

    a: string = '';

    constructor(public name: string) {}
}

// This is a use case for UpdateCommand to make a $convert query possible,
// which is not directly supported by the orm.
// Therefore UpdateCommand is exported by the mongo package.
test('raw $convert UpdateCommand', async () => {
    const db = await createDatabase('testing');
    await db.query(Model).deleteMany();

    const item = new Model('foo');
    item.a = 123;

    const item2 = new Model('foo2');
    item2.a = 456;

    await db.persist(item);
    await db.persist(item2);

    expect(await db.query(Model).filter({ a: 456 }).has()).toBe(true);

    const schema = ReflectionClass.from(Model);
    const command = new UpdateCommand(schema, [
        {
            // for types see: https://www.mongodb.com/docs/manual/reference/operator/aggregation/type/#available-types
            // int to string
            q: { a: { $type: 16 } },
            u: [{ $set: { a: { $convert: { input: '$a', to: 2 } } } }],
            multi: true,
        },
    ]);
    await db.adapter.client.execute(command);

    expect(await db.query(ModelString).filter({ a: '456' }).has()).toBe(true);
});
