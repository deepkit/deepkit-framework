import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { arrayBufferFrom, Entity, getClassSchema, getEntityName, jsonSerializer, nodeBufferToArrayBuffer, PropertySchema, t, uuid, } from '@deepkit/type';
import { getInstanceStateFromItem } from '@deepkit/orm';
import { SimpleModel, SuperSimple } from './entities';
import { createDatabase } from './utils';

Error.stackTraceLimit = 100;

test('test save undefined values', async () => {
    const session = await createDatabase('test save undefined values');

    @Entity('undefined-model-value')
    class Model {
        @t.primary.mongoId _id?: string;

        constructor(
            @t.optional
            public name?: string) {
        }
    }

    // const collection = await session.adapter.connection.getCollection(getClassSchema(Model));
    //
    // {
    //     await collection.deleteMany({});
    //     await db.persist(new Model(undefined));
    //     const mongoItem = await collection.find().toArray();
    //     expect(mongoItem[0].name).toBe(null);
    //     const marshalItem = await session.query(Model).findOne();
    //     expect(marshalItem.name).toBe(undefined);
    // }
    //
    // {
    //     await collection.deleteMany({});
    //     await db.persist(new Model('peter'));
    //     const mongoItem = await collection.find().toArray();
    //     expect(mongoItem[0].name).toBe('peter');
    // }
});

test('query patch', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    const item = new SimpleModel('foo');
    await db.persist(item);

    const dbItem = await db.query(SimpleModel).filter({name: 'foo'}).findOne();
    expect(dbItem).not.toBe(item);

    const patched = await db.query(SimpleModel).filter({name: 'foo'}).patchOne({name: 'bar'});
    expect(patched.modified).toBe(1);
    expect(await db.query(SimpleModel).filter({name: 'foo'}).has()).toBe(false);
    expect(await db.query(SimpleModel).filter({name: 'bar'}).has()).toBe(true);
});

test('query filter with undefined filter', async () => {
    const db = await createDatabase('testing');

    const item1 = new SuperSimple();
    const item2 = new SuperSimple();
    item2.name = 'foo';

    await db.persist(item1, item2);

    {
        const items = await db.query(SuperSimple).find();
        expect(items.length).toBe(2);
        expect(await db.query(SuperSimple).has()).toBe(true);
    }

    {
        const items = await db.query(SuperSimple).filter({name: undefined}).find();
        expect(items.length).toBe(1); //only one item has name: undefined
        expect(await db.query(SuperSimple).filter({name: undefined}).count()).toBe(1); //only one item has name: undefined
        expect(await db.query(SuperSimple).filter({name: undefined}).has()).toBe(true);
    }

    {
        await db.query(SuperSimple).patchMany({name: undefined});
        expect(await db.query(SuperSimple).filter({name: undefined}).count()).toBe(2);
    }
});

test('uof sets undefined for optional field', async () => {
    const db = await createDatabase('testing');

    const item1 = new SuperSimple();
    item1.name = 'foo';

    await db.persist(item1);

    expect(await db.query(SuperSimple).filter({name: undefined}).count()).toBe(0);

    {
        const session = db.createSession();
        const item = await session.query(SuperSimple).findOne();
        expect(item.name).toBe('foo');

        item.name = undefined;
        await session.commit();

        expect(await db.query(SuperSimple).filter({name: undefined}).count()).toBe(1);
    }
});

test('uow patch', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    const item = new SimpleModel('foo');
    session.add(item);
    await session.commit();

    item.name = 'bar';
    await session.commit();

    expect(await db.query(SimpleModel).filter({name: 'foo'}).has()).toBe(false);
    expect(await db.query(SimpleModel).filter({name: 'bar'}).has()).toBe(true);
});

test('save model', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    expect(getEntityName(SimpleModel)).toBe('SimpleModel');

    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
    });
    expect(instance).toBeInstanceOf(SimpleModel);
    expect(instance.name).toBe('myName');

    session.add(instance);
    await session.commit();

    expect(await session.query(SimpleModel).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'MyNameNOTEXIST'}).count()).toBe(0);

    expect(await session.query(SimpleModel).has()).toBe(true);
    expect(await session.query(SimpleModel).filter({name: 'myName'}).has()).toBe(true);
    expect(await session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).has()).toBe(false);

    expect(await session.query(SimpleModel).filter({name: 'myName'}).findOneOrUndefined()).not.toBeUndefined();
    expect(await session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOneOrUndefined()).toBeUndefined();

    await expect(session.query(SimpleModel).filter({name: 'myNameNOTEXIST'}).findOne()).rejects.toThrowError('not found');

    const found = await session.query(SimpleModel).filter({id: instance.id}).findOne();
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found!.name).toBe('myName');
    expect(found!.id).toBe(instance.id);

    const list = await session.query(SimpleModel).filter({id: instance.id}).find();
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe(instance.id);

    const listAll = await session.query(SimpleModel).find();
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe(instance.id);

    expect((await session.query(SimpleModel).filter({name: 'noneExisting'}).patchOne({name: 'myName2'})).modified).toBe(0);

    expect(await session.query(SimpleModel).filter({id: instance.id}).ids(true)).toEqual([instance.id]);
    expect((await session.query(SimpleModel).filter({id: instance.id}).patchOne({name: 'myName2'})).modified).toBe(1);

    {
        const found = await session.query(SimpleModel).filter({id: instance.id}).findOne();
        expect(found === instance).toBe(true);
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2'); //although we get the stuff from the identityMap, those were also adjusted in GenericQuery.patch
    }

    {
        const found = await session.query(SimpleModel).disableIdentityMap().filter({id: instance.id}).findOne();
        expect(found === instance).toBe(false);
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    instance.name = 'New Name';
    await db.persist(instance);
    expect(await session.query(SimpleModel).filter({name: 'MyName'}).has()).toBe(false);
    expect(await session.query(SimpleModel).filter({name: 'New Name'}).has()).toBe(true);
});

test('test patchAll', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    await db.persist(new SimpleModel('myName1'));
    await db.persist(new SimpleModel('myName2'));
    await db.persist(new SimpleModel('peter'));

    expect(await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(2);
    expect(await session.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(1);

    await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).patchMany({
        name: 'peterNew'
    });

    expect(await session.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(3);

    const fields = await session.query(SimpleModel).filter({name: 'peterNew'}).select('name').findOne();
    expect(fields!.name).toBe('peterNew');

    const fieldRows = await session.query(SimpleModel).select('name').find();
    expect(fieldRows.length).toBe(3);
    expect(fieldRows[0].name).toBe('peterNew');
    expect(fieldRows[1].name).toBe('peterNew');
    expect(fieldRows[2].name).toBe('peter');
});

test('test delete', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    const instance1 = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName1',
    });

    const instance2 = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName2',
    });

    session.add(instance1);
    session.add(instance2);
    await session.commit();
    expect(getInstanceStateFromItem(instance1).isKnownInDatabase()).toBe(true);
    expect(getInstanceStateFromItem(instance2).isKnownInDatabase()).toBe(true);

    expect(await session.query(SimpleModel).count()).toBe(2);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    session.remove(instance1);
    await session.commit();

    expect(getInstanceStateFromItem(instance1).isKnownInDatabase()).toBe(false);

    expect(await session.query(SimpleModel).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    session.remove(instance2);
    await session.commit();
    expect(getInstanceStateFromItem(instance2).isKnownInDatabase()).toBe(false);

    expect(await session.query(SimpleModel).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(0);
    expect(await session.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);
    expect(getInstanceStateFromItem(instance1).isKnownInDatabase()).toBe(false);
    expect(getInstanceStateFromItem(instance2).isKnownInDatabase()).toBe(false);

    session.add(instance1);
    session.add(instance2);
    await session.commit();
    expect(getInstanceStateFromItem(instance1).isKnownInDatabase()).toBe(true);
    expect(getInstanceStateFromItem(instance2).isKnownInDatabase()).toBe(true);
    expect(await session.query(SimpleModel).count()).toBe(2);

    expect((await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteMany()).modified).toBe(2);
    expect(await session.query(SimpleModel).count()).toBe(0);

    expect(getInstanceStateFromItem(instance1).isKnownInDatabase()).toBe(false);

    session.add(instance1);
    session.add(instance2);
    await session.commit();
    expect(await session.query(SimpleModel).count()).toBe(2);

    await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await session.query(SimpleModel).count()).toBe(1);

    await session.query(SimpleModel).filter({name: {$regex: /myName[0-9]/}}).deleteOne();
    expect(await session.query(SimpleModel).count()).toBe(0);
});

test('test super simple model', async () => {
    const db = await createDatabase('testing-simple-model');
    const session = db.createSession();

    const instance = jsonSerializer.for(SuperSimple).deserialize({
        name: 'myName',
    });

    expect(instance._id).toBeUndefined();
    await db.persist(instance);
    expect(instance._id).not.toBeUndefined();

    {
        const items = await session.query(SuperSimple).find();
        expect(items[0]).toBeInstanceOf(SuperSimple);
        expect(items[0]._id).toBe(instance._id);
        expect(items[0].name).toBe(instance.name);
    }
});

// test('test databaseName', async () => {
//     const session = await createDatabase('testing-databaseName');
//     await (await session.adapter.connection.connect()).db('testing2').dropDatabase();
//
//     @Entity('DifferentDataBase', 'differentCollection')
//     @DatabaseName('testing2')
//     class DifferentDataBase {
//         @t.primary.mongoId
//         _id?: string;
//
//         @t
//         name?: string;
//     }
//
//     const instance = jsonSerializer.for(DifferentDataBase).deserialize({
//         name: 'myName',
//     });
//
//     expect(getDatabaseName(DifferentDataBase)).toBe('testing2');
//     expect(session.adapter.connection.resolveCollectionName(getClassSchema(DifferentDataBase))).toBe('differentCollection');
//
//     expect(instance._id).toBeUndefined();
//     await db.persist(instance);
//     expect(instance._id).not.toBeUndefined();
//
//     const collection = await session.adapter.connection.getCollection(getClassSchema(DifferentDataBase));
//     expect(await collection.countDocuments({})).toBe(1);
//
//     const items = await session.query(DifferentDataBase).find();
//     expect(items[0]._id).toBe(instance._id);
//     expect(items[0].name).toBe(instance.name);
// });

test('no id', async () => {
    const db = await createDatabase('testing');

    @Entity('NoId')
    class NoId {
        @t.mongoId
        _id?: string;

        @t
        name?: string;
    }

    const instance = jsonSerializer.for(NoId).deserialize({
        name: 'myName',
    });

    await expect(db.persist(instance)).rejects.toThrow('has no primary field');
});


test('second object id', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    @Entity('SecondObjectId')
    class SecondObjectId {
        @t.primary.mongoId
        _id?: string;

        @t
        name?: string;

        @t.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');

        @t.mongoId
        secondId?: string;
    }

    const instance = jsonSerializer.for(SecondObjectId).deserialize({
        name: 'myName',
        secondId: '5bf4a1ccce060e0b38864c9e',
        preview: nodeBufferToArrayBuffer(Buffer.from('QmFhcg==', 'base64')), //Baar
    });

    session.add(instance);
    await session.commit();

    const dbItem = await session.query(SecondObjectId).filter({name: 'myName'}).findOne();
    expect(dbItem!.name).toBe('myName');

    const dbItemBySecondId = await session.query(SecondObjectId).filter({secondId: '5bf4a1ccce060e0b38864c9e'}).findOne();
    expect(dbItemBySecondId!.name).toBe('myName');

    // const collection = await session.adapter.connection.getCollection(getClassSchema(SecondObjectId));
    // const mongoItem = await collection.find().toArray();
    // expect(mongoItem.length).toBe(1);
    // expect(mongoItem[0].name).toBe('myName');
    // expect(mongoItem[0].preview).toBeInstanceOf(mongodb.Binary);
    // expect(mongoItem[0].preview.buffer.toString('utf8')).toBe('Baar');
    //
    // expect(mongoItem[0]._id).toBeInstanceOf(mongodb.ObjectID);
    // expect(mongoItem[0].secondId).toBeInstanceOf(mongodb.ObjectID);
    // expect(mongoItem[0]._id.toHexString()).toBe(instance._id);
    // expect(mongoItem[0].secondId.toHexString()).toBe(instance.secondId);
});

test('references back', async () => {
    const db = await createDatabase('testing-references-back');
    const session = db.createSession();

    @Entity('user1')
    class User {
        @t.uuid.primary id: string = uuid();

        @t.array(() => Image).backReference()
        public images: Image[] = [];

        constructor(@t public name: string) {
        }
    }

    @Entity('image1')
    class Image {
        @t.uuid.primary id: string = uuid();

        constructor(
            @t.reference() public user: User,
            @t public title: string,
        ) {
            if (user.images && !user.images.includes(this)) {
                user.images.push(this);
            }
        }
    }

    const userSchema = getClassSchema(User);
    expect(userSchema.getProperty('images').backReference).not.toBeUndefined();

    const imageSchema = getClassSchema(Image);
    expect(imageSchema.getProperty('user')).toBeInstanceOf(PropertySchema);
    expect(imageSchema.getProperty('user').type).toBe('class');
    expect(imageSchema.getProperty('user').classType).toBe(User);

    const marc = new User('marc');
    const peter = new User('peter');
    const marcel = new User('marcel');

    session.add(marc);
    session.add(peter);
    session.add(marcel);

    const image2 = new Image(marc, 'image2');
    session.add(new Image(marc, 'image1'));
    session.add(image2);
    session.add(new Image(marc, 'image3'));

    session.add(new Image(peter, 'image1'));
    await session.commit();

    {
        expect(getInstanceStateFromItem(marc).isFromDatabase()).toBe(false);
        expect(getInstanceStateFromItem(image2).isFromDatabase()).toBe(false);
        const marcFromDb = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb === marc).toBe(true);
        expect(getInstanceStateFromItem(marcFromDb).isFromDatabase()).toBe(false);

        //make sure that it returns the image2 we already have
        const imageDb = await session.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(getInstanceStateFromItem(imageDb).isFromDatabase()).toBe(false);

        expect(imageDb).toBe(image2);
        expect(imageDb.title).toBe('image2');
        expect(imageDb.user).toBeInstanceOf(User);
        //reference is still correct and not overwritten
        expect(imageDb.user.name).toBe('marc');
        expect(imageDb.user).toBe(marc);

        const marcFromDb2 = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb2 === marc).toBe(true);
    }

    {
        const marcFromDb = await session.query(User).disableIdentityMap().filter({name: 'marc'}).findOne();
        expect(getInstanceStateFromItem(marcFromDb).isFromDatabase()).toBe(true);

        expect(() => {
            marcFromDb.images;
        }).toThrow('images was not populated');
        expect(typeof marcFromDb.id).toBe('string');
        expect(marcFromDb.name).toBe('marc');

        const plain = jsonSerializer.for(User).serialize(marcFromDb);
        expect(typeof plain.id).toBe('string');
        expect(plain.name).toBe('marc');
        expect(plain.images).toBe(null);
    }

    {
        const marcFromDb = await session.query(User).joinWith('images').filter({name: 'marc'}).findOne();
        expect(marcFromDb === marc).toBe(true);
        expect(getInstanceStateFromItem(marcFromDb).isFromDatabase()).toBe(false);
        expect(marcFromDb.name).toBe('marc');
        expect(marcFromDb.images.length).toBe(3);
        expect(marcFromDb.images[0]).toBeInstanceOf(Image);
        expect(marcFromDb.images[1]).toBeInstanceOf(Image);
        expect(marcFromDb.images[2]).toBeInstanceOf(Image);
    }

    {
        const image2 = await session.query(Image).disableIdentityMap().filter({title: 'image2'}).findOne();
        expect(() => {
            image2.user.name;
        }).toThrow(`Can not access User.name since class was not completely hydrated`);
        image2.user.name = 'changed';
        expect(image2.user.name).toBe('changed');
        expect(image2.title).toBe('image2');

        //writing is allowed again
        const mowla = new User('mowla');
        image2.user = mowla;
        image2.user.name = 'mowla2';
        expect(image2.user).toBe(mowla);
    }

    {
        const image2 = await session.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(image2.title).toBe('image2');
        expect(image2.user).toBeInstanceOf(User);
        expect(image2.user.name).toBe('marc');
    }
});

test('test identityMap', async () => {
    const db = await createDatabase('testing');
    const session = db.createSession();

    const item = new SimpleModel('myName1');
    session.add(item);
    await session.commit();

    const pkHash = getInstanceStateFromItem(item).getLastKnownPKHash();
    const idItem = session.identityMap.getByHash(getClassSchema(SimpleModel), pkHash);
    expect(idItem).toBe(item);

    const dbItem = await session.query(SimpleModel).filter({name: 'myName1'}).findOne();
    expect(dbItem === item).toBe(true);
    expect(dbItem).toBe(item);
});
