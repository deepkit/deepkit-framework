import 'jest-extended';
import 'reflect-metadata';
import {classToPlain, f, getClassSchema, Patcher, plainToClass} from "@super-hornet/marshal";
import {bench} from "./util";

test('for vs map', () => {
    const items = 'aasf asdkfn asnfo asnfoiasfn oaisdf asdoifnsadf adsufhasduf hasdoufh asdoufh asufhasdu fas'.split(' ');
    const count = 100_000;

    function toUpper(item: string) {
        return item.toUpperCase();
    }

    bench(count, 'map', (i) => {
        const result: string[] = items.map(v => toUpper(v));
        return result;
    });

    bench(count, 'for', (i) => {
        const result: string[] = [];
        for (const item of items) {
            result.push(toUpper(item));
        }
        return result;
    });
});

test('weakMap vs Object.defineProperty', () => {
    class User {
        constructor(public id: string) {
        }
    }

    const count = 10_000;
    const items: User[] = [];
    for (let i = 0; i < 1000; i++) {
        items.push(new User(String(i)));
    }

    const weakMap = new WeakMap();

    bench(count, 'weakMap set', (i) => {
        for (const item of items) {
            weakMap.set(item, {myAdditionalData: item.id});
        }
    });

    bench(count, 'weakMap get', (i) => {
        for (const item of items) {
            if (weakMap.get(item)!.myAdditionalData !== item.id) throw new Error('Moep');
        }
    });

    Object.defineProperty(User.prototype, '__myData', {writable: true, enumerable: false, value: {}});

    bench(count, 'defineProperty set', (i) => {
        for (const item of items) {
            (item as any).__myData = {myAdditionalData: item.id};
        }
    });

    bench(count, 'defineProperty get', (i) => {
        for (const item of items) {
            if ((item as any).__myData.myAdditionalData !== item.id) throw new Error('Moep');
        }
    });
});

test('set known prop in prototype vs unknown prop vs weakmap', () => {
    class User {
        constructor(public id: number) {
        }
    }

    const count = 100_000;

    bench(count, 'set new', (i) => {
        const item = new User(i);
        (item as any).bla = i;
    });

    bench(count, 'get new', (i) => {
        const item = new User(i);
        const n = (item as any).bla;
    });

    {
        class Item {
        }

        expect(Item.prototype.hasOwnProperty('bla')).toBe(false);
        Object.defineProperty(Item.prototype, 'bla', {writable: true, enumerable: false});
        expect(Item.prototype.hasOwnProperty('bla')).toBe(true);
        const item = new Item;
        expect((item as any).bla).toBe(undefined);
        (item as any).bla = 2;
        expect((item as any).bla).toBe(2);
        const item2 = new Item;
        expect((item2 as any).bla).toBe(undefined);
    }

    bench(count, 'set predefined', (i) => {
        const item = new User(i);
        if (!(item as any)['constructor'].prototype.hasOwnProperty('bla')) {
            Object.defineProperty(Object.getPrototypeOf(item), 'bla', {writable: true, enumerable: false});
        }
        (item as any).bla = i;
    });

    const symbol = Symbol('bla');

    bench(count, 'set predefined symbol', (i) => {
        const item = new User(i);
        if (!(item as any)['constructor'].prototype.hasOwnProperty(symbol)) {
            Object.defineProperty(Object.getPrototypeOf(item), symbol, {writable: true, enumerable: false});
        }
        (item as any)[symbol] = i;
    });

    bench(count, 'get predefined', (i) => {
        const item = new User(i);
        (item as any).bla = i;
        const n = (item as any).bla;
    });

    const map = new WeakMap();
    bench(count, 'set map', (i) => {
        const item = new User(i);
        map.set(item, i);
    });

    bench(count, 'get map', (i) => {
        const item = new User(i);
        map.set(item, i);
        const n = map.get(item);
    });
});

test('cache', () => {
    const count = 1_000_000;

    const cache: any = {};
    bench(count, 'object write', (i) => {
        cache[i] = {i: i};
    });

    bench(count, 'object read', (i) => {
        const n = cache[i];
    });

    bench(count, 'object hasOwnProperty', (i) => {
        if (cache.hasOwnProperty(i)) {
            const n = cache[i];
        }
    });

    const map = new Map();
    bench(count, 'map write', (i) => {
        map.set(i, {i : i});
    });
    bench(count, 'map read', (i) => {
        const n = map.get(i);
    });

});

test('classToPlain vs copy-on-write hooks', () => {
    class MarshalModel {
        @f ready?: boolean;

        @f.array(String) tags: string[] = [];

        @f priority: number = 0;

        constructor(
            @f public id: number,
            @f public name: string
        ) {
        }
    }

    const classSchema = getClassSchema(MarshalModel);

    const count = 10_000;
    bench(count, 'classToPlain', (i) => {
        const item = plainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
        classToPlain(MarshalModel, item);
    });

    bench(count, 'proxy', (i) => {
        const item = plainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
        const patcher = new Patcher(item);
    });

    const properties: PropertyDescriptorMap = {};
    for (const property of classSchema.getClassProperties().values()) {
        properties[property.name] = {
            get() {

            },
            set() {

            }
        }
    }

    bench(count, 'defineProperty', (i) => {
        const item = plainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });

        Object.defineProperties(item, properties);
    });
});
