import { test } from '@jest/globals';
import { AutoIncrement, PrimaryKey } from '@deepkit/type';
import { databaseFactory } from './factory.js';

export class DeepkitModel {
    public id: number & PrimaryKey & AutoIncrement = 0;

    ready?: boolean;

    // @t.array(t.string) tags: string[] = [];

    priority: number = 0;

    constructor(public name: string) {
    }
}

async function bench(title: string, cb: () => Promise<void>) {
    const start = Date.now();
    const count = 100;

    for (let i = 0; i < count; i++) {
        await cb();
    }

    const took = Date.now() - start;
    const perSecond = count / (took / 1000);
    console.log(title, 'count', count.toLocaleString(), took, 'ms,', 'avg', took / count, 'ms,', 'per second', perSecond.toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

test('bench', async () => {
    const database = await databaseFactory([DeepkitModel]);

    const count = 10_000;
    const session = database.createSession();
    await session.query(DeepkitModel).deleteMany();

    for (let i = 1; i <= count; i++) {
        const user = new DeepkitModel('Peter ' + i);
        user.ready = true;
        user.priority = 5;
        // user.tags = ['a', 'b', 'c'];
        session.add(user);
    }

    await session.commit();

    await bench('fetch', async () => {
        await database.query(DeepkitModel).disableChangeDetection().find();
    });

    await bench('fetch-1', async () => {
        await database.query(DeepkitModel).disableChangeDetection().findOne();
    });

    let statement: any;
    let formatter: any;
    // await bench('fetch select', async () => {
    //     const query = database.select<DeepkitModel>(m => {
    //     });
    //     const sql = emitSql(database.adapter, query.model);
    //     if (!statement) {
    //         const connection = await database.adapter.connectionPool.getConnection();
    //         statement = await connection.prepare(sql.sql);
    //     }
    //     formatter ||= new Formatter(
    //         query.classSchema,
    //         database.adapter.platform.serializer,
    //         session.getHydrator(),
    //         undefined,
    //     );
    //     const rows = await statement.all(sql.params);
    //     const objects = rows.map(row => (formatter as any).deserialize(row));
    //
    //     // statement.release();
    //     // connection.release();
    // });
});
