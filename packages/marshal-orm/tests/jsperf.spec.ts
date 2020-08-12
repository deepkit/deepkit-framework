import 'jest-extended';
import 'reflect-metadata';
import {classToPlain, f, getClassSchema, Patcher, plainToClass, t} from '@super-hornet/marshal';
import {bench, BenchSuite} from '@super-hornet/core';


test('demo', () => {
    const bench = new BenchSuite('Demo');

    const schema = t.schema({
        username: t.string,
        password: t.string,
    });

    function simple(last: any, current: any) {
        const changed: any = {};
        for (const property of schema.getClassProperties().values()) {
            if (last[property.name] !== current[property.name]) changed[property.name] = true;
        }
        return changed;
    }

    function jit() {
        const props: string[] = [];

        for (const property of schema.getClassProperties().values()) {
            props.push(`if (last.${property.name} !== current.${property.name}) changed.${property.name} = true;`)
        }

        const code = `
            return function(last, current) {
                const changed = {};
                ${props.join('\n')}
                return changed;
            }
        `

        return new Function(code)();
    }

    const jitCompare = jit();
    expect(simple({username: 'peter'}, {username: 'Marc'})).toEqual({username: true});
    expect(jitCompare({username: 'peter'}, {username: 'Marc'})).toEqual({username: true});

    bench.add('simple', () => {
        simple({username: 'peter'}, {username: 'Marc'});
    });

    bench.add('jit', () => {
        jitCompare({username: 'peter'}, {username: 'Marc'});
    });

    bench.run();

});

test('for vs map', () => {
    const items = 'aasf asdkfn asnfo asnfoiasfn oaisdf asdoifnsadf adsufhasduf hasdoufh asdoufh asufhasdu fas'.split(' ');
    const count = 100_000;

    function toUpper(item: string) {
        return item.toUpperCase();
    }

    bench(count, 'map', () => {
        const result: string[] = items.map(v => toUpper(v));
    });

    bench(count, 'for', () => {
        const result: string[] = [];
        for (const item of items) {
            result.push(toUpper(item));
        }
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

    bench(count, 'weakMap set', () => {
        for (const item of items) {
            weakMap.set(item, {myAdditionalData: item.id});
        }
    });

    bench(count, 'weakMap get', () => {
        for (const item of items) {
            if (weakMap.get(item)!.myAdditionalData !== item.id) throw new Error('Moep');
        }
    });

    Object.defineProperty(User.prototype, '__myData', {writable: true, enumerable: false, value: {}});

    bench(count, 'defineProperty set', () => {
        for (const item of items) {
            (item as any).__myData = {myAdditionalData: item.id};
        }
    });

    bench(count, 'defineProperty get', () => {
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

    bench(count, 'set new', () => {
        const item = new User(1);
        (item as any).bla = 1;
    });

    bench(count, 'get new', () => {
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

    bench(count, 'set predefined', () => {
        const item = new User(1);
        if (!(item as any)['constructor'].prototype.hasOwnProperty('bla')) {
            Object.defineProperty(Object.getPrototypeOf(item), 'bla', {writable: true, enumerable: false});
        }
        (item as any).bla = 1;
    });

    const symbol = Symbol('bla');

    bench(count, 'set predefined symbol', () => {
        const item = new User(1);
        if (!(item as any)['constructor'].prototype.hasOwnProperty(symbol)) {
            Object.defineProperty(Object.getPrototypeOf(item), symbol, {writable: true, enumerable: false});
        }
        (item as any)[symbol] = 1;
    });

    bench(count, 'get predefined', () => {
        const item = new User(1);
        (item as any).bla = 1;
        const n = (item as any).bla;
    });

    const map = new WeakMap();
    bench(count, 'set map', () => {
        const item = new User(1);
        map.set(item, 1);
    });

    bench(count, 'get map', () => {
        const item = new User(1);
        map.set(item, 1);
        const n = map.get(item);
    });
});

test('cache', () => {
    const count = 1_000_000;

    const cache: any = {};
    bench(count, 'object write', () => {
        cache[1] = {i: 1};
    });

    bench(count, 'object read', () => {
        const n = cache[1];
    });

    bench(count, 'object hasOwnProperty', () => {
        if (cache.hasOwnProperty(1)) {
            const n = cache[1];
        }
    });

    const map = new Map();
    bench(count, 'map write', () => {
        map.set(1, {i: 1});
    });
    bench(count, 'map read', () => {
        const n = map.get(1);
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
    bench(count, 'classToPlain', () => {
        const item = plainToClass(MarshalModel, {
            name: 'name',
            id: 1,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
        classToPlain(MarshalModel, item);
    });

    bench(count, 'proxy', () => {
        const item = plainToClass(MarshalModel, {
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

    bench(count, 'defineProperty', () => {
        const item = plainToClass(MarshalModel, {
            name: 'name',
            id: 1,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });

        Object.defineProperties(item, properties);
    });
});


test('object setter/getter', () => {

    const count = 1_000_000;
    const plainObject = {
        a: 1,
        b: 'b',
    };

    const protoObject = Object.create(plainObject);

    bench(count, 'plainObject', () => {
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
    bench(count, 'protoObject write', () => {
        obj.property = 5;
    });
    bench(count, 'protoObject read ', () => {
        const res = obj.property;
    });
});
