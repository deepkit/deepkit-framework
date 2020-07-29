import {BenchSuite} from '@super-hornet/core';
import {createDatabaseSession} from './mongo.spec';
import {Entity, f} from '@super-hornet/marshal';

@Entity('book')
export class Book {
    @f.primary.mongoId
    _id!: string;

    @f.array(f.any)
    metaArray?: any[];

    @f.array(f.string)
    metaArrayOfStrings?: string[];

    constructor(@f public title: string) {
    }
}

test('benchmark', async () => {
    const items = 10_000;
    const suite = new BenchSuite(`persist, ${items} items`, 1, false);

    const database = await createDatabaseSession('benchmark-a');

    suite.addAsync('Marshal insert', async () => {
        for (let i = 1; i <= items; i++) {
            database.add(new Book('My Life on The Wall, part ' + i));
        }

        await database.commit();
    });

    const query = database.query(Book);
    suite.addAsync('Marshal find', async () => {
        const start = performance.now();
        const books = await query.find();
        console.log(`${books.length} books loaded in`, performance.now() - start);
    });

    await suite.runAsync();
});
