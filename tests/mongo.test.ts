import 'jest-extended'
import 'reflect-metadata';
import {
    Database, getCollectionName,
    plainToClass,
} from "../";
import {SimpleModel, SubModel} from "./entities";
import {MongoClient} from "mongodb";

test('test save model', async () => {
    const connection = await MongoClient.connect('mongodb://localhost:27017', {useNewUrlParser: true});
    await connection.db('testing').dropDatabase();
    const database = new Database(connection, 'testing');

    const instance = plainToClass(SimpleModel, {
        id: 'my-super-id',
        name: 'myName',
    });

    await database.save(SimpleModel, instance);

    const collection = connection.db('testing').collection(getCollectionName(SimpleModel));
    const items = await collection.find().toArray();
    expect(items).toBeArrayOfSize(1);
    expect(items[0].name).toBe('myName');
    expect(items[0].id).toBe('my-super-id');

    const found = await database.get(SimpleModel, {id: 'my-super-id'});
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found.name).toBe('myName');
    expect(found.id).toBe('my-super-id');

    const list = await database.find(SimpleModel, {id: 'my-super-id'});
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe('my-super-id');

    const listAll = await database.find(SimpleModel);
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe('my-super-id');

    await database.patch(SimpleModel, {id: 'my-super-id'}, {name: 'myName2'});

    {
        const found = await database.get(SimpleModel, {id: 'my-super-id'});
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found.name).toBe('myName2');
    }
});