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
 * Prototype chain performance benchmark - compares Object.getPrototypeOf and object creation patterns
 */

export default async function () {
    const suite = new BenchSuite('debug/language-prototype');

    class Peter {}

    const sub = class extends Peter {};

    suite.add('Object.getPrototypeOf', () => {
        const same = Object.getPrototypeOf(sub) === Peter;
    });

    function base1() {
        const obj = { name: 'Peter', age: 24 };
        return obj;
    }

    function base2() {
        const obj: any = {};
        obj.name = 'Peter';
        obj.age = 24;
        return obj;
    }

    // JIT-compiled object creation
    const compiledFn = new Function(`
        const obj = {};
        obj.name = 'Peter';
        obj.age = 24;
        return obj;
    `) as () => any;

    suite.add('object literal creation', () => {
        base1();
    });

    suite.add('object property assignment', () => {
        base2();
    });

    suite.add('compiled object creation', () => {
        compiledFn();
    });

    return suite;
}
