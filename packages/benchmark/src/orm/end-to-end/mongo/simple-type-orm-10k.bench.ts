/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import 'reflect-metadata';
import {BenchSuite} from '@deepkit/core';
import {Column, createConnection, Entity as TypeOrmEntity, ObjectIdColumn} from 'typeorm';

@TypeOrmEntity()
export class TypeOrmModel {
    @ObjectIdColumn()
    id!: any;

    @Column() ready?: boolean;

    @Column() tags: string[] = [];

    @Column() priority: number = 0;

    @Column()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export async function main() {
    const count = 10_000;
    const typeorm = await createConnection({
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'type-orm-bench',
        entities: [
            TypeOrmModel
        ]
    });

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        await typeorm.manager.delete(TypeOrmModel, {});
        const bench = new BenchSuite('type-orm');

        await bench.runAsyncFix(1, 'insert', async () => {
            const items: any[] = [];
            for (let i = 1; i <= count; i++) {
                const user = new TypeOrmModel('Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                items.push(user);
            }

            await typeorm.manager.save(TypeOrmModel, items);
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            const items = await typeorm.manager.find(TypeOrmModel);
        });

        // const dbItemst
    }

    await typeorm.close();
}
