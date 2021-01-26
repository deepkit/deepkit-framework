/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import { BenchSuite } from '../../../bench';
import {MongoClient} from 'mongodb';


export async function main() {
    const count = 10_000;
    const client = await MongoClient.connect('mongodb://localhost/bench-small-mongo');
    const db = client.db('bench-small-mongo');
    const collection = db.collection('model');

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const bench = new BenchSuite('mongoose');
        await collection.deleteMany({});

        const items: any[] = [];
        for (let i = 1; i <= count; i++) {
            items.push({
                id: i, name: 'Peter ' + i,
                ready: true, priority: 1,
                tags: ['a', 'b', 'c']
            })
        }

        await bench.runAsyncFix(1, 'insert', async () => {
            await collection.insertMany(items);
        });

        await bench.runAsyncFix(10, 'fetch-1', async () => {
            await collection.findOne({});
        });
        
        await bench.runAsyncFix(10, 'fetch', async () => {
            await collection.find({}).toArray();
        });

        await bench.runAsyncFix(1, 'update-query', async () => {
            await collection.updateMany({}, { $inc: { priority: 1 } });
        });

        await bench.runAsyncFix(1, 'remove-query', async () => {
            await collection.deleteMany({});
        });
    }

    client.close();
}
