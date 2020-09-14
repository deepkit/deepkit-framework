import 'reflect-metadata';
import {bench} from '@deepkit/core';
import {Database} from '@deepkit/orm';
import {MongoDatabaseAdapter} from '../src/adapter';
import {Entity, f} from '@deepkit/type';

@Entity('user')
export class User {
    @f.mongoId.primary public _id?: string;

    @f ready?: boolean;

    @f.array(f.string) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

async function createDatabase(dbName: string = 'testing') {
    dbName = dbName.replace(/\s+/g, '-');
    return new Database(new MongoDatabaseAdapter('mongodb://localhost/' + dbName));
}

const items = 10_000;
(async () => {
    const database = await createDatabase('benchmark-a');
    database.registerEntity(User);
    await database.migrate();
    const session = database.createSession();

    for (let j = 1; j <= 15; j++) {
        console.log('round', j);
        session.identityMap.clear();
        await session.query(User).deleteMany();
        await bench(1, 'deepkit/type insert', async () => {
            for (let i = 1; i <= items; i++) {
                const user = new User(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        const query = session.query(User).disableIdentityMap();
        await bench(10, 'deepkit/type find', async () => {
            await query.find();
        });

        session.identityMap.clear();
        const dbItems = await session.query(User).find();
        for (const item of dbItems) {
            item.name = 'Angela';
            item.priority = Math.ceil(Math.random() * 1000);
        }

        // console.log('changed', buildChanges(dbItems[0]));
        // const converterPartial = createPartialXToXFunction(getClassSchema(User), 'class', 'mongo');
        // console.log('changed converted', converterPartial(buildChanges(dbItems[0])));
        await bench(1, 'deepkit/type update', async () => {
            await session.commit();
        });
    }

    database.disconnect();
})();
