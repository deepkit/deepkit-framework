import 'jest-extended';
import 'reflect-metadata';
import {jitClassToPlain, jitPartialPlainToClass, jitPlainToClass, plainToClassFactory} from "../src/jit";
import {bench, BenchSuite} from "@super-hornet/core";
import {t} from "../index";

export class MarshalModel {
    @t ready?: boolean;

    @t.array(String) tags: string[] = [];

    @t priority: number = 0;

    constructor(
        @t public id: number,
        @t public name: string
    ) {
    }
}

test('benchmark plainToClass', () => {
    const count = 100_000;

    bench(count, 'plainToClass manual new MarshalModel', (i) => {
        const instance = new MarshalModel(i, name + 'i');
        instance.tags = ['a', 'b', 'c'];
        instance.priority = 5;
        instance.ready = true;
    });

    const serialize = plainToClassFactory(MarshalModel);

    bench(count, 'plainToClass jit', (i) => {
        const instance = serialize({
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });

    // console.log('jit', getJitFunctionPlainToClass(MarshalModel).toString());

    const b = jitPlainToClass(MarshalModel, {
        name: 'name1',
        id: 1,
        tags: ['a', 2, 'c'],
        priority: 5,
        ready: true,
    });
    expect(b.name).toBe('name1');
    expect(b.id).toBe(1);
    expect(b.tags).toEqual(['a', '2', 'c']);
    expect(b.priority).toBe(5);
    expect(b.ready).toBe(true);
});

test('benchmark classToPlain', () => {
    const count = 100_000;

    const b = jitPlainToClass(MarshalModel, {
        name: 'name1',
        id: 1,
        tags: ['a', 2, 'c'],
        priority: 5,
        ready: true,
    });

    bench(count, 'classToPlain manual obj = {}', (i) => {
        const obj: any = {};
        obj['name'] = b.name;
        obj['id'] = b.id;
        obj['tags'] = b.tags;
        obj['priority'] = b.priority;
        obj['ready'] = b.ready;
    });

    bench(count, 'classToPlain jit', (i) => {
        const plain = jitClassToPlain(MarshalModel, b);
    });

    // console.log('jit', JITToPlainCacheFN.get(MarshalModel).toString());

    const plain = jitClassToPlain(MarshalModel, b);
    expect(plain.name).toBe('name1');
    expect(plain.id).toBe(1);
    expect(plain.tags).toEqual(['a', '2', 'c']);
    expect(plain.priority).toBe(5);
    expect(plain.ready).toBe(true);
});

test('benchmark partialPlainToClass', () => {
    const partial = {
        name: 'name1',
        id: '2',
        'tags.0': 3,
        priority: 5,
        ready: 'false',
    };

    const count = 100_000;

    bench(count, 'partialPlainToClass jit', (i) => {
        const partialWithClassValues = jitPartialPlainToClass(MarshalModel, partial);
    });

    const partialWithClassValues = jitPartialPlainToClass(MarshalModel, partial);

    expect(partialWithClassValues.name).toBe('name1');
    expect(partialWithClassValues.id).toBe(2);
    expect(partialWithClassValues['tags.0']).toBe('3');
    expect(partialWithClassValues.priority).toBe(5);
    expect(partialWithClassValues.ready).toBe(false);
});

//     const count = 10_000;
//
//     bench(count, 'supersimple non-jit', (i) => {
//         const instance = plainToClass(MarshalSuperSimple, {
//             name: 'name' + i,
//             id: i,
//         });
//     });
//
//     bench(count, 'supersimple new MarshalModel', (i) => {
//         const instance = new MarshalSuperSimple(i, name + 'i');
//     });
//
//     bench(count, 'supersimple jit', (i) => {
//         const instance = jitPlainToClass(MarshalSuperSimple, {
//             name: 'name' + i,
//             id: i,
//         });
//     });
// });

test('if filling a instance of prototype with fields is faster than a blank object', () => {
    const suite = new BenchSuite('filling object', 1_000_000);

    suite.add('normal', function (i) {
        const obj: any = {};
        obj.a = i;
        obj.another_key_jo = 'yes';
        obj.title = 'title';
        obj.index = 5;
    });

    const prototype = {
        a: 1,
        another_key_jo: 1,
        title: 1,
        index: 1,
    }
    function f() {}
    f.prototype = prototype;

    suite.add('prototype fn', function (i) {
        const obj2: any = new (f as any)();
        obj2.a = i;
        obj2.another_key_jo = 'yes';
        obj2.title = 'title';
        obj2.index = 5;
    });

    function f2(this: any) {
        (this as any).a = 1;
        (this as any).another_key_jo = 1;
        (this as any).title = 'yes';
        (this as any).index = 5;
    }
    suite.add('constructor fn', function (i) {
        const obj3: any = new (f2 as any)();
        obj3.a = i;
        obj3.another_key_jo = 'yes';
        obj3.title = 'title';
        obj3.index = 5;
    });

    suite.add('direct', function (i) {
        const obj = {
            a: i,
            another_key_jo: 'yes',
            title: 'title',
            index: 5,
        }
    });
});

test('string convertion', () => {
    const suite = new BenchSuite('filling object', 1_000_000);

    suite.add('+', () => {
        const r = ''+23;
    });

    suite.add('String()', () => {
        const r = String(24);
    });

    suite.run();
});

test('number convertion', () => {
    const suite = new BenchSuite('filling object', 1_000_000);

    suite.add('+', () => {
        const r = '23'+0;
    });

    suite.add('Number()', () => {
        const r = Number('24');
    });

    suite.run();
});


test('worth to check type first?', () => {
    const suite = new BenchSuite('check typeof worth it', 1_000_000);

    const valueString: any = '23';
    const valueNumber: any = 24;

    suite.add('string typeof', () => {
        const r1 = typeof valueString === 'string' ? valueString : ''+valueString;
        const r2 = typeof valueNumber === 'string' ? valueNumber : ''+valueNumber;
    });

    suite.add('string without typeof', () => {
        const r1 = ''+valueString;
        const r2 = ''+valueNumber;
    });

    suite.add('number typeof', () => {
        const r1 = typeof valueString === 'number' ? valueString : 0+valueString;
        const r2 = typeof valueNumber === 'number' ? valueNumber : 0+valueNumber;
    });

    suite.add('number without typeof', () => {
        const r1 = 0+valueString;
        const r2 = 0+valueNumber;
    });

    suite.run();
});
