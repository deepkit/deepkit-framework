import 'reflect-metadata';
import {Column, createConnection, Entity as TypeOrmEntity, ObjectIdColumn} from 'typeorm';
import {performance} from 'perf_hooks';

export async function bench(times: number, title: string, exec: () => void | Promise<void>) {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
        await exec();
    }
    const took = performance.now() - start;

    process.stdout.write([
        (1000 / took) * times, 'ops/s',
        title,
        took.toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms,',
        process.memoryUsage().rss / 1024 / 1024, 'MB memory'
    ].join(' ') + '\n');
}

@TypeOrmEntity()
export class TypeOrmModel {
    @ObjectIdColumn()
    id: any;

    @Column() ready?: boolean;

    @Column() tags: string[] = [];

    @Column() priority: number = 0;

    @Column()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

(async () => {
    const count = 10_000;

    const typeorm = await createConnection({
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'bench-insert',
        entities: [
            TypeOrmModel
        ]
    });

    for (let j = 1; j <= 15; j++) {
        console.log('round', j);
        await typeorm.manager.delete(TypeOrmModel, {});
        await bench(1, 'TypeORM insert', async () => {
            const items: any[] = [];
            for (let i = 1; i <= count; i++) {
                const user = new TypeOrmModel('Peter ' + i);
                user.id = i;
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                items.push(user);
            }

            await typeorm.manager.save(TypeOrmModel, items);
        });

        await bench(1, 'TypeORM fetch', async () => {
            const items = await typeorm.manager.find(TypeOrmModel);
        });
    }

    await typeorm.close();
})();