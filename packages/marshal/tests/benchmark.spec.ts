import 'jest-extended';
import 'reflect-metadata';
import {bench} from "../../marshal-benchmark/util";
import {jitClassToPlain, jitPartialPlainToClass, jitPlainToClass} from "../src/jit";
import {f, validate} from "..";

export class MarshalSuperSimple {
    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

export class MarshalModel {
    @f ready?: boolean;

    @f.array(String) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
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

    bench(count, 'plainToClass jit', (i) => {
        const instance = jitPlainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });

    // console.log('jit', JITToClassFN.get(MarshalModel).toString());

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
        const obj = {};
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
