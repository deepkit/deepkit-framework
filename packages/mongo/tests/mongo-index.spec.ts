import { expect, test } from '@jest/globals';

import { Database } from '@deepkit/orm';
import { Index, MongoId, PrimaryKey, ReflectionClass, Unique, entity } from '@deepkit/type';

import { MongoDatabaseAdapter } from '../src/adapter';

@entity.name('model-with-indexes')
class Model {
    _id: MongoId & PrimaryKey = '';
    department: number & Index & Unique = 0;
    homeoffice: number & Index<{ sparse: true }> = 0;
    something: number & Index<{ sparse: true; unique: true }> = 0;
    another: number & Index<{ unique: true }> = 0;
    // notIntendedAItSeemsOrBug: number & Index<{sparse: true}> & Unique = 0; // sparse missing: options: { unique: true }
    createdAt: Date & Index<{ expireAfterSeconds: 3600 }> = new Date();

    constructor(public name: string) {}
}

@entity.name('model-with-composite-index').index(['a', 'b'], { unique: true })
class ModelCompositeIndex {
    _id: MongoId & PrimaryKey = '';
    a: string = '';
    b: string = '';
    constructor(public name: string) {}
}

test('Index in ClassSchema', async () => {
    const schema = ReflectionClass.from(Model);

    // console.log(schema.getIndexSignatures()); // throws todo error
    // console.log(schema.indexes)

    // get index with [0] is a bit lazy and might fail?
    expect(schema.indexes[0]).toMatchObject({ names: ['department'], options: { unique: true } });
    expect(schema.indexes[1]).toMatchObject({ names: ['homeoffice'], options: { sparse: true } });
    expect(schema.indexes[2]).toMatchObject({ names: ['something'], options: { sparse: true, unique: true } });
    expect(schema.indexes[3]).toMatchObject({ names: ['another'], options: { unique: true } });
    expect(schema.indexes[4]).toMatchObject({ names: ['createdAt'], options: { expireAfterSeconds: 3600 } });
});

test('Composite index in ClassSchema', async () => {
    const schema = ReflectionClass.from(ModelCompositeIndex);
    // console.log(schema.indexes)

    // get index with [0] is a bit lazy and might fail?
    expect(schema.indexes[0]).toMatchObject({ names: ['a', 'b'], options: { unique: true } });
});

test('migrate()', async () => {
    const db = new Database(new MongoDatabaseAdapter(`mongodb://127.0.0.1/testing`), [Model, ModelCompositeIndex]);
    await db.query(Model).deleteMany();

    await db.migrate();

    // TODO no idea how to get the indexes out of db to compare
    // at least you can manually look into the db to check the indexes

    // some data to see something
    const item = new Model('foo');
    item.department = 42;
    item.homeoffice = 123;
    item.something = 456;
    item.another = 789;
    await db.persist(item);
    const dbItem = await db.query(Model).filter({ name: 'foo' }).findOne();
    expect(dbItem).not.toBe(item);

    const itemB = new ModelCompositeIndex('foo');
    itemB.a = 'AA';
    itemB.b = 'BB';
    await db.persist(item);

    db.disconnect();
});
