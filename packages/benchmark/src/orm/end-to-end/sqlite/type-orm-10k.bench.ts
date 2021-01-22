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
import { Column, createConnection, Entity as TypeOrmEntity, ObjectIdColumn, PrimaryGeneratedColumn } from 'typeorm';
import { BenchSuite } from '../../../bench';

@TypeOrmEntity()
export class TypeOrmModel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column() ready?: boolean;

    // @Column() tags: string[] = [];

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
        type: 'sqlite',
        database: ':memory:',
        entities: [
            TypeOrmModel
        ],
        synchronize: true,
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
                // user.tags = ['a', 'b', 'c'];
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
