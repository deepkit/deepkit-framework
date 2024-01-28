import { DatabaseFactory } from './test.js';
import { cast, entity, PrimaryKey } from '@deepkit/type';
import { expect } from '@jest/globals';

export const aggregateTest = {
    async basics(databaseFactory: DatabaseFactory) {
        @entity.name('aggregate_product')
        class Product {
            id!: number & PrimaryKey;
            category!: string;
            title!: string;
            price!: number;
            rating: number = 0;
        }

        const database = await databaseFactory([Product]);
        await database.migrate();

        await database.persist(
            cast<Product>({ id: 1, category: 'toys', title: 'Baer', price: 999, rating: 0 }),
            cast<Product>({ id: 2, category: 'toys', title: 'Car', price: 499, rating: 0 }),
            cast<Product>({ id: 3, category: 'planets', title: 'Mars', price: 45549, rating: 0 }),
        );

        const query = database.query(Product);

        expect(await query.withSum('price').find()).toEqual([{ price: 999 + 499 + 45549 }]);
        expect(await query.groupBy('category').withCount('id', 'amount').orderBy('category').find()).toEqual([{ category: 'planets', amount: 1 }, { category: 'toys', amount: 2 }]);
        expect(await query.groupBy('category').withSum('price').orderBy('category').find()).toEqual([{ category: 'planets', price: 45549 }, {
            category: 'toys',
            price: 999 + 499
        }]);

        expect(await query.filter({ category: 'toys' }).groupBy('category').withSum('price').find()).toEqual([{ category: 'toys', price: 999 + 499 }]);
        expect(await query.groupBy('category').withSum('price').orderBy('category').filter({ price: { $lt: 2000 } }).find()).toEqual([{ category: 'toys', price: 999 + 499 }]);

        expect(await query.groupBy('category').withSum('price').orderBy('category').find()).toEqual([{ category: 'planets', price: 45549 }, {
            category: 'toys',
            price: 999 + 499
        }]);

        expect(await query.groupBy('category').withMin('price').orderBy('category').find()).toEqual([{ category: 'planets', price: 45549 }, { category: 'toys', price: 499 }]);
        expect(await query.groupBy('category').withMax('price').orderBy('category').find()).toEqual([{ category: 'planets', price: 45549 }, { category: 'toys', price: 999 }]);
        expect(await query.groupBy('category').withAverage('price').orderBy('category').find()).toEqual([{ category: 'planets', price: 45549 }, {
            category: 'toys',
            price: (999 + 499) / 2
        }]);

        const groupConcat = await query.groupBy('category').withGroupConcat('price').orderBy('category').find();

        if (database.adapter.getName() === 'sqlite') {
            expect(groupConcat).toEqual([{ category: 'planets', price: '45549.0' }, { category: 'toys', price: '999.0,499.0' }]);
        } else if (database.adapter.getName() === 'mongo') {
            expect(groupConcat).toEqual([{ category: 'planets', price: [45549] }, { category: 'toys', price: [999.0, 499.0] }]);
        } else {
            expect(groupConcat).toEqual([{ category: 'planets', price: '45549' }, { category: 'toys', price: '999,499' }]);
        }

        database.disconnect();
    },

};
