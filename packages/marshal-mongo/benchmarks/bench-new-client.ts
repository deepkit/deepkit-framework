import {MongoClient as OriMongoClient, MongoClientOptions} from 'mongodb';
import {MongoClient} from '../src/client/client';
import {bench} from '@super-hornet/core';
import {IsMasterCommand} from '../src/client/command/ismaster';
import {FindCommand} from '../src/client/command/find';
import {EmptyCommand} from '../src/client/command/empty';
import {Entity, f} from '@super-hornet/marshal';

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

    const mongoClient = await OriMongoClient.connect(`mongodb://127.0.0.1/benchmark-a`, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
    } as MongoClientOptions);

    const collection = mongoClient.db('benchmark-a').collection('user');

    const client = new MongoClient('mongodb://127.0.0.1/benchmark-a');
    await client.connect();

    await bench(2000, 'reference', async () => {
        await new Promise((resolve) => {
            resolve();
        });
    });

    await bench(10_000, 'EmptyCommand', async () => {
        const response = await client.execute(new EmptyCommand);
    });

    await bench(10_000, 'IsMasterCommand', async () => {
        const response = await client.execute(new IsMasterCommand);
    });

    await bench(10_000, 'ori Mongodb find 1', async () => {
        const item = await collection.find({}).limit(1).toArray();
    });

    await bench(10_000, 'FindCommand 1', async () => {
        const cmd = new FindCommand(User);
        cmd.limit = 1;
        const response = await client.execute(cmd);
    });

    await bench(10_000, 'ori Mongodb find 10', async () => {
        const item = await collection.find({}).limit(10).toArray();
    });

    await bench(10_000, 'FindCommand 10', async () => {
        const cmd = new FindCommand(User);
        cmd.limit = 10;
        const response = await client.execute(cmd);
    });

    {
        const items = await collection.find({}).toArray()
        if (items.length !== 10000) throw new Error(`Invalid, got ${items.length}`);
    }
    await bench(100, 'ori Mongodb find 10k', async () => {
        const item = await collection.find({}).batchSize(10001).toArray();
    });

    {
        const items = await client.execute(new FindCommand(User));
        if (items.length !== 10000) throw new Error(`Invalid, got ${items.length}`);
    }
    await bench(100, 'FindCommand 10k', async () => {
        const response = await client.execute(new FindCommand(User));
    });

    client.close();
    mongoClient.close();
}

main();