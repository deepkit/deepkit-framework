import 'jest-extended'
import 'reflect-metadata';
import {
    DatabaseName,
    Entity,
    f,
    getDatabaseName,
    getEntityName,
    plainToClass,
} from "@marcj/marshal";
import {Binary, ObjectID} from "mongodb";
import {Database} from "../src/database";
import {SimpleModel, SuperSimple} from "@marcj/marshal/tests/entities";
import {plainToMongo, uuid4Stringify} from "../src/mapping";
import {Buffer} from "buffer";
import {createConnection} from "typeorm";
import * as moment from "moment";

let database: Database;

async function createDatabase(dbName: string = 'testing'): Promise<Database> {
    const connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        port: 27017,
        database: "test",
        useNewUrlParser: true,
    });
    database = new Database(connection, dbName);
    await database.dropDatabase(dbName);
    return database;
}

afterEach(async () => {
    await database.close();
});

test('test moment db', async () => {
    @Entity('model-moment')
    class Model {
        @f.moment()
        created: moment.Moment = moment();
    }

    const database = await createDatabase('testing');

    const m = new Model;
    m.created = moment(new Date('2018-10-13T12:17:35.000Z'));

    await database.add(Model, m);
    const m2 = await database.get(Model, {});
    expect(m2).toBeInstanceOf(Model);
    expect(m2!.created).toBeInstanceOf(moment);
    expect(m2!.created.toJSON()).toBe('2018-10-13T12:17:35.000Z');
});

test('test save undefined values', async () => {
    const database = await createDatabase('testing');

    @Entity('undefined-model-value')
    class Model {
        constructor(
            @f.optional()
            public name?: string) {
        }
    }

    const collection = database.getCollection(Model);

    {
        await collection.deleteMany({});
        await database.add(Model, new Model(undefined));
        const mongoItem = await collection.find().toArray();
        expect(mongoItem[0].name).toBeUndefined();
    }

    {
        await collection.deleteMany({});
        await database.add(Model, new Model('peter'));
        const mongoItem = await collection.find().toArray();
        expect(mongoItem[0].name).toBe('peter')
    }
});

test('test save model', async () => {
    const database = await createDatabase('testing');

    expect(getEntityName(SimpleModel)).toBe('SimpleModel');

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
    });

    await database.add(SimpleModel, instance);
    expect((<any>instance)['version']).toBe(1);

    expect(await database.count(SimpleModel)).toBe(1);
    expect(await database.count(SimpleModel, {name: 'myName'})).toBe(1);
    expect(await database.count(SimpleModel, {name: 'MyNameNOTEXIST'})).toBe(0);

    expect(await database.has(SimpleModel)).toBeTrue();
    expect(await database.has(SimpleModel, {name: 'myName'})).toBeTrue();
    expect(await database.has(SimpleModel, {name: 'myNameNOTEXIST'})).toBeFalse();

    expect(await database.get(SimpleModel, {name: 'myName'})).not.toBeUndefined();
    expect(await database.get(SimpleModel, {name: 'myNameNOTEXIST'})).toBeUndefined();

    const collection = database.getCollection(SimpleModel);
    const mongoItem = await collection.find().toArray();
    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0]._id).toBeInstanceOf(ObjectID);
    expect(mongoItem[0].id).toBeInstanceOf(Binary);
    expect(uuid4Stringify(mongoItem[0].id)).toBe(instance.id);

    const found = await database.get(SimpleModel, {id: instance.id});
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found!.name).toBe('myName');
    expect(found!.id).toBe(instance.id);

    const list = await database.find(SimpleModel, {id: instance.id});
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe(instance.id);

    const listAll = await database.find(SimpleModel);
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe(instance.id);

    expect(await database.patch(SimpleModel, {name: 'noneExisting'}, {name: 'myName2'})).toBeUndefined();

    const notExisting = new SimpleModel('Hi');
    expect(await database.update(SimpleModel, notExisting)).toBeUndefined();

    expect(await database.patch(SimpleModel, {id: instance.id}, {name: 'myName2'})).toBe((<any>instance)['version'] + 1);

    {
        const found = await database.get(SimpleModel, {id: instance.id});
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    instance.name = 'New Name';
    await database.update(SimpleModel, instance);
    expect(await database.has(SimpleModel, {name: 'MyName'})).toBeFalse();
    expect(await database.has(SimpleModel, {name: 'New Name'})).toBeTrue();

    instance.name = 'New Name 2';

    await database.update(SimpleModel, instance, {yesNo: true});

    expect(await database.has(SimpleModel, {name: 'MyName'})).toBeFalse();
    expect(await database.has(SimpleModel, {name: 'MyName 2'})).toBeFalse();
    expect(await database.has(SimpleModel, {name: 'New Name'})).toBeTrue();

    await database.update(SimpleModel, instance, {id: instance.id});
    expect(await database.has(SimpleModel, {name: 'MyName'})).toBeFalse();
    expect(await database.has(SimpleModel, {name: 'New Name'})).toBeFalse();
    expect(await database.has(SimpleModel, {name: 'New Name 2'})).toBeTrue();
});

test('test patchAll', async () => {
    const database = await createDatabase('testing');

    await database.add(SimpleModel, new SimpleModel('myName1'));
    await database.add(SimpleModel, new SimpleModel('myName2'));
    await database.add(SimpleModel, new SimpleModel('peter'));

    expect(await database.count(SimpleModel, {name: {$regex: /^myName?/}})).toBe(2);
    expect(await database.count(SimpleModel, {name: {$regex: /^peter.*/}})).toBe(1);

    await database.patchAll(SimpleModel, {name: {$regex: /^myName?/}}, {
        name: 'peterNew'
    });

    expect(await database.count(SimpleModel, {name: {$regex: /^myName?/}})).toBe(0);
    expect(await database.count(SimpleModel, {name: {$regex: /^peter.*/}})).toBe(3);

    const fields = await database.fieldsOne(SimpleModel, {name: 'peterNew'}, ['name']);
    expect(fields!.name).toBe('peterNew');

    const fieldRows = await database.fields(SimpleModel, {}, ['name']);
    expect(fieldRows).toBeArrayOfSize(3);
    expect(fieldRows[0].name).toBe('peterNew');
    expect(fieldRows[1].name).toBe('peterNew');
    expect(fieldRows[2].name).toBe('peter');
});

test('test delete', async () => {
    const database = await createDatabase('testing');

    const instance1 = plainToClass(SimpleModel, {
        name: 'myName1',
    });

    const instance2 = plainToClass(SimpleModel, {
        name: 'myName2',
    });

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);

    expect(await database.count(SimpleModel)).toBe(2);
    expect(await database.count(SimpleModel, {name: 'myName1'})).toBe(1);
    expect(await database.count(SimpleModel, {name: 'myName2'})).toBe(1);
    expect(await database.count(SimpleModel, {name: 'myName3'})).toBe(0);

    await database.remove(SimpleModel, instance1.id);

    expect(await database.count(SimpleModel)).toBe(1);
    expect(await database.count(SimpleModel, {name: 'myName1'})).toBe(0);
    expect(await database.count(SimpleModel, {name: 'myName2'})).toBe(1);
    expect(await database.count(SimpleModel, {name: 'myName3'})).toBe(0);

    await database.remove(SimpleModel, instance2.id);

    expect(await database.count(SimpleModel)).toBe(0);
    expect(await database.count(SimpleModel, {name: 'myName1'})).toBe(0);
    expect(await database.count(SimpleModel, {name: 'myName2'})).toBe(0);
    expect(await database.count(SimpleModel, {name: 'myName3'})).toBe(0);

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);
    expect(await database.count(SimpleModel)).toBe(2);

    await database.deleteMany(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.count(SimpleModel)).toBe(0);

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);
    expect(await database.count(SimpleModel)).toBe(2);

    await database.deleteOne(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.count(SimpleModel)).toBe(1);

    await database.deleteOne(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.count(SimpleModel)).toBe(0);
});

test('test super simple model', async () => {
    const database = await createDatabase('testing');

    const instance = plainToClass(SuperSimple, {
        name: 'myName',
    });

    expect(instance._id).toBeUndefined();
    await database.add(SuperSimple, instance);
    expect(instance._id).not.toBeUndefined();

    {
        const items = await database.find(SuperSimple);
        expect(items[0]).toBeInstanceOf(SuperSimple);
        expect(items[0]._id).toBe(instance._id);
        expect(items[0].name).toBe(instance.name);
    }

    {
        const items = await (await database.cursor(SuperSimple)).toArray();
        expect(items[0]).toBeInstanceOf(SuperSimple);
        expect(items[0]._id).toBe(instance._id);
        expect(items[0].name).toBe(instance.name);
    }
});

test('test databaseName', async () => {
    const database = await createDatabase('testing');
    await database.dropDatabase('testing2');

    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing2')
    class DifferentDataBase {
        @f.primary().mongoId()
        _id?: string;

        @f
        name?: string;
    }

    const instance = plainToClass(DifferentDataBase, {
        name: 'myName',
    });

    expect(getDatabaseName(DifferentDataBase)).toBe('testing2');
    expect(database.getCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(instance._id).toBeUndefined();
    await database.add(DifferentDataBase, instance);
    expect(instance._id).not.toBeUndefined();

    const collection = database.getCollection(DifferentDataBase);
    expect(await collection.countDocuments({})).toBe(1);

    const items = await database.find(DifferentDataBase);
    expect(items[0]._id).toBe(instance._id);
    expect(items[0].name).toBe(instance.name);
});

test('no id', async () => {
    const database = await createDatabase('testing');

    @Entity('NoId')
    class NoId {
        @f.mongoId()
        _id?: string;

        @f
        name?: string;
    }

    const instance = plainToClass(NoId, {
        name: 'myName',
    });

    expect(database.getCollectionName(NoId)).toBe('NoId');
    await database.add(NoId, instance);
    expect(instance._id).toBeUndefined();

    const dbItem = await database.get(NoId, {name: 'myName'});
    expect(dbItem!.name).toBe('myName');

    dbItem!.name = 'Changed';

    await expect(database.update(NoId, dbItem)).rejects.toThrow('Class NoId has no @ID() defined')
});


test('second object id', async () => {
    const database = await createDatabase('testing');

    console.log('Buffer', Buffer);

    @Entity('SecondObjectId')
    class SecondObjectId {
        @f.primary().mongoId()
        _id?: string;

        @f
        name?: string;

        @f.type(Buffer)
        preview: Buffer = Buffer.from('FooBar', 'utf8');

        @f.mongoId()
        secondId?: string;
    }

    {
        const instance = plainToMongo(SecondObjectId, {
            _id: '5c8a99d8fdfafb2c8dd59ad6',
            name: 'peter',
            secondId: '5bf4a1ccce060e0b38864c9e',
            preview: 'QmFhcg==', //Baar
        });
        expect(instance._id).toBeInstanceOf(ObjectID);
        expect(instance._id).toEqual(new ObjectID('5c8a99d8fdfafb2c8dd59ad6'));
        expect(instance.secondId).toBeInstanceOf(ObjectID);
        expect(instance.secondId).toEqual(new ObjectID('5bf4a1ccce060e0b38864c9e'));
        expect(instance.name).toBe('peter');
        expect(instance.preview).toBeInstanceOf(Binary);
        expect(instance.preview.toString()).toBe('Baar');
    }


    const instance = plainToClass(SecondObjectId, {
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: 'QmFhcg==', //Baar
    });

    await database.add(SecondObjectId, instance);

    const dbItem = await database.get(SecondObjectId, {name: 'myName'});
    expect(dbItem!.name).toBe('myName');

    const dbItemBySecondId = await database.get(SecondObjectId, {secondId: '5bf4a1ccce060e0b38864c9e'});
    expect(dbItemBySecondId!.name).toBe('myName');

    const collection = database.getCollection(SecondObjectId);
    const mongoItem = await collection.find().toArray();
    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0].preview).toBeInstanceOf(Binary);
    expect(mongoItem[0].preview.buffer.toString('utf8')).toBe('Baar');

    console.log(mongoItem[0]);
    expect(mongoItem[0]._id).toBeInstanceOf(ObjectID);
    expect(mongoItem[0].secondId).toBeInstanceOf(ObjectID);
    expect(mongoItem[0]._id.toHexString()).toBe(instance._id);
    expect(mongoItem[0].secondId.toHexString()).toBe(instance.secondId);
});
