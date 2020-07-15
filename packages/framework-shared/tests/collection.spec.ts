import 'jest-extended';
import 'reflect-metadata';
import {Collection} from '../src/collection';
import {uuid} from '@super-hornet/marshal';

test('collection basic', () => {
    class Item {
        id: string = uuid();
        version: number = 0;

        constructor(public readonly name: string) {}
    }


    const collection = new Collection(Item);
    const item1 = new Item('Item 1');
    const item2 = new Item('Item 2');
    const item3 = new Item('Item 3');

    collection.set([item1, item2]);
    expect(collection.count()).toBe(2);
    expect(collection.has(item1.id)).toBe(true);
    expect(collection.has(item2.id)).toBe(true);
    expect(collection.get(item2.id)).toBe(item2);
    expect(collection.has(item3.id)).toBe(false);

    collection.add(item3);
    expect(collection.has(item3.id)).toBe(true);
    expect(collection.index(item3)).toBe(2);
    expect(collection.count()).toBe(3);
    expect(collection.getPageOf(item1, 2)).toBe(0);
    expect(collection.getPageOf(item2, 2)).toBe(0);
    expect(collection.getPageOf(item3, 2)).toBe(1);

    //adding same id just replace it
    collection.add(item3);
    expect(collection.has(item3.id)).toBe(true);
    expect(collection.index(item3)).toBe(2);
    expect(collection.count()).toBe(3);
    expect(collection.getPageOf(item3, 2)).toBe(1);

    const map = collection.map();
    expect(map[item3.id]).toBe(item3);

    expect(collection.ids()).toEqual([
        item1.id, item2.id, item3.id
    ]);

    expect(collection.empty()).toBe(false);
    collection.reset();
    expect(collection.count()).toBe(0);
    expect(collection.empty()).toBe(true);
});
