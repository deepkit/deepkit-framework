import 'jest';
import 'reflect-metadata';
import {bench} from "../../benchmark/util";
import {classToPlain, partialPlainToClass, plainToClass} from "../../core/src/mapper-old";
import {jitClassToPlain, jitPartialPlainToClass, jitPlainToClass} from "../src/jit";
import {f} from "..";

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


test('benchmark', () => {
    const count = 100_000;

    bench(count, 'plainToClass non-jit', (i) => {
        const instance = plainToClass(MarshalModel, {
            name: 'name' + i,
            id: i,
            tags: ['a', 'b', 'c'],
            priority: 5,
            ready: true,
        });
    });

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

    bench(count, 'classToPlain non-jit', (i) => {
        const plain = classToPlain(MarshalModel, b);
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

test('benchmark map/obj', () => {
    const count = 100_000 * 6;
    const map = new Map<string, number>();
    const obj: any = {};
    const array = [1, 2, 3, 4, 5];
    map.set('any', 0);
    map.set('class:plain:Uint8Array', 1);
    map.set('class:plain:Float32Array', 2);
    map.set('class:plain:number', 3);
    map.set('class:plain:8Array', 4);
    map.set('class', 5);
    map.set('boolean', 6);
    map.set('class:plain:Buffer', 7);
    map.set('string', 8);
    map.set('enum', 9);
    for (const [k, v] of map.entries()) {
        obj[k] = v;
    }

    bench(count, 'map', (i) => {
        map.get('class:plain:number');
    });

    bench(count, 'obj', (i) => {
        const v = obj['class:plain:number'];
    });

    bench(count, 'array', (i) => {
        const v = array[1];
    });

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

    bench(count, 'partialPlainToClass non-jit', (i) => {
        const partialWithClassValues = partialPlainToClass(MarshalModel, partial);
    });

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
