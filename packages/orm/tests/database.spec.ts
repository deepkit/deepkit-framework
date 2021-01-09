import { expect, test } from '@jest/globals';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { Database } from '../src/database';
import { t, validate, plainToClass } from '@deepkit/type';

test('memory-db', async () => {
    function MinLength(minLength: number) {
        return (v: string) => {
            if (v.length < minLength) throw new Error(`Min length is ${minLength}`);
        };
    }

    const s = t.schema({
        id: t.number.primary,
        username: t.string.validator(MinLength(5))
    }, { name: 'User' });

    {
        const item = plainToClass(s, { id: 2, username: '123456' });
        expect(validate(s, item)).toEqual([]);
    }

    {
        const item = plainToClass(s, { id: 2, username: '1234' });
        expect(validate(s, item)).toEqual([{ code: 'error', message: 'Min length is 5', path: 'username' }]);
    }

    const database = new Database(new MemoryDatabaseAdapter());

    await database.persist(plainToClass(s, { id: 2, username: '123456' }));
    await expect(() => database.persist(plainToClass(s, { id: 2, username: '123' }))).rejects.toThrow('Validation error for class User:\nusername(error): Min length is 5');

    await database.persist(plainToClass(s, { id: 3, username: 'Peter' }));
    await database.persist(plainToClass(s, { id: 4, username: 'JohnLong' }));

    const item = await database.query(s).findOne();
    expect(item.id).toBe(2);
    expect(item.username).toBe('123456');

    await database.query(s).filter({ username: '123456' }).deleteOne();
    expect(await (await database.query(s).find()).length).toBe(2);

    await database.query(s).filter({ username: 'Peter' }).patchOne({ username: 'Peter2' });
    expect((await database.query(s).filter({ id: 3 }).findOne()).username).toBe('Peter2');

    await database.query(s).deleteMany();
    expect(await (await database.query(s).find()).length).toBe(0);
});
