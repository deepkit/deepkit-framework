import 'reflect-metadata';
import {Entity as MikroEntity, MikroORM, PrimaryKey, Property, ReflectMetadataProvider} from 'mikro-orm';
import {performance} from 'perf_hooks';

/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
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


@MikroEntity({collection: 'mikro'})
export class MikroModel {
    @PrimaryKey()
    _id!: any;

    @Property() id2!: number;

    @Property() ready?: boolean;

    @Property() tags: string[] = [];

    @Property() priority: number = 0;

    @Property()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}


(async () => {
    const count = 10_000;

    const orm = await MikroORM.init({
        entities: [MikroModel],
        dbName: 'bench-insert',
        type: 'mongo',
        metadataProvider: ReflectMetadataProvider,
        clientUrl: 'mongodb://localhost:27017'
    });

    for (let j = 1; j <= 15; j++) {
        console.log('round', j);
        await orm.em.nativeDelete(MikroModel, {});
        await bench(1, 'Mikro-ORM insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new MikroModel('Peter ' + i);
                user.id2 = i;
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                await orm.em.persist(user);
            }

            await orm.em.flush();
        });

        orm.em.clear();
        await bench(1, 'Mikro-ORM fetch', async () => {
            const items = await orm.em.find(MikroModel, {});
        });
    }
    await orm.close();
})();