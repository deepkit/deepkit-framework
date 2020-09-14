import 'reflect-metadata';
import {BenchSuite} from '@deepkit/core';

import {PrismaClient} from '@prisma/client';

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
