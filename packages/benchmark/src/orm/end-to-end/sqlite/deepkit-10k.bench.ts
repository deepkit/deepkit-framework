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
import { AutoIncrement, PrimaryKey } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { BenchSuite } from '../../../bench';

// @entity.name('deepkit')
export class DeepkitModel {
    public id: number & PrimaryKey & AutoIncrement = 0;

    ready?: boolean;

    // @t.array(t.string) tags: string[] = [];

    priority: number = 0;

    constructor(public name: string) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
    database.registerEntity(DeepkitModel);
    await database.adapter.createTables(database.entityRegistry);
    const bench = new BenchSuite('deepkit');

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(DeepkitModel).deleteMany();

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new DeepkitModel('Peter ' + i);
                user.ready = true;
                user.priority = 5;
                // user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench.runAsyncFix(100, 'fetch', async () => {
            await database.query(DeepkitModel).disableChangeDetection().find();
        });

        await bench.runAsyncFix(100, 'fetch-1', async () => {
            await database.query(DeepkitModel).disableChangeDetection().findOne();
        });

        const dbItems = await session.query(DeepkitModel).find();
        for (const item of dbItems) {
            item.priority++;
        }

        await bench.runAsyncFix(1, 'update', async () => {
            await session.commit();
        });

        await bench.runAsyncFix(1, 'remove', async () => {
            for (const item of dbItems) {
                session.remove(item);
            }

            await session.commit();
        });
    }

    database.disconnect();
}
