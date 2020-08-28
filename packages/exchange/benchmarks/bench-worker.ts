import {Worker, SHARE_ENV} from 'worker_threads';
import {bench} from '@super-hornet/core';

const arrayBuffer = new SharedArrayBuffer(32);
const array = new Int32Array(arrayBuffer);

const worker = new Worker(`
    const {workerData} = require('worker_threads');
    
    let i = 0;
    const array = new Int32Array(workerData);
    const start = Date.now();
    
    while (true) {
        Atomics.wait(array, 0, 0);
        if (Atomics.load(array, 0) === 2) break;
        
        Atomics.store(array, 0, 0);
        Atomics.notify(array, 0, 1);
        i++;
    }

    console.log('done', i, Date.now() - start);

`, {eval: true, workerData: arrayBuffer});

const workerMessage = new Worker(`
    const {parentPort} = require('worker_threads');

    parentPort.on('message', function(ev) {
        // console.log('workerMessage got', ev);
        parentPort.postMessage(ev.data);
    });

`, {eval: true});

worker.on('exit', () => {
    console.log('worker done');
});

setTimeout(async () => {
    console.log('lets go');

    // Atomics.store(array, 0, 1);
    // Atomics.notify(array, 0, 1);
    // Atomics.wait(array, 0, 1);
    //
    // Atomics.store(array, 0, 1);
    // Atomics.notify(array, 0, 1);
    // Atomics.wait(array, 0, 1);
    //
    // Atomics.store(array, 0, 1);
    // Atomics.notify(array, 0, 1);
    // Atomics.wait(array, 0, 1);

    const count = 100_000;
    workerMessage.postMessage(arrayBuffer);

    await bench(count, 'reference', async () => {

    });

    await bench(count, 'postMessage thread', async () => {
        await new Promise((resolve) => {
            workerMessage.once('message', () => {
                resolve();
            });
            workerMessage.postMessage('yolo');
        });
    });

    await bench(count, 'atomic thread sync', async () => {
        Atomics.store(array, 0, 1);
        Atomics.notify(array, 0, 1);
        Atomics.wait(array, 0, 1);
    });

    // const start = Date.now();
    // for (let i = 0; i < count; i++) {
    //     // Atomics.store(array, 0, 1);
    //     // Atomics.notify(array, 0, 1);
    //     // Atomics.wait(array, 0, 1);
    //     // const got = Atomics.load(array, 0);
    //     await new Promise((resolve) => {
    //         resolve(true);
    //     });
    // }

    // console.log('took', Date.now() - start, 'for', count, 'items');
    //end worker by setting it to 2
    Atomics.store(array, 0, 2);
    Atomics.notify(array, 0, 1);


    // Atomics.store(array, 0, 1);
    // console.log('array[0]', array[0]);
    // console.log('notified', Atomics.notify(array, 0, 1));
    //
    // console.log('master wait');
    // console.log('notified', Atomics.wait(array, 0, 1));

    // console.log('master wait');
    // console.log('notified', Atomics.notify(array, 0, 1));

    // for (let i = 0; i < 1000; i++) {
    //     Atomics.store(array, 0, 1);
    //     Atomics.notify(array, 0, 1);
    //     Atomics.wait(array, 0, 1);
    // }

    console.log('main done');
    // array[0] = 1;
    // Atomics.store(array, 0, 1);
    // console.log('notified', Atomics.notify(array, 0, 1));
}, 1000);

// setTimeout(() => {
//     Atomics.notify(array, 0, 1);
// }, 2000);

// {eval: true, env: SHARE_ENV})
// .on('exit', () => {
//     console.log(process.env.SET_IN_WORKER);  // Prints 'foo'.
// });