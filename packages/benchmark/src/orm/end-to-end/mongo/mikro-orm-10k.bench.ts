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
import { Entity as MikroEntity, MikroORM, PrimaryKey, Property, ReflectMetadataProvider } from 'mikro-orm';
import { BenchSuite } from '../../../bench';

@MikroEntity({ collection: 'mikro' })
export class MikroModel {
    @PrimaryKey()
    _id!: any;

    @Property() ready?: boolean;

    @Property() tags: string[] = [];

    @Property() priority: number = 0;

    @Property()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export async function main() {
    const count = 10_000;
    const orm = await MikroORM.init({
        entities: [MikroModel],
        dbName: 'mikro-orm-bench',
        type: 'mongo',
        metadataProvider: ReflectMetadataProvider,
        clientUrl: 'mongodb://localhost:27017'
    });

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        await orm.em.nativeDelete(MikroModel, {});
        const bench = new BenchSuite('mikro-orm');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MikroModel('Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                orm.em.persist(user);
            }

            await orm.em.flush();
        });

        await bench.runAsyncFix(10, 'fetch-1', async () => {
            orm.em.clear();
            await orm.em.findOne(MikroModel, {id: {$gt: 0}});
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            orm.em.clear();
            await orm.em.find(MikroModel, {});
        });

        const dbItems = await orm.em.find(MikroModel, {});
        for (const item of dbItems) {
            item.priority++;
        }

        await bench.runAsyncFix(1, 'update', async () => {
            await orm.em.flush();
        });

        await bench.runAsyncFix(1, 'remove', async () => {
            // we need to get around sqlite limitations of max 999 vars in the query
            let i = 0;
            while (i + 999 < dbItems.length) {
                dbItems.slice(i, i + 999).forEach(i => orm.em.remove(i));
                await orm.em.flush();
                i += 999;
            }
        });
    }

    await orm.close();
}
