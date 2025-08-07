const AsyncFunction = (async () => {
}).constructor as { new(...args: string[]): Function };

function noop() {
}

type Benchmark = {
    name: string;
    fn: () => void;
    iterations: number;
    avgTime: number;
    variance: number;
    rme: number;
    samples: number[],
    heapDiff: number;
    gcEvents: number[];
}

const benchmarks: Benchmark[] = [{
    name: '',
    fn: noop,
    gcEvents: [],
    samples: [],
    iterations: 0,
    avgTime: 0,
    heapDiff: 0,
    rme: 0,
    variance: 0,
}];
let benchmarkCurrent = 1;
let current = benchmarks[0];

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

const Reset = '\x1b[0m';
const FgGreen = '\x1b[32m';
const FgYellow = '\x1b[33m';

function green(text: string): string {
    return `${FgGreen}${text}${Reset}`;
}

function yellow(text: string): string {
    return `${FgYellow}${text}${Reset}`;
}

function print(...args: any[]) {
    process.stdout.write(args.join(' ') + '\n');
}

const callGc = global.gc ? global.gc : () => undefined;

function report(benchmark: Benchmark) {
    const hz = 1000 / benchmark.avgTime;

    print(
        ' 🏎',
        'x', green(hz.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(14)), 'ops/sec',
        '\xb1' + benchmark.rme.toFixed(2).padStart(5) + '%',
        yellow(benchmark.avgTime.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 }).padStart(10)), 'ms/op',
        '\t' + getBlocks(benchmark.samples),
        green(benchmark.name) + (current.fn instanceof AsyncFunction ? ' (async)' : ''),
        `\t${benchmark.iterations} samples`,
        benchmark.gcEvents.length ? `\t${benchmark.gcEvents.length} gc (${benchmark.gcEvents.reduce((a, b) => a + b, 0)}ms)` : '',
    );
}

/**
 * Registers a benchmark with the given name and function.
 * Function can be synchronous or asynchronous.
 */
export function benchmark(name: string, fn: () => void) {
    benchmarks.push({
        name, fn,
        gcEvents: [],
        samples: [],
        iterations: 0,
        avgTime: 0,
        heapDiff: 0,
        rme: 0,
        variance: 0,
    });
}

/**
 * Runs all registered benchmarks each for the given number of seconds.
 */
export async function run(seconds: number = 1) {
    print('Node', process.version);

    while (benchmarkCurrent < benchmarks.length) {
        current = benchmarks[benchmarkCurrent];
        try {
            if (current.fn instanceof AsyncFunction) {
                await testAsync(seconds);
            } else {
                test(seconds);
            }
        } catch (error) {
            print(`Benchmark ${current.name} failed`, error);
        }
        benchmarkCurrent++;
        report(current);
    }

    console.log('done');
}

const executors = [
    getExecutor(1),
    getExecutor(10),
    getExecutor(100),
    getExecutor(1000),
    getExecutor(10000),
    getExecutor(100000),
    getExecutor(1000000),
];

const asyncExecutors = [
    getAsyncExecutor(1),
    getAsyncExecutor(10),
    getAsyncExecutor(100),
    getAsyncExecutor(1000),
    getAsyncExecutor(10000),
    getAsyncExecutor(100000),
    getAsyncExecutor(1000000),
];

function test(seconds: number) {
    let iterations = 1;
    let samples: number[] = [];
    const max = seconds * 1000;

    let executorId = 0;
    let executor = executors[executorId];
    //check which executor to use, go up until one round takes more than 5ms
    do {
        const candidate = executors[executorId++];
        if (!candidate) break;
        const start = performance.now();
        candidate(current.fn);
        const end = performance.now();
        const time = end - start;
        if (time > 5) break;
        executor = candidate;
    } while (true);

    // warmup
    for (let i = 0; i < 100; i++) {
        executor(current.fn);
    }

    let consumed = 0;
    const beforeHeap = process.memoryUsage().heapUsed;
    callGc();
    do {
        const start = performance.now();
        const r = executor(current.fn);
        const end = performance.now();
        const time = end - start;
        consumed += time;
        samples.push(time / r);
        iterations += r;
    } while (consumed < max);

    // console.log('executionTimes', executionTimes);
    collect(current, beforeHeap, samples, iterations);
}

function collect(current: Benchmark, beforeHeap: number, samples: number[], iterations: number) {
    // remove first 10% of samples
    const allSamples = samples.slice();
    samples = samples.slice(Math.floor(samples.length * 0.9));

    const avgTime = samples.reduce((sum, t) => sum + t, 0) / samples.length;
    samples.sort((a, b) => a - b);

    const variance = samples.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / samples.length;
    const rme = (Math.sqrt(variance) / avgTime) * 100; // Relative Margin of Error (RME)

    const afterHeap = process.memoryUsage().heapUsed;
    const heapDiff = afterHeap - beforeHeap;

    current.avgTime = avgTime;
    current.variance = variance;
    current.rme = rme;
    current.heapDiff = heapDiff;
    current.iterations = iterations;
    // pick 20 samples from allSamples, make sure the first and last are included
    current.samples = allSamples.filter((v, i) => i === 0 || i === allSamples.length - 1 || i % Math.floor(allSamples.length / 20) === 0);
    // current.samples = allSamples;
}

async function testAsync(seconds: number) {
    let iterations = 1;
    let samples: number[] = [];
    const max = seconds * 1000;

    let executorId = 0;
    let executor = asyncExecutors[executorId];
    //check which executor to use, go up until one round takes more than 5ms
    do {
        const candidate = asyncExecutors[executorId++];
        if (!candidate) break;
        const start = performance.now();
        await candidate(current.fn);
        const end = performance.now();
        const time = end - start;
        if (time > 5) break;
        executor = candidate;
    } while (true);

    // warmup
    for (let i = 0; i < 100; i++) {
        executor(current.fn);
    }

    let consumed = 0;
    const beforeHeap = process.memoryUsage().heapUsed;
    callGc();
    do {
        const start = performance.now();
        const r = await executor(current.fn);
        const end = performance.now();
        const time = end - start;
        consumed += time;
        samples.push(time / r);
        iterations += r;
    } while (consumed < max);

    collect(current, beforeHeap, samples, iterations);
}

function getExecutor(times: number) {
    let code = '';
    for (let i = 0; i < times; i++) {
        code += 'fn();';
    }
    return new Function('fn', code + '; return ' + times);
}

function getAsyncExecutor(times: number) {
    let code = '';
    for (let i = 0; i < times; i++) {
        code += 'await fn();';
    }
    return new AsyncFunction('fn', code + '; return ' + times);
}
