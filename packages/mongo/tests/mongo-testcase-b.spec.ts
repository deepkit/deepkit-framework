import 'jest-extended';
import 'reflect-metadata';
import {User} from "./testcase-b/user";
import {createDatabaseSession} from "./utils";

async function setupTestCase(name: string) {
    const session = await createDatabaseSession(name);

    const marc = new User('marc', 'marcPassword');
    const peter = new User('peter', 'peterPassword');
    const marcel = new User('marcel');

    await session.immediate.persist(marc.credentials);
    await session.immediate.persist(peter.credentials);
    await session.immediate.persist(marcel.credentials);

    await session.immediate.persist(marc);
    await session.immediate.persist(peter);
    await session.immediate.persist(marcel);

    return {
        database: session, marc, peter, marcel,
    }
}

test('ids', async () => {
    const {
        database, marc, peter, marcel,
    } = await setupTestCase('ids');

    {
        const ids = await database.query(User).ids(true);
        expect(ids).toEqual([marc.id, peter.id, marcel.id]);
    }

    {
        const ids = await database.query(User).ids();
        expect(ids).toEqual([{id: marc.id}, {id: peter.id}, {id: marcel.id}]);
    }

    {
        const ids = await database.query(User).sort({name: 'asc'}).ids(true);
        expect(ids).toEqual([marc.id, marcel.id, peter.id]);
    }

    {
        const ids = await database.query(User).filter({name: {$regex: /^marc/}}).ids(true);
        expect(ids).toEqual([marc.id, marcel.id]);
    }

    {
        const ids = await database.query(User).joinWith('credentials').ids(true);
        expect(ids).toEqual([marc.id, peter.id, marcel.id]);
    }

    {
        const ids = await database.query(User).joinWith('credentials').filter({name: {$regex: /^marc/}}).ids(true);
        expect(ids).toEqual([marc.id, marcel.id]);
    }
});

test('one-to-one', async () => {
    const {
        database, marc, peter, marcel,
    } = await setupTestCase('one-to-one');

    {
        const item = await database.query(User).joinWith('credentials').filter({name: 'marc'}).findOne();
        expect(item.credentials.password).toBe('marcPassword')
    }

    {
        const item = await database.query(User).joinWith('credentials').filter({name: 'marcel'}).findOne();
        expect(item.credentials.password).toBe('')
    }
});
