import {MongoClient as OriMongoClient} from 'mongodb';
import {bench} from '@deepkit/core';
import {Entity, f} from '@deepkit/marshal';
import {MongoClient} from '../src/client/client';
import {DeleteCommand} from '../src/client/command/delete';
import {InsertCommand} from '../src/client/command/insert';
import {FindCommand} from '../src/client/command/find';

@Entity('user')
export class User {
    @f.mongoId.primary public _id?: string;

    @f ready?: boolean;

    @f.array(f.string) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

async function main() {
    await bench(10000, 'reference', async () => {
    });

    const items: User[] = [];
    const count = 10_000;
    for (let i = 1; i <= count; i++) {
        const user = new User(i, 'Peter ' + i);
        user.ready = true;
        user.priority = 5;
        user.tags = ['a', 'b', 'c'];
        items.push(user);
    }

    const oriMongoClient = await OriMongoClient.connect(`mongodb://127.0.0.1/benchmark-a`, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
    });

    const collection = oriMongoClient.db('benchmark-a').collection('user');
    await collection.deleteMany({});
    const client = new MongoClient('mongodb://127.0.0.1/benchmark-a');

    await collection.deleteMany({});
    await bench(1, 'native mongodb insert 10k', async () => {
        await collection.insertMany(items);
    });

    await collection.deleteMany({});
    for (const item of items) {
        item._id = undefined;
    }

    await client.execute(new DeleteCommand(User, {}));
    await bench(1, 'connection2 insert 10k', async () => {
        await client.execute(new InsertCommand(User, items));
    });

    const dbItems = await client.execute(new FindCommand(User, {}));
    console.log('dbItems', dbItems.length);
    if (dbItems.length !== count) throw new Error(`Wrong db items count. got ${dbItems.length}, but expected ${count}`);

    await bench(10, 'native mongodb 10k items', async () => {
        const items = await collection.find({}).batchSize(1000).toArray();
    });

    await bench(10, 'connection2 find 10k items', async () => {
        await client.execute(new FindCommand(User, {}));
    });

    await bench(3_000, 'native mongodb 1 item', async () => {
        const item = await collection.find({}).limit(1).toArray();
    });

    await bench(10_000, 'connection2 find 1 item', async () => {
        await client.execute(new FindCommand(User, {}, undefined, undefined, 1));
    });

    client.close();
    await oriMongoClient.close();
}

main();