/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BenchSuite } from '@deepkit/bench';

/**
 * Map vs Object performance benchmark - compares Map, Object, Set, and Array data structures
 */

export default async function () {
    const suite = new BenchSuite('debug/language-map');

    const map = new Map<number, number>();
    const count = 1000;

    const o: any = {};
    const s = new Set<string>();

    for (let i = 0; i < 256; i++) {
        o['127.0.0' + i] = 1;
        s.add('127.0.0' + i);
    }

    suite.add('Set has', () => {
        const d = !!s.has('127.0.0.1');
    });

    suite.add('Object property access', () => {
        const d = !!o['127.0.0.1'];
    });

    suite.add('Map set (1000 items)', () => {
        map.clear();
        for (let i = 0; i < count; i++) {
            map.set(i, Math.random());
        }
    });

    suite.add('Map get (1000 items)', () => {
        for (let i = 0; i < count; i++) {
            const v = map.get(i);
        }
    });

    let object: any = {};

    suite.add('Object set (1000 items)', () => {
        object = {};
        for (let i = 0; i < count; i++) {
            object[i] = Math.random();
        }
    });

    suite.add('Object get (1000 items)', () => {
        let v: any = undefined;
        for (let i = 0; i < count; i++) {
            v = object[i];
        }
    });

    const hashmapSize = 1000;
    const hashmap: { key: number; value: number }[][] = Array(hashmapSize);

    function hashFn(num: number) {
        return num % hashmapSize;
    }

    suite.add('Hashmap set (1000 items)', () => {
        for (let i = 0; i < count; i++) {
            const v = Math.random();
            const bucket = (hashmap[hashFn(i)] ||= []);
            let found = false;
            for (const b of bucket) {
                if (b.key === i) {
                    b.value = v;
                    found = true;
                    break;
                }
            }
            if (!found) bucket.push({ key: i, value: v });
        }
    });

    suite.add('Hashmap get (1000 items)', () => {
        for (let i = 0; i < count; i++) {
            let v: any = undefined;
            const bucket = hashmap[hashFn(i)];
            if (!bucket) continue;
            for (const b of bucket) {
                if (b.key === i) {
                    v = b.value;
                    break;
                }
            }
        }
    });

    const arraySize = count;
    const array: number[] = [];
    for (let i = 0; i < arraySize; i++) array.push(0);

    suite.add('Array set (1000 items)', () => {
        for (let i = 0; i < count; i++) {
            array[i] = Math.random();
        }
    });

    suite.add('Array get (1000 items)', () => {
        for (let i = 0; i < count; i++) {
            const v = array[i];
        }
    });

    return suite;
}
