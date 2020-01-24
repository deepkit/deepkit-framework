import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {
    classToPlain,
    DatabaseName,
    Entity,
    f, getClassSchema,
    getDatabaseName,
    getEntityName,
    plainToClass, PropertySchema, uuid,
} from "@marcj/marshal";
import {Binary, ObjectID} from "mongodb";
import {Database} from "../src/database";
import {SimpleModel, SuperSimple} from "@marcj/marshal/tests/entities";
import {plainToMongo, uuid4Stringify} from "../src/mapping";
import {Buffer} from "buffer";
import {createConnection} from "typeorm";
import * as moment from "moment";
import { isPlainObject } from '@marcj/estdlib';

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
    const m2 = await database.query(Model).findOne();
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

    expect(await database.patch(SimpleModel, {name: 'noneExisting'}, {name: 'myName2'})).toBeUndefined();

    const notExisting = new SimpleModel('Hi');
    expect(await database.update(SimpleModel, notExisting)).toBeUndefined();

    await database.patch(SimpleModel, {id: instance.id}, {name: 'myName2'});

    {
        const found = await database.query(SimpleModel).filter({id: instance.id}).findOne();
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found!.name).toBe('myName2');
    }

    instance.name = 'New Name';
    await database.update(SimpleModel, instance);
    expect(await database.query(SimpleModel).filter({name: 'MyName'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'New Name'}).has()).toBeTrue();

    instance.name = 'New Name 2';

    await database.update(SimpleModel, instance, {yesNo: true});

    expect(await database.query(SimpleModel).filter({name: 'MyName'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'MyName 2'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'New Name'}).has()).toBeTrue();

    await database.update(SimpleModel, instance, {id: instance.id});
    expect(await database.query(SimpleModel).filter({name: 'MyName'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'New Name'}).has()).toBeFalse();
    expect(await database.query(SimpleModel).filter({name: 'New Name 2'}).has()).toBeTrue();
});

test('test patchAll', async () => {
    const database = await createDatabase('testing');

    await database.add(SimpleModel, new SimpleModel('myName1'));
    await database.add(SimpleModel, new SimpleModel('myName2'));
    await database.add(SimpleModel, new SimpleModel('peter'));

    expect(await database.query(SimpleModel).filter({name: {$regex: /^myName?/}}).count()).toBe(2);
    expect(await database.query(SimpleModel).filter({name: {$regex: /^peter.*/}}).count()).toBe(1);

    await database.patchAll(SimpleModel, {name: {$regex: /^myName?/}}, {
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

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);

    expect(await database.query(SimpleModel).count()).toBe(2);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.remove(SimpleModel, instance1.id);

    expect(await database.query(SimpleModel).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(1);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.remove(SimpleModel, instance2.id);

    expect(await database.query(SimpleModel).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName1'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName2'}).count()).toBe(0);
    expect(await database.query(SimpleModel).filter({name: 'myName3'}).count()).toBe(0);

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);
    expect(await database.query(SimpleModel).count()).toBe(2);

    await database.deleteMany(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.query(SimpleModel).count()).toBe(0);

    await database.add(SimpleModel, instance1);
    await database.add(SimpleModel, instance2);
    expect(await database.query(SimpleModel).count()).toBe(2);

    await database.deleteOne(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.query(SimpleModel).count()).toBe(1);

    await database.deleteOne(SimpleModel, {name: {$regex: /myName[0-9]/}});
    expect(await database.query(SimpleModel).count()).toBe(0);
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
    expect(database.getCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(instance._id).toBeUndefined();
    await database.add(DifferentDataBase, instance);
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

    expect(database.getCollectionName(NoId)).toBe('NoId');
    await database.add(NoId, instance);
    expect(instance._id).toBeUndefined();

    const dbItem = await database.query(NoId).filter({name: 'myName'}).findOne();
    expect(dbItem!.name).toBe('myName');

    dbItem!.name = 'Changed';

    await expect(database.update(NoId, dbItem)).rejects.toThrow('Class NoId has no @f.primary() defined')
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

    await database.add(SecondObjectId, instance);

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

    await database.addEntity(marc);
    await database.addEntity(peter);
    await database.addEntity(marcel);

    await database.addEntity(new Image(marc, 'image1'));
    await database.addEntity(new Image(marc, 'image2'));
    await database.addEntity(new Image(marc, 'image3'));

    await database.addEntity(new Image(peter, 'image1'));

    {
        const marcFromDb = await database.query(User).filter({name: 'marc'}).findOne();
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
        const image2 = await database.query(Image).filter({title: 'image2'}).findOne();
        expect(() => {
            image2.user;
        }).toThrow('user was not populated');
        // expect(image2['userId']).not.toBeUndefined();
        expect(image2.title).toBe('image2');

        //writing is allowed
        const mowla = new User('mowla');
        image2.user = mowla; //then reading works again
        expect(image2.user).toBe(mowla);
    }

    {
        const image2 = await database.query(Image).joinWith('user').filter({title: 'image2'}).findOne();
        expect(image2.title).toBe('image2');
        expect(image2.user).toBeInstanceOf(User);
        expect(image2.user.name).toBe('marc');
    }
});

test('joins', async () => {
    const database = await createDatabase('testing-joins');

    @Entity('user2')
    class User {
        @f.uuid().primary()
        id: string = uuid();

        @f.forwardArray(() => Organisation).backReference({via: () => OrganisationMembership})
        organisations: Organisation[] = [];

        constructor(@f public name: string) {
        }
    }

    @Entity('organisation2')
    class Organisation {
        @f.uuid().primary()
        id: string = uuid();

        @f.array(User).backReference({via: () => OrganisationMembership})
        users: User[] = [];

        constructor(
            @f public name: string,
            @f.reference() public owner: User,
        ) {
        }
    }

    @Entity('organisation_member2')
    class OrganisationMembership {
        @f.uuid().primary()
        id: string = uuid();

        //manyToOne
        @f.reference()
        user?: User;

        //manyToOne
        @f.reference()
        organisation?: Organisation;

        constructor(
            @f.index().uuid() public userId: string,
            @f.index().uuid() public organisationId: string,
        ) {
        }
    }

    const admin = new User('admin');
    const marc = new User('marc');
    const peter = new User('peter');
    const marcel = new User('marcel');

    const microsoft = new Organisation('Microsoft', admin);
    const apple = new Organisation('Apple', admin);

    await database.addEntity(admin);
    await database.addEntity(marc);
    await database.addEntity(peter);
    await database.addEntity(marcel);

    await database.addEntity(microsoft);
    await database.addEntity(apple);

    await database.addEntity(new OrganisationMembership(marc.id, apple.id));
    await database.addEntity(new OrganisationMembership(marc.id, microsoft.id));
    await database.addEntity(new OrganisationMembership(peter.id, microsoft.id));
    await database.addEntity(new OrganisationMembership(marcel.id, microsoft.id));

    expect(await database.query(User).count()).toBe(4);
    expect(await database.query(Organisation).count()).toBe(2);
    expect(await database.query(OrganisationMembership).count()).toBe(4);

    expect(await database.query(OrganisationMembership).filter({userId: marc.id}).count()).toBe(2);
    expect(await database.query(OrganisationMembership).filter({userId: peter.id}).count()).toBe(1);
    expect(await database.query(OrganisationMembership).filter({userId: marcel.id}).count()).toBe(1);

    expect(await database.query(OrganisationMembership).filter({organisationId: apple.id}).count()).toBe(1);
    expect(await database.query(OrganisationMembership).filter({organisationId: microsoft.id}).count()).toBe(3);

    expect(() => {
        database.query(Organisation).join('id');
    }).toThrow('is not marked as reference');

    {
        const item = await database.query(User).findOneField('name');
        expect(item).toEqual('admin');
    }

    {
        const items = await database.query(User).findField('name');
        expect(items).toEqual(['admin', 'marc', 'peter', 'marcel']);
    }

    {
        const items = await database.query(User).sort({name: 'asc'}).findField('name');
        expect(items).toEqual(['admin', 'marc', 'marcel', 'peter']);
    }

    {
        const items = await database.query(User).sort({name: 'desc'}).findField('name');
        expect(items).toEqual(['peter', 'marcel', 'marc', 'admin']);
    }

    await expect(database.query(User).filter({name: 'notexisting'}).findOneField('name')).rejects.toThrow('not found');3

    expect(await database.query(User).filter({name: 'marc'}).has()).toBe(true);
    expect(await database.query(User).filter({name: 'notexisting'}).has()).toBe(false);

    expect(await database.query(User).join('organisations').filter({name: 'marc'}).has()).toBe(true);
    expect(await database.query(User).join('organisations').filter({name: 'notexisting'}).has()).toBe(false);

    {
        const item = await database.query(User).filter({name: 'notexisting'}).findOneFieldOrUndefined('name');
        expect(item).toBeUndefined();
    }

    {
        const schema = getClassSchema(OrganisationMembership);
        expect(schema.getProperty('user').getResolvedClassType()).toBe(User);
        const query = database.query(OrganisationMembership).joinWith('user');

        const resolvedType = query.model.joins[0].propertySchema.getResolvedClassType();
        expect(resolvedType).toBe(User);
        expect(resolvedType === User).toBe(true);

        const schema2 = getClassSchema(resolvedType);
        expect(schema2.name).toBe('user2');
        expect(schema2.classType).toBe(User);
        expect(query.model.joins[0].propertySchema.getResolvedClassSchema().classType).toBe(User)
    }

    {
        const items = await database.query(OrganisationMembership).joinWith('user').find();
        expect(items.length).toBe(4);
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[0].user).toBe(items[1].user); //marc === marc instance

        expect(items[0].user).toBeInstanceOf(User);
        expect(items[0].user!.id.length).toBeGreaterThan(10);
        expect(items[0].user!.name.length).toBeGreaterThan(2);

        const count = await database.query(OrganisationMembership).joinWith('user').count();
        expect(count).toBe(4);
    }

    {
        const items = await database.query(OrganisationMembership).filter({userId: peter.id}).joinWith('user').find();
        expect(items.length).toBe(1);
        expect(items[0].userId).toBe(peter.id);
        expect(items[0].organisationId).toBe(microsoft.id);
    }

    {
        const item = await database.query(OrganisationMembership).filter({userId: peter.id}).joinWith('user').findOne();
        expect(item).not.toBeUndefined();
        expect(item.userId).toBe(peter.id);
        expect(item.organisationId).toBe(microsoft.id);

        const count1 = await database.query(OrganisationMembership).filter({userId: peter.id}).joinWith('user').count();
        expect(count1).toBe(1);

        const count2 = await database.query(OrganisationMembership).filter({userId: peter.id}).count();
        expect(count2).toBe(1);
    }

    {
        const items = await database.query(OrganisationMembership).innerJoin('user').find();
        expect(items.length).toBe(4);
    }

    {
        const items = await database.query(OrganisationMembership)
            .useJoinWith('user').filter({name: 'marc'}).end().find();
        expect(items.length).toBe(4); //still 4, but user is empty for all other than marc
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[1].user).toBeInstanceOf(User);
        expect(items[2].user).toBeUndefined();
        expect(items[3].user).toBeUndefined();
    }

    {
        const items = await database.query(OrganisationMembership)
            .useInnerJoin('user').filter({name: 'marc'}).end().find();

        expect(items.length).toBe(2);
        expect(() => {
            items[0].user;
        }).toThrow('not populated');

        expect(() => {
            items[1].user;
        }).toThrow('not populated');
    }

    {
        const query = await database.query(OrganisationMembership)
            .useInnerJoinWith('user').select(['id']).filter({name: 'marc'}).end();

        {
            const items = await query.find();
            expect(items.length).toBe(2);
            expect(items[0].user).not.toBeInstanceOf(User);
            expect(items[1].user).not.toBeInstanceOf(User);

            expect(items[0].user).toEqual({id: marc.id});
        }

        {
            const items = await query.clone().find();
            expect(items.length).toBe(2);
            expect(items[0].user).not.toBeInstanceOf(User);
            expect(items[1].user).not.toBeInstanceOf(User);

            expect(items[0].user).toEqual({id: marc.id});
        }
    }

    {
        const items = await database.query(User).innerJoinWith('organisations').find();

        expect(items[0].organisations).toBeArrayOfSize(2);
        expect(items[0].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[0].name).toBe('Microsoft');
        expect(items[0].organisations[1]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[1].name).toBe('Apple');

        expect(items[1].organisations).toBeArrayOfSize(1);
        expect(items[1].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[1].organisations[0].name).toBe('Microsoft');

        expect(items[0].organisations[0]).toBe(items[1].organisations[0]); //microsoft the same instance
    }

    {
        const items = await database.query(User).useInnerJoinWith('organisations').filter({name: 'Microsoft'}).end().find();
        expect(items[0].organisations).toBeArrayOfSize(1);
        expect(items[0].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[0].name).toBe('Microsoft');

        expect(items[1].organisations).toBeArrayOfSize(1);
        expect(items[1].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[1].organisations[0].name).toBe('Microsoft');

        expect(items[0].organisations[0]).toBe(items[1].organisations[0]); //microsoft the same instance
    }

    {
        const items = await database.query(Organisation).useJoinWith('users').end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(3);
        expect(items[1].users).toBeArrayOfSize(1);
    }

    {
        const items = await database.query(Organisation).useInnerJoinWith('users').end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(3);
        expect(items[1].users).toBeArrayOfSize(1);

        expect(items[0].users[0].name).toBe('marc');
        expect(items[0].users[1].name).toBe('peter');
        expect(items[0].users[2].name).toBe('marcel');
    }

    {
        const items = await database.query(Organisation).useInnerJoinWith('users').sort({name: 'asc'}).end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(3);
        expect(items[1].users).toBeArrayOfSize(1);

        expect(items[0].users[0].name).toBe('marc');
        expect(items[0].users[1].name).toBe('marcel');
        expect(items[0].users[2].name).toBe('peter');
    }

    {
        const items = await database.query(Organisation).useJoinWith('users').sort({name: 'asc'}).skip(1).end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(2);
        expect(items[1].users).toBeArrayOfSize(0);

        expect(items[0].users[0].name).toBe('marcel');
        expect(items[0].users[1].name).toBe('peter');
    }

    {
        const items = await database.query(Organisation).useJoinWith('users').sort({name: 'asc'}).skip(1).limit(1).end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(1);
        expect(items[1].users).toBeArrayOfSize(0);

        expect(items[0].users[0].name).toBe('marcel');
    }

    {
        const items = await database.query(Organisation).useJoinWith('users').select(['id']).end().find();
        expect(items).toBeArrayOfSize(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users).toBeArrayOfSize(3);
        expect(items[1].users).toBeArrayOfSize(1);

        expect(items[0].users[0]).not.toBeInstanceOf(User);
        expect(items[0].users[0].id).toBe(marc.id);
        expect(items[0].users[0].name).toBeUndefined();
    }

    {
        const query = database.query(OrganisationMembership)
            .useInnerJoinWith('user').filter({name: 'marc'}).end();

        const items = await query.find();
        expect(items.length).toBe(2); //we get 2 because of inner join
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[1].user).toBeInstanceOf(User);

        const items2 = await query.joinWith('organisation').find();
        expect(items2.length).toBe(2); //still the same
        expect(items2[0].user).toBeInstanceOf(User);
        expect(items2[1].user).toBeInstanceOf(User);
    }

    {
        const query = database.query(OrganisationMembership)
            .useInnerJoinWith('user').filter({name: 'marc'}).end();

        const item = await query.findOne();
        expect(item.user).toBeInstanceOf(User);
        expect(item.user!.name).toBe('marc');
    }

    {
        const query = database.query(OrganisationMembership).filter({user: marc});
        const items = await query.find();
        expect(items.length).toBe(2);
    }

    await database.remove(User, peter.id);

    {
        const query = database.query(OrganisationMembership).joinWith('user').filter({userId: peter.id});
        const items = await query.find();
        expect(items.length).toBe(1);
        expect(await query.count()).toBe(1);
    }

    {
        const count = await database.query(OrganisationMembership).joinWith('user').filter({
            userId: peter.id,
            user: {$exists: true}
        }).count();
        expect(count).toBe(0);
    }

    {
        expect(await database.query(OrganisationMembership).innerJoin('user').filter({userId: peter.id}).count()).toBe(0);
        expect(await database.query(OrganisationMembership).innerJoinWith('user').filter({userId: peter.id}).count()).toBe(0);
    }

    {
        const query = database.query(OrganisationMembership)
            .useJoinWith('user').filter({name: 'marc'}).end()
            .joinWith('organisation');

        expect(query.model.joins).toBeArrayOfSize(2);
        expect(query.model.joins[0].propertySchema.getResolvedClassType()).toBe(User);
        expect(query.model.joins[1].propertySchema.getResolvedClassType()).toBe(Organisation);

        const items = await query.find();
        expect(items.length).toBe(4); //we get all, because we got a left join
    }

    {
        const query = database.query(User)
            .useInnerJoinWith('organisations').filter({name: 'Microsoft'}).end();
        {
            const items = await query.find();
            expect(items).toBeArrayOfSize(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations).toBeArrayOfSize(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(() => {expect(items[0].organisations[0].owner).toBeUndefined();}).toThrow('was not populated');
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations).toBeArrayOfSize(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(() => {expect(items[1].organisations[0].owner).toBeUndefined();}).toThrow('was not populated');
        }

        {
            const items = await query.clone().getJoin('organisations').joinWith('owner').end().find();
            expect(items).toBeArrayOfSize(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations).toBeArrayOfSize(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(items[0].organisations[0].owner).toBeInstanceOf(User);
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations).toBeArrayOfSize(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(items[1].organisations[0].owner).toBeInstanceOf(User);
            expect(items[1].organisations[0].owner).toBe(items[0].organisations[0].owner);
            expect(items[1].organisations[0].owner.name).toBe('admin');
            expect(items[1].organisations[0].owner.id).toBe(admin.id);
        }

        {
            const items = await query.clone().getJoin('organisations').useJoinWith('owner').select(['id']).end().end().find();
            expect(items).toBeArrayOfSize(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations).toBeArrayOfSize(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(items[0].organisations[0].owner).not.toBeInstanceOf(User);
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations).toBeArrayOfSize(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(items[1].organisations[0].owner).not.toBeInstanceOf(User);
            expect(items[1].organisations[0].owner.name).toBeUndefined();
            expect(items[1].organisations[0].owner.id).toBe(admin.id);
        }
    }
});
