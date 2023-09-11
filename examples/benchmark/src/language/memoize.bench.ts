/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from '../bench.js';

export function main() {
    const bench = new BenchSuite('memoize');

    function a() {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }

    function memoize<T>(callback: () => T): () => T {
        let value: T;
        return () => {
            if (callback) {
                value = callback();
                callback = undefined!;
            }
            return value;
        };
    }

    let memoized3: any;
    let memoized2 = function() {
        const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        memoized2 = function(this: any){ return (memoized2 as any).result };
        (memoized2 as any).result = result;
        memoized3 = () => result;
        return result;
    }

    const array = a();
    bench.add('baseline', () => {
        array[2];
    });

    const mem1 = memoize(a);
    bench.add('memoize1', () => {
        mem1()[2];
    });

    // memoized2();
    // bench.add('memoized2', () => {
    //     memoized2()[2];
    // });
    // bench.add('memoized3', () => {
    //     memoized3()[2];
    // });

    let array2 = function() {
        array2 = function(){ return array; };
    };
    array2();

    bench.add('base2', () => {
        array2()[2];
    });

    function memoize2<T>(callback: () => T): () => T {
        const cache = {
            get() {
                const result = callback();
                cache.get = () => result;
                return result;
            }
        }
        return () => cache.get();
    }

    const mem2 = memoize2(a);
    // const cache = {
    //     get() {
    //         const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    //         cache.get = function(){ return result; };
    //         return result;
    //     }
    // }

    bench.add('memoize2', () => {
        mem2()[2];
    });

    let array3 = () =>  array;
    bench.add('base3', () => {
        array3()[2];
    });

    bench.run();
}
