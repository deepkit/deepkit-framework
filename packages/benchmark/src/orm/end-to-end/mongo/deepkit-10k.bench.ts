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
import { Entity, t } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { MongoDatabaseAdapter } from '@deepkit/mongo';
import { BenchSuite } from '../../../bench';

@Entity('deepkit')
export class Model {
    @t.mongoId.primary public _id?: string;
    @t ready?: boolean;

    @t.array(t.string) tags: string[] = [];

    @t priority: number = 0;

    constructor(
        @t public id: number,
        @t public name: string
    ) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/bench-small-deepkit'));
    await database.adapter.client.connect();

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(Model).deleteMany();
        const bench = new BenchSuite('deepkit');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new Model(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await session.query(Model).disableIdentityMap().find();
        });

        await bench.runAsyncFix(1000, 'fetch-1', async () => {
            await session.query(Model).disableIdentityMap().findOne();
        });

        // const dbItems = await session.query(Model).find();
        // for (const item of dbItems) {
        //     item.priority++;
        // }
        //
        // await bench.runAsyncFix(1, 'update', async () => {
        //     await session.commit();
        // });

        await bench.runAsyncFix(1, 'update-query', async () => {
            await database.query(Model).disableIdentityMap().patchMany({ $inc: { priority: 1 } });
        });

        // await bench.runAsyncFix(1, 'remove', async () => {
        //     for (const item of dbItems) {
        //         session.remove(item);
        //     }
        //
        //     await session.commit();
        // });

        await bench.runAsyncFix(1, 'remove-query', async () => {
            await database.query(Model).deleteMany();
        });
    }

    database.disconnect();
}
