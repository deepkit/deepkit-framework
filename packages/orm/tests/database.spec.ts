import { expect, test } from '@jest/globals';

import { PrimaryKey, ValidatorError, deserialize, entity, t, validate } from '@deepkit/type';

import { Database } from '../src/database.js';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';
import { DatabaseValidationError } from '../src/type.js';

test('memory-db', async () => {
    function MinLength(minLength: number) {
        return (v: string): ValidatorError | void => {
            if (v.length < minLength) return new ValidatorError('length', `Min length is ${minLength}`);
        };
    }

    @entity.name('User')
    class s {
        id: number & PrimaryKey = 0;
        @t.validate(MinLength(5))
        username!: string;
    }

    {
        const item = deserialize<s>({ id: 2, username: '123456' });
        expect(validate<s>(item)).toEqual([]);
    }

    {
        const item = deserialize<s>({ id: 2, username: '1234' });
        expect(validate<s>(item)).toEqual([{ code: 'length', message: 'Min length is 5', path: 'username', value: '1234' }]);
    }

    const database = new Database(new MemoryDatabaseAdapter());

    await database.persist(deserialize<s>({ id: 2, username: '123456' }));
    await expect(() => database.persist(deserialize<s>({ id: 2, username: '123' }))).rejects.toThrow('Validation error for class User:\nusername(length): Min length is 5');

    // Verify error code for DatabaseValidationError
    try {
        await database.persist(deserialize<s>({ id: 5, username: '123' }));
    } catch (error: any) {
        expect(error).toBeInstanceOf(DatabaseValidationError);
        expect(error.code).toBe('DK-O020'); // DatabaseValidationError error code
    }

    await database.persist(deserialize<s>({ id: 3, username: 'Peter' }));
    await database.persist(deserialize<s>({ id: 4, username: 'JohnLong' }));

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

test('persistAs', async () => {
    interface X {
        id: number & PrimaryKey;
        name: string;
    }

    interface Y {
        id: number & PrimaryKey;
        name: string;
    }

    const database = new Database(new MemoryDatabaseAdapter());
    database.register<X>({ name: 'x' });
    database.register<Y>({ name: 'y' });

    await database.persistAs<X>([
        { id: 1, name: 'Peter' },
        { id: 2, name: 'Peter2' },
    ]);
    await database.persistAs<X>([{ id: 3, name: 'Peter3' }]);
    await database.persistAs<Y>([{ id: 1, name: 'John' }]);

    expect(await database.query<X>().count()).toBe(3);
    expect(await database.query<Y>().count()).toBe(1);

    await database.removeAs<X>([{ id: 1, name: 'Peter' }]);
    expect(await database.query<X>().count()).toBe(2);

    await database.removeAs<Y>([{ id: 1, name: 'John' }]);
    expect(await database.query<Y>().count()).toBe(0);
});

test('count with pagination returns total count (#668)', async () => {
    // GitHub issue #668: query.count() throws error if used with query pagination for page > 1
    // count() should return the total number of matching rows, ignoring limit/skip
    interface Item {
        id: number & PrimaryKey;
        name: string;
    }

    const database = new Database(new MemoryDatabaseAdapter());
    database.register<Item>({ name: 'item' });

    // Insert 25 items
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
    await database.persistAs<Item>(items);

    // Test 1: count without pagination returns total
    expect(await database.query<Item>().count()).toBe(25);

    // Test 2: count with pagination still returns total (this was the bug)
    const query = database.query<Item>().itemsPerPage(10).page(1);
    const [page1Items, total1] = await Promise.all([query.find(), query.count()]);
    expect(page1Items.length).toBe(10);
    expect(total1).toBe(25); // count should return total, not paginated count

    // Test 3: page 2 - this is where the bug manifested (page > 1)
    const query2 = database.query<Item>().itemsPerPage(10).page(2);
    const [page2Items, total2] = await Promise.all([query2.find(), query2.count()]);
    expect(page2Items.length).toBe(10);
    expect(total2).toBe(25); // count should still return total

    // Test 4: page 3 (last page with only 5 items)
    const query3 = database.query<Item>().itemsPerPage(10).page(3);
    const [page3Items, total3] = await Promise.all([query3.find(), query3.count()]);
    expect(page3Items.length).toBe(5);
    expect(total3).toBe(25); // count should still return total

    // Test 5: page beyond data (page 4 should return 0 items but count should still be 25)
    const query4 = database.query<Item>().itemsPerPage(10).page(4);
    const [page4Items, total4] = await Promise.all([query4.find(), query4.count()]);
    expect(page4Items.length).toBe(0);
    expect(total4).toBe(25); // count should return total even when page is empty

    // Test 6: limit/skip directly
    const queryWithSkip = database.query<Item>().skip(20).limit(10);
    const [skippedItems, totalSkipped] = await Promise.all([queryWithSkip.find(), queryWithSkip.count()]);
    expect(skippedItems.length).toBe(5); // only 5 items left after skip 20
    expect(totalSkipped).toBe(25); // count ignores skip/limit

    // Test 7: count with filter and pagination
    // Filter items with id <= 15 (15 items), then paginate
    const filteredQuery = database
        .query<Item>()
        .filter({ id: { $lte: 15 } })
        .itemsPerPage(5)
        .page(2);
    const [filteredItems, filteredCount] = await Promise.all([filteredQuery.find(), filteredQuery.count()]);
    expect(filteredItems.length).toBe(5); // page 2 of 15 items with 5 per page
    expect(filteredCount).toBe(15); // total matching items, ignoring pagination
});
