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
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import {BenchSuite} from '../../../bench';

const prisma = new PrismaClient();

export async function main() {
    const count = 10_000;

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const bench = new BenchSuite('prisma');
        await prisma.model.deleteMany({});

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                await prisma.model.create({
                    data: {
                        username: 'Peter ' + i,
                        tags: 'a,b,c',
                        priority: 5,
                        ready: true,
                    }
                });
            }
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            const users = await prisma.model.findMany();
        });

        // const dbItems = await session.query(DeepkitModel).find();
        // for (const item of dbItems) {
        //     item.priority++;
        // }
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

    prisma.$disconnect();
}
