
/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export function bench(title: string, exec: () => void) {
    const times = 3;
    let time = 0;

    for (let i = 0; i < times; i++) {
        const started = performance.now();
        exec();

        time += performance.now() - started;
    }

    console.log('Benchmark', title, time / times, 'ms');
}
