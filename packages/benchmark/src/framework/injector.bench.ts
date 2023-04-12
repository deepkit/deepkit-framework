/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { injectable, Injector, InjectorContext } from '@deepkit/injector';
import { BenchSuite } from '../bench.js';

export async function main() {
    class Database { }

    class Database2 { }

    @injectable
    class MyService {
        constructor(database: Database) {
        }
    }

    const root = new Injector([MyService, Database, Database2]);
    const child = new Injector([], [root]);

    const bench = new BenchSuite('injector');

    const CircularDetector = new Set();
    const array: any[] = [];

    // bench.addAsync('circular check array', async () => {
    //     array.push(Database);
    //     array.push(Database);
    //     array.indexOf(Database);
    //     array.indexOf(MyService);
    //     array.pop();
    //     array.pop();
    // });
    //
    // bench.addAsync('circular check set', async () => {
    //     CircularDetector.add(Database);
    //     CircularDetector.add(MyService);
    //     CircularDetector.has(Database);
    //     CircularDetector.has(MyService);
    //     CircularDetector.delete(Database);
    //     CircularDetector.delete(MyService);
    // });

    // const compiler = new CompilerContext();
    // const fn = compiler.build(`
    //     if (arg === 1) return 2;
    //     if (arg === 2) return 3;
    //     if (arg === 3) return 4;
    // `, 'arg');
    //
    // bench.add('simple, compiled', () => {
    //     fn(2);
    // });

    // bench.add('new Injector', () => {
    //     new Injector();
    // });
    //
    // bench.add('new Injector w parents', () => {
    //     new Injector([], [root]);
    // });
    //
    // bench.add('fork', () => {
    //     root.fork();
    // });

    const context = InjectorContext.forProviders([Database, MyService, {provide: Database2, scope: 'http'}]);
    const context2 = context.createChildScope('http');
    context2.getInjector(0);

    bench.add('context.createChildScope', () => {
        const context2 = context.createChildScope('http');
    });

    bench.add('context.createChildScope + getInjector', () => {
        const context2 = context.createChildScope('http');
        context2.getInjector(0);
    });


    bench.add('context.createChildScope + getInjector + context.get(Database2)', () => {
        const context2 = context.createChildScope('http');
        context2.getInjector(0).get(Database2);
    });

    bench.add('new Database', () => {
        new Database();
    });

    bench.add('root.get(Database)', () => {
        root.get(Database);
    });

    // bench.add('root db2', () => {
    //     root.get(Database2);
    // });

    bench.add('root myService', () => {
        root.get(MyService);
    });

    bench.add('root myService in fork', () => {
        root.fork().get(MyService);
    });

    bench.add('child db', () => {
        child.get(Database);
    });

    bench.add('child myService', () => {
        child.get(MyService);
    });

    bench.run();
}
