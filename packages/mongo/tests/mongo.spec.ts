import 'jest-extended';
import 'reflect-metadata';
import {
  BinaryType,
  DatabaseName,
  Entity,
  getCollectionName,
  getDatabaseName,
  getEntityName,
  ID,
  MongoIdType,
  plainToClass,
  StringType,
} from '@marcj/marshal';
import { Binary, ObjectID, MongoClient } from 'mongodb';
import { Database } from '../src/database';
import { SimpleModel, SuperSimple } from '@marcj/marshal/tests/entities';
import { uuid4Stringify } from '../src/mapping';
import { Buffer } from 'buffer';

let connection: MongoClient;

afterEach(async () => {
  await connection.close(true);
});

test('test save model', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

  expect(getEntityName(SimpleModel)).toBe('SimpleModel');

  const instance = plainToClass(SimpleModel, {
    name: 'myName',
  });

  await database.add(SimpleModel, instance);
  expect((<any>instance)['version']).toBe(1);

  expect(await database.count(SimpleModel)).toBe(1);
  expect(await database.count(SimpleModel, { name: 'myName' })).toBe(1);
  expect(await database.count(SimpleModel, { name: 'MyNameNOTEXIST' })).toBe(0);

  expect(await database.has(SimpleModel)).toBeTrue();
  expect(await database.has(SimpleModel, { name: 'myName' })).toBeTrue();
  expect(
    await database.has(SimpleModel, { name: 'myNameNOTEXIST' })
  ).toBeFalse();

  expect(await database.get(SimpleModel, { name: 'myName' })).not.toBeNull();
  expect(
    await database.get(SimpleModel, { name: 'myNameNOTEXIST' })
  ).toBeNull();

  const collection = connection
    .db('testing')
    .collection(getCollectionName(SimpleModel));
  const mongoItem = await collection.find().toArray();
  expect(mongoItem).toBeArrayOfSize(1);
  expect(mongoItem[0].name).toBe('myName');
  expect(mongoItem[0]._id).toBeInstanceOf(ObjectID);
  expect(mongoItem[0].id).toBeInstanceOf(Binary);
  expect(uuid4Stringify(mongoItem[0].id)).toBe(instance.id);

  const found = await database.get(SimpleModel, { id: instance.id });
  expect(found).toBeInstanceOf(SimpleModel);
  expect(found!.name).toBe('myName');
  expect(found!.id).toBe(instance.id);

  const list = await database.find(SimpleModel, { id: instance.id });
  expect(list[0]).toBeInstanceOf(SimpleModel);
  expect(list[0].name).toBe('myName');
  expect(list[0].id).toBe(instance.id);

  const listAll = await database.find(SimpleModel);
  expect(listAll[0]).toBeInstanceOf(SimpleModel);
  expect(listAll[0].name).toBe('myName');
  expect(listAll[0].id).toBe(instance.id);

  expect(
    await database.patch(
      SimpleModel,
      { name: 'noneExisting' },
      { name: 'myName2' }
    )
  ).toBeNull();

  const notExisting = new SimpleModel('Hi');
  expect(await database.update(SimpleModel, notExisting)).toBeNull();

  expect(
    await database.patch(SimpleModel, { id: instance.id }, { name: 'myName2' })
  ).toBe((<any>instance)['version'] + 1);

  {
    const found = await database.get(SimpleModel, { id: instance.id });
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found!.name).toBe('myName2');
  }

  instance.name = 'New Name';
  await database.update(SimpleModel, instance);
  expect(await database.has(SimpleModel, { name: 'MyName' })).toBeFalse();
  expect(await database.has(SimpleModel, { name: 'New Name' })).toBeTrue();

  instance.name = 'New Name 2';
  await database.update(SimpleModel, instance, { noResult: '2132' });
  expect(await database.has(SimpleModel, { name: 'MyName' })).toBeFalse();
  expect(await database.has(SimpleModel, { name: 'MyName 2' })).toBeFalse();
  expect(await database.has(SimpleModel, { name: 'New Name' })).toBeTrue();

  await database.update(SimpleModel, instance, { id: instance.id });
  expect(await database.has(SimpleModel, { name: 'MyName' })).toBeFalse();
  expect(await database.has(SimpleModel, { name: 'New Name' })).toBeFalse();
  expect(await database.has(SimpleModel, { name: 'New Name 2' })).toBeTrue();
});

test('test delete', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

  const instance1 = plainToClass(SimpleModel, {
    name: 'myName1',
  });

  const instance2 = plainToClass(SimpleModel, {
    name: 'myName2',
  });

  await database.add(SimpleModel, instance1);
  await database.add(SimpleModel, instance2);

  expect(await database.count(SimpleModel)).toBe(2);
  expect(await database.count(SimpleModel, { name: 'myName1' })).toBe(1);
  expect(await database.count(SimpleModel, { name: 'myName2' })).toBe(1);
  expect(await database.count(SimpleModel, { name: 'myName3' })).toBe(0);

  await database.remove(SimpleModel, instance1.id);

  expect(await database.count(SimpleModel)).toBe(1);
  expect(await database.count(SimpleModel, { name: 'myName1' })).toBe(0);
  expect(await database.count(SimpleModel, { name: 'myName2' })).toBe(1);
  expect(await database.count(SimpleModel, { name: 'myName3' })).toBe(0);

  await database.remove(SimpleModel, instance2.id);

  expect(await database.count(SimpleModel)).toBe(0);
  expect(await database.count(SimpleModel, { name: 'myName1' })).toBe(0);
  expect(await database.count(SimpleModel, { name: 'myName2' })).toBe(0);
  expect(await database.count(SimpleModel, { name: 'myName3' })).toBe(0);

  await database.add(SimpleModel, instance1);
  await database.add(SimpleModel, instance2);
  expect(await database.count(SimpleModel)).toBe(2);

  await database.deleteMany(SimpleModel, { name: /myName[0-9]/ });
  expect(await database.count(SimpleModel)).toBe(0);

  await database.add(SimpleModel, instance1);
  await database.add(SimpleModel, instance2);
  expect(await database.count(SimpleModel)).toBe(2);

  await database.deleteOne(SimpleModel, { name: /myName[0-9]/ });
  expect(await database.count(SimpleModel)).toBe(1);

  await database.deleteOne(SimpleModel, { name: /myName[0-9]/ });
  expect(await database.count(SimpleModel)).toBe(0);
});

test('test super simple model', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

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
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });

  await connection.db('testing2').dropDatabase();
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

  @Entity('DifferentDataBase', 'differentCollection')
  @DatabaseName('testing2')
  class DifferentDataBase {
    @ID()
    @MongoIdType()
    _id?: string;

    @StringType()
    name?: string;
  }

  const instance = plainToClass(DifferentDataBase, {
    name: 'myName',
  });

  expect(getDatabaseName(DifferentDataBase)).toBe('testing2');
  expect(getCollectionName(DifferentDataBase)).toBe('differentCollection');

  expect(instance._id).toBeUndefined();
  await database.add(DifferentDataBase, instance);
  expect(instance._id).not.toBeUndefined();

  const collection = connection
    .db('testing2')
    .collection('differentCollection');
  expect(await collection.countDocuments()).toBe(1);

  const items = await database.find(DifferentDataBase);
  expect(items[0]._id).toBe(instance._id);
  expect(items[0].name).toBe(instance.name);
});

test('no id', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

  @Entity('NoId')
  class NoId {
    @MongoIdType()
    _id?: string;

    @StringType()
    name?: string;
  }

  const instance = plainToClass(NoId, {
    name: 'myName',
  });

  await database.add(NoId, instance);
  expect(instance._id).toBeUndefined();

  const dbItem = await database.get(NoId, { name: 'myName' });
  expect(dbItem!.name).toBe('myName');

  dbItem!.name = 'Changed';

  await expect(database.update(NoId, dbItem)).rejects.toThrow(
    'Class NoId has no @ID() defined'
  );
});

test('test factory', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing2').dropDatabase();
  await connection.db('testing').dropDatabase();

  const database = new Database(async () => {
    return await MongoClient.connect('mongodb://localhost:27017', {
      useNewUrlParser: true,
    });
  }, 'testing');

  @Entity('DifferentDataBase', 'differentCollection')
  @DatabaseName('testing2')
  class DifferentDataBase {
    @ID()
    @MongoIdType()
    _id?: string;

    @StringType()
    name?: string;
  }

  const instance = plainToClass(DifferentDataBase, {
    name: 'myName',
  });

  expect(getDatabaseName(DifferentDataBase)).toBe('testing2');
  expect(getCollectionName(DifferentDataBase)).toBe('differentCollection');

  expect(instance._id).toBeUndefined();
  await database.add(DifferentDataBase, instance);
  expect(instance._id).not.toBeUndefined();

  const collection = connection
    .db('testing2')
    .collection('differentCollection');
  expect(await collection.countDocuments()).toBe(1);

  const items = await database.find(DifferentDataBase);
  expect(items[0]._id).toBe(instance._id);
  expect(items[0].name).toBe(instance.name);
});

test('second object id', async () => {
  connection = await MongoClient.connect('mongodb://localhost:27017', {
    useNewUrlParser: true,
  });
  await connection.db('testing').dropDatabase();
  const database = new Database(connection, 'testing');

  @Entity('SecondObjectId')
  class SecondObjectId {
    @ID()
    @MongoIdType()
    _id?: string;

    @StringType()
    name?: string;

    @BinaryType()
    preview: Buffer = new Buffer('FooBar', 'utf8');

    @MongoIdType()
    secondId?: string;
  }

  const instance = plainToClass(SecondObjectId, {
    name: 'myName',
    secondId: '5bf4a1ccce060e0b38864c9e',
    preview: 'QmFhcg==', //Baar
  });

  await database.add(SecondObjectId, instance);

  const dbItem = await database.get(SecondObjectId, { name: 'myName' });
  expect(dbItem!.name).toBe('myName');

  const dbItemBySecondId = await database.get(SecondObjectId, {
    secondId: '5bf4a1ccce060e0b38864c9e',
  });
  expect(dbItemBySecondId!.name).toBe('myName');

  const collection = connection
    .db('testing')
    .collection(getCollectionName(SecondObjectId));
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
