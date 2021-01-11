import { performance } from 'perf_hooks';

/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export function bench(times: number, title: string, exec: (i: number) => void) {
    const start = performance.now();

    for (let i = 0; i < times; i++) {
        exec(i);
    }

    const took = performance.now() - start;

    console.log(times, 'x benchmark', title, took, 'ms', took / times, 'per item');
}
