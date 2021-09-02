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
    await database.migrate();
    await database.adapter.client.connect();
    const bench = new BenchSuite('deepkit');

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        await database.query(Model).deleteMany();
        const users: Model[] = [];
        for (let i = 1; i <= count; i++) {
            const user = new Model(i, 'Peter ' + i);
            user.ready = true;
            user.priority = 5;
            users.push(user);
        }

        await bench.runAsyncFix(1, 'insert', async () => {
            await database.persist(...users);
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await database.query(Model).disableChangeDetection().find();
        });

        await bench.runAsyncFix(1000, 'fetch-1', async () => {
            await database.query(Model).disableChangeDetection().findOne();
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
