/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { PrimaryKey, entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { MySQLDatabaseAdapter } from '@deepkit/mysql';
import { BenchSuite } from '../../../bench.js';

@entity.name('deepkit')
export class DeepkitModel {
    public id: number & PrimaryKey = 0;

    ready?: boolean;

    // @t.array(t.string) tags: string[] = [];

    priority: number = 0;

    constructor(
        public name: string
    ) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default' }));
    database.registerEntity(DeepkitModel);
    await database.adapter.createTables(database.entityRegistry);
    const bench = new BenchSuite('deepkit');

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        await database.query(DeepkitModel).deleteMany();

        const users: DeepkitModel[] = [];
        for (let i = 1; i <= count; i++) {
            const user = new DeepkitModel('Peter ' + i);
            user.id = i;
            user.ready = true;
            user.priority = 5;
            // user.tags = ['a', 'b', 'c'];
            users.push(user);
        }

        await bench.runAsyncFix(1, 'insert', async () => {
            await database.persist(...users);
        });

        const items = await database.query(DeepkitModel).disableChangeDetection().find();
        if (items.length !== count) throw new Error('Wrong result count');

        await bench.runAsyncFix(100, 'fetch', async () => {
            await database.query(DeepkitModel).disableChangeDetection().find();
        });

        await bench.runAsyncFix(1000, 'fetch-1', async () => {
            await database.query(DeepkitModel).disableChangeDetection().findOne();
        });

        // const dbItems = await session.query(DeepkitModel).find();
        // for (const item of dbItems) {
        //     item.priority++;
        // }
        // atomicChange(dbItems[0]).increase('priority', 2);
        //
        // await bench.runAsyncFix(1, 'update', async () => {
        //     await session.commit();
        // });
        //
        // await bench.runAsyncFix(1, 'remove', async () => {
        //     for (const item of dbItems) {
        //         session.remove(item);
        //     }
        //
        //     await session.commit();
        // });
    }

    database.disconnect();
}
