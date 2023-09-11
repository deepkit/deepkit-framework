import { expect, test } from '@jest/globals';
import {
    entity,
    MongoId,
    PrimaryKey,
    ReflectionClass,
} from '@deepkit/type';
import { createDatabase } from './utils';
import { FindAndModifyCommand } from '../src/lib/client/command/findAndModify';

Error.stackTraceLimit = 100;

@entity.name('Model').collection('test_modify')
export class Model {
    _id: MongoId & PrimaryKey = '';

    a: string = '';
    b: string = '';

    constructor(public name: string) {
    }
}

@entity.name('ModelC').collection('test_modify')
export class ModelC {
    _id: MongoId & PrimaryKey = '';

    a: string = '';
    c: string = '';

    constructor(public name: string) {
    }
}

// This is a use case for FindAndModifyCommand to make a $rename query possible,
// which is not directly supported by the orm.
// Therefore FindAndModifyCommand is exported by the mongo package.
test('raw $rename FindAndModifyCommand', async () => {
    const db = await createDatabase('testing');
    await db.query(Model).deleteMany();

    const item = new Model('foo');
    item.a = 'AA';
    item.b = 'BB';

    const item2 = new Model('foo2');
    item2.a = 'AAA';
    item2.b = 'BBB';

    await db.persist(item);
    await db.persist(item2);

    const schema = ReflectionClass.from(Model);
    const command = new FindAndModifyCommand(
        schema,
        {name: 'foo'},
        {$rename: {'b': 'c'}}
    );
    await db.adapter.client.execute(command);

    expect(await db.query(Model).filter({b: 'BB'}).has()).toBe(false);
    expect(await db.query(ModelC).filter({c: 'BB'}).has()).toBe(true);
});
