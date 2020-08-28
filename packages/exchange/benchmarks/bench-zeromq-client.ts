import {performance} from 'perf_hooks';

async function bench(times: number, title: string, exec: () => void | Promise<void>) {
    const start = performance.now();
    for (let i = 0; i < times; i++) {
        await exec();
    }
    const took = performance.now() - start;

    process.stdout.write([
        (1000 / took) * times, 'ops/s',
        title,
        took.toLocaleString(undefined, {maximumFractionDigits: 17}), 'ms,',
        process.memoryUsage().rss / 1024 / 1024, 'MB memory'
    ].join(' ') + '\n');
}

const zmq = require('zeromq');

async function run() {
    const client = new zmq.Request;

    console.log('connect to 3000');
    client.connect('ipc:///tmp/zero.sock');
    console.log('Producer bound to port 3000');

    await bench(10_000, 'zermq', async () => {
        await client.send(Buffer.alloc(2));
        const [result] = await client.receive();
    });
}

run();