import 'jest-extended'
import 'reflect-metadata';
import {
    Database, getCollectionName,
    plainToClass, uuid4Stringify,
} from "../";
import {SimpleModel, SubModel} from "./entities";
import {Binary, MongoClient} from "mongodb";

test('test save model', async () => {
    const connection = await MongoClient.connect('mongodb://localhost:27017', {useNewUrlParser: true});
    await connection.db('testing').dropDatabase();
    const database = new Database(connection, 'testing');

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
    });

    await database.save(SimpleModel, instance);

    const collection = connection.db('testing').collection(getCollectionName(SimpleModel));
    const mongoItem = await collection.find().toArray();
    expect(mongoItem).toBeArrayOfSize(1);
    expect(mongoItem[0].name).toBe('myName');
    expect(mongoItem[0].id).toBeInstanceOf(Binary);
    expect(uuid4Stringify(mongoItem[0].id)).toBe(instance.id);

    const found = await database.get(SimpleModel, {id: instance.id});
    expect(found).toBeInstanceOf(SimpleModel);
    expect(found.name).toBe('myName');
    expect(found.id).toBe(instance.id);

    const list = await database.find(SimpleModel, {id: instance.id});
    expect(list[0]).toBeInstanceOf(SimpleModel);
    expect(list[0].name).toBe('myName');
    expect(list[0].id).toBe(instance.id);

    const listAll = await database.find(SimpleModel);
    expect(listAll[0]).toBeInstanceOf(SimpleModel);
    expect(listAll[0].name).toBe('myName');
    expect(listAll[0].id).toBe(instance.id);

    await database.patch(SimpleModel, {id: instance.id}, {name: 'myName2'});

    {
        const found = await database.get(SimpleModel, {id: instance.id});
        expect(found).toBeInstanceOf(SimpleModel);
        expect(found.name).toBe('myName2');
    }
});