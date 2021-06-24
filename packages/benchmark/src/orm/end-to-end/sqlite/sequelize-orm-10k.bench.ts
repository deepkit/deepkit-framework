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
import { DataTypes, Model, Sequelize } from 'sequelize';

const sequelize = new Sequelize('sqlite::memory:', {
    logging: false
});

class User extends Model {}
User.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: DataTypes.STRING,
    ready: DataTypes.BOOLEAN,
    priority: DataTypes.NUMBER
}, { sequelize, modelName: 'user' });

export async function main() {
    const count = 10_000;
    await sequelize.sync();

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        await User.truncate();
        // await typeorm.manager.delete(TypeOrmModel, {});
        const bench = new BenchSuite('sequelize');

        await bench.runAsyncFix(1, 'insert', async () => {
            const items: any[] = [];
            for (let i = 1; i <= count; i++) {
                items.push({
                    name: 'Peter ' + i,
                    ready: true,
                    priority: 5,
                })
            }
            await User.bulkCreate(items);
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await User.findAll();
        });

        await bench.runAsyncFix(10, 'fetch-1', async () => {
            await User.findOne();
        });
    }
    await sequelize.close();
}
