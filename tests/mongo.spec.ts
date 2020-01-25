import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {
    classToPlain,
    DatabaseName,
    Entity,
    f, getClassSchema, getClassTypeFromInstance,
    getDatabaseName,
    getEntityName,
    plainToClass, PropertySchema, uuid,
} from "@marcj/marshal";
import {Binary, ObjectID} from "mongodb";
import {Database} from "../src/database";
import {SimpleModel, SuperSimple} from "@marcj/marshal/tests/entities";
import {plainToMongo, uuid4Stringify} from "../src/mapping";
import {Buffer} from "buffer";
import * as moment from "moment";
import {isPlainObject} from '@marcj/estdlib';
import {createConnection} from 'typeorm';
import {resolveCollectionName} from "../src/database-session";

let database: Database;

async function createDatabase(dbName: string = 'testing'): Promise<Database> {
    dbName = dbName.replace(/\s+/g, '-');
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
        @f.primary().mongoId() _id?: string;

        @f.moment()
        created: moment.Moment = moment();
    }

    const database = await createDatabase('test moment db');

    const m = new Model;
    m.created = moment(new Date('2018-10-13T12:17:35.000Z'));

    await database.add(m);
    const m2 = await database.query(Model).findOne();
    expect(m2).toBeInstanceOf(Model);
    expect(m2!.created).toBeInstanceOf(moment);
    expect(m2!.created.toJSON()).toBe('2018-10-13T12:17:35.000Z');
});

test('test save undefined values', async () => {
    const database = await createDatabase('test save undefined values');

    @Entity('undefined-model-value')
    class Model {
        @f.primary().mongoId() _id?: string;

        constructor(
            @f.optional()
            public name?: string) {
        }
    }

    const collection = database.getCollection(Model);

    {
        await collection.deleteMany({});
        await database.add(new Model(undefined));
        const mongoItem = await collection.find().toArray();
        expect(mongoItem[0].name).toBeUndefined();
    }

    {
        await collection.deleteMany({});
        await database.add(new Model('peter'));
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

    await database.add(instance);

    expect(await database.query(SimpleModel).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'MyNameNOTEXIST'}).count()).toBe(0);

    expect(await database.query(SimpleModel).has()).toBeTrue();
    expect(await database.query(SimpleModel).filter({name: 'myName'}).has()).toBeTrue();
    expect(await database.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).has()).toBeFalse();

    expect(await database.query(SimpleModel).filter({name: 'myName'}).findOneOrUndefined()).not.toBeUndefined();
    expect(await database.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOneOrUndefined()).toBeUndefined();

    await expect(database.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOne()).rejects.toThrowError('item not found');

    const collection = database.getCollection(SimpleModel);
    const mongoItem = await collection.find().toArray();

    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0]._id).toBeInstanceOf(ObjectID);
    expect(mongoItem[0].id).toBeInstanceOf(Binary);
    expect(uuid4Stringify(mongoItem[0].id)).toBe(instance.id);

    const found = await database.query(SimpleModel).filter({id: instance.id}).findOne();
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found!.name).toBe('myName');
    expect(found!.id).toBe(instance.id);

    const list = await database.query(SimpleModel).filter({id: instance.id}).find();
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe(instance.id);

    const listAll = await database.query(SimpleModel).find();
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe(instance.id);

    await database.query(SimpleModel).filter({name: 'noneExisting'}).patchOne({name: 'myName2'});

    expect(await database.query(SimpleModel).filter({id: instance.id}).ids()).toEqual([instance.id]);
    await database.query(SimpleModel).filter({id: instance.id}).patchOne({name: 'myName2'});

    {
        const found = await database.query(SimpleModel).filter({id: instance.id}).findOne();
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    {
        const found = await database.query(SimpleModel).disableInstancePooling().filter({id: instance.id}).findOne();
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    instance.name = 'New Name';
    await database.update(instance);
    expect(await database.query(SimpleModel).filter({name: 'MyName'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'New Name'}).has()).toBeTrue();
});

test('test patchAll', async () => {
    const database = await createDatabase('testing');

    await database.add(new SimpleModel('myName1'));
    await database.add(new SimpleModel('myName2'));
    await database.add(new SimpleModel('peter'));

    expect(await database.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(2);
    expect(await database.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(1);

    await database.query(SimpleModel).filter({name: {$regex: /^myName?/}}).patchMany({
        name: 'peterNew'
    });

    expect(await database.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(3);

    const fields = await database.query(SimpleModel).filter({name: 'peterNew'}).select(['name']).findOne();
    expect(fields!.name).toBe('peterNew');

    const fieldRows = await database.query(SimpleModel).select(['name']).find();
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

    await database.add(instance1);
    await database.add(instance2);

    expect(await database.query(SimpleModel).count()).toBe(2);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.remove(instance1);

    expect(await database.query(SimpleModel).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.remove(instance2);

    expect(await database.query(SimpleModel).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.add(instance1);
    await database.add(instance2);
    expect(await database.query(SimpleModel).count()).toBe(2);

    await database.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteMany();
    expect(await database.query(SimpleModel).count()).toBe(0);

    await database.add(instance1);
    await database.add(instance2);
    expect(await database.query(SimpleModel).count()).toBe(2);

    await database.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await database.query(SimpleModel).count()).toBe(1);

    await database.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await database.query(SimpleModel).count()).toBe(0);
});

test('test super simple model', async () => {
    const database = await createDatabase('testing');

    const instance = plainToClass(SuperSimple, {
        name: 'myName',
    });

    expect(instance._id).toBeUndefined();
    await database.add(instance);
    expect(instance._id).not.toBeUndefined();

    {
        const items = await database.query(SuperSimple).find();
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
    expect(resolveCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(instance._id).toBeUndefined();
    await database.add(instance);
    expect(instance._id).not.toBeUndefined();

    const collection = database.getCollection(DifferentDataBase);
    expect(await collection.countDocuments({})).toBe(1);

    const items = await database.query(DifferentDataBase).find();
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

    await expect(database.add(instance)).rejects.toThrow('has no primary field')
});


test('second object id', async () => {
    const database = await createDatabase('testing');

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

    await database.add(instance);

    const dbItem = await database.query(SecondObjectId).filter({name: 'myName'}).findOne();
    expect(dbItem!.name).toBe('myName');

    const dbItemBySecondId = await database.query(SecondObjectId).filter({secondId: '5bf4a1ccce060e0b38864c9e'}).findOne();
    expect(dbItemBySecondId!.name).toBe('myName');

    const collection = database.getCollection(SecondObjectId);
    const mongoItem = await collection.find().toArray();
    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0].preview).toBeInstanceOf(Binary);
    expect(mongoItem[0].preview.buffer.toString('utf8')).toBe('Baar');

    expect(mongoItem[0]._id).toBeInstanceOf(ObjectID);
    expect(mongoItem[0].secondId).toBeInstanceOf(ObjectID);
    expect(mongoItem[0]._id.toHexString()).toBe(instance._id);
    expect(mongoItem[0].secondId.toHexString()).toBe(instance.secondId);
});

test('references back', async () => {
    const database = await createDatabase('testing-references-back');

    @Entity('user1')
    class User {
        @f.uuid().primary() id: string = uuid();

        @f.forwardArray(() => Image).backReference()
        public images: Image[] = [];

        constructor(@f public name: string) {
        }
    }

    @Entity('image1')
    class Image {
        @f.uuid().primary() id: string = uuid();

        constructor(
            @f.forward(() => User).reference() public user: User,
            @f public title: string,
        ) {
        }
    }

    const imageSchema = getClassSchema(Image);
    expect(imageSchema.getProperty('userId')).toBeInstanceOf(PropertySchema);
    expect(imageSchema.getProperty('userId').type).toBe('uuid');

    const marc = new User('marc');
    const peter = new User('peter');
    const marcel = new User('marcel');

    await database.add(marc);
    await database.add(peter);
    await database.add(marcel);

    await database.add(new Image(marc, 'image1'));
    await database.add(new Image(marc, 'image2'));
    await database.add(new Image(marc, 'image3'));

    await database.add(new Image(peter, 'image1'));

    {
        const marcFromDb = await database.query(User).disableInstancePooling().filter({name: 'marc'}).findOne();
        expect(() => {
            marcFromDb.images;
        }).toThrow('images was not populated');
        expect(marcFromDb.id).toBeString();
        expect(marcFromDb.name).toBe('marc');

        const plain = classToPlain(User, marcFromDb);
        expect(plain.id).toBeString();
        expect(plain.name).toBe('marc');
        expect(plain.images).toBeUndefined();
    }

    {
        const marcFromDb = await database.query(User).filter({name: 'marc'}).asJSON().findOne();
        expect(isPlainObject(marcFromDb)).toBeTrue();
        expect(marcFromDb.id).toBeString();
        expect(marcFromDb.name).toBe('marc');
        expect(marcFromDb.images).toEqual([]);
    }

    {
        const marcFromDb = await database.query(User).filter({name: 'marc'}).asRaw().findOne();
        expect(isPlainObject(marcFromDb)).toBeTrue();
        expect(marcFromDb.id).toBeInstanceOf(Binary);
        expect(marcFromDb.name).toBe('marc');
        expect(marcFromDb.images).toBeUndefined();
    }

    {
        const marcFromDb = await database.query(User).select(['id']).filter({name: 'marc'}).asRaw().findOne();
        expect(isPlainObject(marcFromDb)).toBeTrue();
        expect(marcFromDb.id).toBeInstanceOf(Binary);
        expect(marcFromDb.name).toBeUndefined();
    }

    {
        const marcFromDb = await database.query(User).select(['id']).filter({name: 'marc'}).asJSON().findOne();
        expect(isPlainObject(marcFromDb)).toBeTrue();
        expect(marcFromDb.id).toBeString();
        expect(marcFromDb.name).toBeUndefined();
    }

    {
        const marcFromDb = await database.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb.name).toBe('marc');
        expect(marcFromDb.images).toBeArrayOfSize(3);
        expect(marcFromDb.images[0]).toBeInstanceOf(Image);
        expect(marcFromDb.images[1]).toBeInstanceOf(Image);
        expect(marcFromDb.images[2]).toBeInstanceOf(Image);
    }

    {
        const image2 = await database.query(Image).disableInstancePooling().filter({title: 'image2'}).findOne();
        expect(() => {
            image2.user.name;
        }).toThrow('User was not completely populated');
        // expect(image2['userId']).not.toBeUndefined();
        expect(() => {
            image2.user.name = '';
        }).toThrow('User was not completely populated');
        expect(image2.title).toBe('image2');

        //writing is allowed again
        const mowla = new User('mowla');
        image2.user = mowla;
        image2.user.name = 'mowla2';
        expect(image2.user).toBe(mowla);
    }

    {
        const image2 = await database.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(image2.title).toBe('image2');
        expect(image2.user).toBeInstanceOf(User);
        expect(image2.user.name).toBe('marc');
    }
});
