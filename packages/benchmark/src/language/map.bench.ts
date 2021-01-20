/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from "../bench";

export function main() {

    const bench = new BenchSuite('map');

    const map10 = new Map();

    bench.add('map set 10', () => {
        map10.clear();
        for (let i = 0; i < 10; i++) {
            map10.set('a' + i, Math.random());
        }
    });

    bench.add('map get 10', () => {
        for (let i = 0; i < 10; i++) {
            const v = map10.get('a' + i);
        }
    });

    let object10 = {};

    bench.add('object set 10', () => {
        object10 = {};
        for (let i = 0; i < 10; i++) {
            object10['a' + i] = Math.random();
        }
    });

    bench.add('object get 10', () => {
        for (let i = 0; i < 10; i++) {
            const v = object10['a' + i];
        }
    });

    const array10: any[] = [];

    bench.add('array set 10', () => {
        array10.length = 0;
        for (let i = 0; i < 10; i++) {
            array10.push({ id: 'a' + i, value: Math.random() });
        }
    });

    bench.add('array get 10', () => {
        for (let i = 0; i < 10; i++) {
            let r = 'a' + i;
            for (const item of array10) {
                if (item.id === r) break;
            }
        }
    });

    bench.run();
}
