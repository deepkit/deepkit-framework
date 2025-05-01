import { benchmark, run } from '@deepkit/bench';
import { asyncOperation } from '../src/core.js';

const sab = new SharedArrayBuffer(1024);
const int32 = new Int32Array(sab);

benchmark('new Promise', async function benchmarkAction() {
    await new Promise<void>(function promiseCallback(resolve) {
        resolve();
    });
});

benchmark('asyncOperation', async function benchmarkAction() {
    await asyncOperation<void>(function promiseCallback(resolve) {
        resolve();
    });
});

benchmark('Atomics.waitAsync', async function benchmarkAction() {
    const promise = (Atomics as any).waitAsync(int32, 0, 0);
    Atomics.notify(int32, 0);
    await promise.value;
});

run();
