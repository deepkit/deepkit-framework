/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { performance } from 'perf_hooks';
import Benchmark from 'benchmark';

const Reset = '\x1b[0m';
const FgGreen = '\x1b[32m';
const FgYellow = '\x1b[33m';

declare var process: any;

function green(text: string): string {
    return `${FgGreen}${text}${Reset}`;
}

function yellow(text: string): string {
    return `${FgYellow}${text}${Reset}`;
}

function ops(ops: number): string {
    let text = ops.toLocaleString(undefined, { maximumFractionDigits: 0 });
    text = text.padStart(12, ' ');
    return `${FgGreen}${text}${Reset} ops/s`;
}

function print(...args: any[]) {
    process.stdout.write(args.join(' ') + '\n');
}

const blocks = ['▁', '▂', '▄', '▅', '▆', '▇', '█'];

function getBlocks(stats: number[]): string {
    const max = Math.max(...stats);
    let res = '';
    for (const n of stats) {
        const cat = Math.ceil(n / max * 6);
        res += (blocks[cat - 1]);
    }

    return res;
}

type BenchSuiteResult = { [name: string]: { hz: number, elapsed: number, rme: number, mean: number } };

export class BenchSuite {
    suite = new Benchmark.Suite;
    static onComplete?: (name: string, result: BenchSuiteResult) => any;

    protected fixResult: BenchSuiteResult = {};

    constructor(
        public name: string,
        protected maxTime: number = 1
    ) {
        this.suite.on('complete', () => {
            const fastest = this.suite.filter('fastest')[0];
            const result: BenchSuiteResult = {};
            for (const benchmark of this.suite.slice()) {
                result[benchmark.name] = {
                    hz: benchmark.hz,
                    elapsed: benchmark.times.elapsed,
                    rme: benchmark.stats.rme,
                    mean: benchmark.stats.mean,
                };
            }
            if (BenchSuite.onComplete) BenchSuite.onComplete(this.name, result);
            print(
                ' 🏁 Fastest',
                green(fastest.name),
            );
        }).on('cycle', function (event: any) {
            print(
                ' 🏎',
                'x', green(event.target.hz.toLocaleString(undefined, { maximumFractionDigits: 2 })), 'ops/sec',
                '\xb1' + event.target.stats.rme.toFixed(2) + '%',
                yellow(event.target.stats.mean.toLocaleString(undefined, { maximumFractionDigits: 16 })), 'sec/op',
                '\t' + getBlocks(event.target.stats.sample),
                green(event.target.name),
            );
        });
    }

    addAsync(title: string, fn: () => Promise<void>, options: any = {}) {
        this.suite.add(title, {
            defer: true,
            maxTime: this.maxTime,
            fn: function (deferred: any) {
                fn().then(() => deferred.resolve());
            }
        });
    }

    add(title: string, fn: () => void | Promise<void>, options: any = {}) {
        options = Object.assign({ maxTime: this.maxTime }, options);
        this.suite.add(title, fn, options);
    }

    run(options: object = {}): void {
        print('Start benchmark', green(this.name));
        return this.suite.run(options);
    }

    async runAsyncFix(count: number, title: string, fn: () => Promise<void>) {
        const took = await bench(count, title, fn);
        this.fixResult[title] = {
            hz: (1000 / took) * count,
            elapsed: took,
            rme: 0,
            mean: took / count,
        };
        if (BenchSuite.onComplete) BenchSuite.onComplete(this.name, this.fixResult);
    }

    async runAsync() {
        print('Start benchmark', green(this.name));
        await new Promise(async (resolve, reject) => {
            this.suite.run({ async: true });
            this.suite.on('complete', () => {
                resolve(undefined);
            });
        });
    }
}

/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export async function bench(times: number, title: string, exec: () => void | Promise<void>): Promise<number> {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
        await exec();
    }
    const took = performance.now() - start;

    process.stdout.write([
        times.toLocaleString(), 'ops:',
        ops((1000 / took) * times),
        green(title),
        took.toLocaleString(undefined, { maximumFractionDigits: 17 }), 'ms,',
        (took / times).toLocaleString(undefined, { maximumFractionDigits: 17 }), 'ms per op',
        process.memoryUsage().rss / 1024 / 1024, 'MB memory'
    ].join(' ') + '\n');
    return took;
}
