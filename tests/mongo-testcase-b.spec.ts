import 'jest';
import 'jest-extended';
import {createDatabase} from "./utils";
import {User} from "./testcase-b/user";

async function setupTestCase(name: string) {
    const database = await createDatabase(name);

    const marc = new User('marc', 'marcPassword');
    const peter = new User('peter', 'peterPassword');
    const marcel = new User('marcel');

    await database.persist(marc);
    await database.persist(peter);
    await database.persist(marcel);

    return {
        database, marc, peter, marcel,
    }
}

test('ids', async () => {
    const {
        database, marc, peter, marcel,
    } = await setupTestCase('ids');

    {
        const ids = await database.query(User).ids();
        expect(ids).toEqual([marc.id, peter.id, marcel.id]);
    }

    {
        const ids = await database.query(User).sort({name: 'asc'}).ids();
        expect(ids).toEqual([marc.id, marcel.id, peter.id]);
    }

    {
        const ids = await database.query(User).filter({name: {$regex: /^marc/}}).ids();
        expect(ids).toEqual([marc.id, marcel.id]);
    }

    {
        const ids = await database.query(User).joinWith('credentials').ids();
        expect(ids).toEqual([marc.id, peter.id, marcel.id]);
    }

    {
        const ids = await database.query(User).joinWith('credentials').filter({name: {$regex: /^marc/}}).ids();
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
