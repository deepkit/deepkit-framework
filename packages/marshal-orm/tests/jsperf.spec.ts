import 'jest-extended';
import 'reflect-metadata';
import {f, getClassSchema, Patcher, plainSerializer} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';

test.only('nope');

test('object keys', () => {
    const bench = new BenchSuite('object keys');

    const bla = {
        a: 'ter',
        username: 'peter',
        groups: 'asd',
        asdasd: 23,
        asdasd3: 23,
        asdasd2: 23,
    };

    function MyObjectSize2(bla: object) {
        let size = 0;
        for (let i in bla) if (bla.hasOwnProperty(i)) size++;
        return size;
    }

    function MyObjectSize1(bla: object) {
        return Object.keys(bla).length;
    }

    bench.add('for in', () => {
        const size = MyObjectSize2(bla);
    });

    bench.add('Object.keys()', () => {
        const size = MyObjectSize1(bla);
    });

    bench.run();
});

// test('demo', () => {
//     const bench = new BenchSuite('Demo');
//
//     const schema = t.schema({
//         username: t.string,
//         password: t.string,
//     });
//
//     function simple(last: any, current: any) {
//         const changed: any = {};
//         for (const property of schema.getClassProperties().values()) {
//             if (last[property.name] !== current[property.name]) changed[property.name] = true;
//         }
//         return changed;
//     }
//
//     function jit() {
//         const props: string[] = [];
//
//         for (const property of schema.getClassProperties().values()) {
//             props.push(`if (last.${property.name} !== current.${property.name}) changed.${property.name} = true;`)
//         }
//
//         const code = `
//             return function(last, current) {
//                 const changed = {};
//                 ${props.join('\n')}
//                 return changed;
//             }
//         `
//
//         return new Function(code)();
//     }
//
//     const jitCompare = jit();
//     expect(simple({username: 'peter'}, {username: 'Marc'})).toEqual({username: true});
//     expect(jitCompare({username: 'peter'}, {username: 'Marc'})).toEqual({username: true});
//
//     bench.add('simple', () => {
//         simple({username: 'peter'}, {username: 'Marc'});
//     });
//
//     bench.add('jit', () => {
//         jitCompare({username: 'peter'}, {username: 'Marc'});
//     });
//
//     bench.run();
//
// });

test('for vs map', () => {
    const items = 'aasf asdkfn asnfo asnfoiasfn oaisdf asdoifnsadf adsufhasduf hasdoufh asdoufh asufhasdu fas'.split(' ');

    const suite = new BenchSuite('for vs map');

    function toUpper(item: string) {
        return item.toUpperCase();
    }

    suite.add('map', () => {
        const result: string[] = items.map(v => toUpper(v));
    });

    suite.add('for', () => {
        const result: string[] = [];
        for (const item of items) {
            result.push(toUpper(item));
        }
    });

    suite.run();
});

test('weakMap vs Object.defineProperty', () => {
    class User {
        constructor(public id: string) {
        }
    }

    const suite = new BenchSuite('weakMap vs Object.defineProperty');

    const items: User[] = [];
    for (let i = 0; i < 1000; i++) {
        items.push(new User(String(i)));
    }

    const weakMap = new WeakMap();

    suite.add('weakMap set', () => {
        for (const item of items) {
            weakMap.set(item, {myAdditionalData: item.id});
        }
    });

    suite.add('weakMap get', () => {
        for (const item of items) {
            if (weakMap.get(item)!.myAdditionalData !== item.id) throw new Error('Moep');
        }
    });

    Object.defineProperty(User.prototype, '__myData', {writable: true, enumerable: false, value: {}});

    suite.add('defineProperty set', () => {
        for (const item of items) {
            (item as any).__myData = {myAdditionalData: item.id};
        }
    });

    suite.add('defineProperty get', () => {
        for (const item of items) {
            if ((item as any).__myData.myAdditionalData !== item.id) throw new Error('Moep');
        }
    });

    suite.run();
});

test('set known prop in prototype vs unknown prop vs weakmap', () => {
    class User {
        constructor(public id: number) {
        }
    }

    const suite = new BenchSuite('known prop vs unknown prop vs weakmap');

    suite.add('set new', () => {
        const item = new User(1);
        (item as any).bla = 1;
    });

    suite.add('get new', () => {
        const item = new User(1);
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

    suite.add('set predefined', () => {
        const item = new User(1);
        if (!(item as any)['constructor'].prototype.hasOwnProperty('bla')) {
            Object.defineProperty(Object.getPrototypeOf(item), 'bla', {writable: true, enumerable: false});
        }
        (item as any).bla = 1;
    });

    const symbol = Symbol('bla');

    suite.add('set predefined symbol', () => {
        const item = new User(1);
        if (!(item as any)['constructor'].prototype.hasOwnProperty(symbol)) {
            Object.defineProperty(Object.getPrototypeOf(item), symbol, {writable: true, enumerable: false});
        }
        (item as any)[symbol] = 1;
    });

    suite.add('get predefined', () => {
        const item = new User(1);
        (item as any).bla = 1;
        const n = (item as any).bla;
    });

    const map = new WeakMap();
    suite.add('set map', () => {
        const item = new User(1);
        map.set(item, 1);
    });

    suite.add('get map', () => {
        const item = new User(1);
        map.set(item, 1);
        const n = map.get(item);
    });

    suite.run();
});

test('cache', () => {
    const suite = new BenchSuite('cache');

    const cache: any = {};
    suite.add('object write', () => {
        cache[1] = {i: 1};
    });

    suite.add('object read', () => {
        const n = cache[1];
    });

    suite.add('object hasOwnProperty', () => {
        if (cache.hasOwnProperty(1)) {
            const n = cache[1];
        }
    });

    const map = new Map();
    suite.add('map write', () => {
        map.set(1, {i: 1});
    });
    suite.add('map read', () => {
        const n = map.get(1);
    });

    suite.run();
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
    const suite = new BenchSuite('classToPlain vs copy-on-write hooks');
    suite.add('classToPlain', () => {
        const item = plainSerializer.for(MarshalModel).deserialize({
            name: 'name',
            id: 1,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
        plainSerializer.for(MarshalModel).serialize(item);
    });

    suite.add('proxy', () => {
        const item = plainSerializer.for(MarshalModel).deserialize({
            name: 'name',
            id: 1,
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
        };
    }

    suite.add('defineProperty', () => {
        const item = plainSerializer.for(MarshalModel).deserialize({
            name: 'name',
            id: 1,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });

        Object.defineProperties(item, properties);
    });

    suite.run();
});


test('object setter/getter', () => {
    const suite = new BenchSuite('object setter/getter');

    const plainObject = {
        a: 1,
        b: 'b',
    };

    const protoObject = Object.create(plainObject);

    suite.add('plainObject', () => {
        plainObject.a = 2;
    });

    let value = 1;
    const proto = {
        property: value,
    };

    value += 1;
    const obj = Object.create(proto);

    //https://jsperf.com/property-access-vs-defineproperty/5
    //is 10x faster
    suite.add('protoObject write', () => {
        obj.property = 5;
    });
    suite.add('protoObject read ', () => {
        const res = obj.property;
    });

    suite.run();
});
