const Reset = "\x1b[0m";
const FgGreen = "\x1b[32m";

declare var process: any;

function green(text: string): string {
    return `${FgGreen}${text}${Reset}`;
}

function ops(ops: number): string {
    let text = ops.toLocaleString(undefined, {maximumFractionDigits: 0});
    text = text.padStart(12, ' ');
    return `${FgGreen}${text}${Reset} ops/s`;
}

function shuffle(a: any[]) {
    let j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

type Benchmark = { title: string, async: boolean, fn: (i: number) => Promise<void> | void }

export class BenchSuite {
    benchmarks: Benchmark[] = [];
    warmUp: number = 0;

    constructor(
        public name: string,
        public operations: number = 1_000,
        warmUp: boolean | number = true,
    ) {
        this.warmUp = true === warmUp ? this.operations * 0.1 : ('number' === typeof warmUp) ? this.warmUp : 0;
    }

    addAsync(title: string, fn: (i: number) => Promise<void>) {
        this.benchmarks.push({title, fn, async: true});
        return this;
    }

    add(title: string, fn: (i: number) => void) {
        this.benchmarks.push({title, fn, async: false});
        return this;
    }

    shuffle() {
        shuffle(this.benchmarks);
        return this;
    }

    protected runBenchmark(benchmark: Benchmark) {
        for (let i = 0; i < this.warmUp; i++) {
            benchmark.fn(i);
        }
        const start = performance.now();
        for (let i = 0; i < this.operations; i++) {
            benchmark.fn(i);
        }
        this.report(benchmark, performance.now() - start);
    }

    protected async runBenchmarkAsync(benchmark: Benchmark) {
        for (let i = 0; i < this.warmUp; i++) {
            await benchmark.fn(i);
        }

        const start = performance.now();
        for (let i = 0; i < this.operations; i++) {
            await benchmark.fn(i);
        }
        this.report(benchmark, performance.now() - start);
    }

    protected report(benchmark: Benchmark, took: number) {
        process.stdout.write([
            ops((1000 / took) * this.operations),
            green(benchmark.title),
            took.toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms,',
            (took / this.operations).toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms per op',
        ].join(' ') + '\n');
    }

    run(): void {
        process.stdout.write([
            'Benchmark', green(this.name) + ',', this.operations.toLocaleString(), 'ops',
        ].join(' ') + ':\n');

        for (const benchmark of this.benchmarks) {
            this.runBenchmark(benchmark);
        }
    }

    async runAsync() {
        process.stdout.write([
            'Benchmark', green(this.name), this.operations.toLocaleString(), 'ops',
        ].join(' ') + ':\n');

        for (const benchmark of this.benchmarks) {
            await this.runBenchmarkAsync(benchmark);
        }
    }
}

/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export function bench(times: number, title: string, exec: (i: number) => void, warmUp: boolean | number = true) {
    warmUp = true === warmUp ? times * 0.1 : ('number' === typeof warmUp) ? warmUp : 0;

    for (let i = 0; i < warmUp; i++) {
        exec(i);
    }

    const start = performance.now();
    for (let i = 0; i < times; i++) {
        exec(i);
    }
    const took = performance.now() - start;

    process.stdout.write([
        times.toLocaleString(), 'ops:',
        ops((1000 / took) * times),
        green(title),
        took.toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms,',
        (took / times).toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms per item',
    ].join(' ') + '\n');
}
