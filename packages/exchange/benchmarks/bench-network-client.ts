import {createConnection} from 'net';
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

async function main() {
    const client = createConnection(27017);
    // client.setKeepAlive(true);
    // client.setNoDelay(false);
    const message = Buffer.from([111, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 221, 7, 0, 0, 0, 0, 0, 0, 0, 90, 0, 0, 0,
        2,
        102, 105, 110, 100, 0, 5, 0, 0, 0, 117, 115, 101, 114, 0, 2, 36, 100, 98, 0, 12,
        0,
        0, 0, 98, 101, 110, 99, 104, 109, 97, 114, 107, 45, 97, 0, 16, 98, 97, 116, 99,
        104,
        83, 105, 122, 101, 0, 17, 39, 0, 0, 16, 108, 105, 109, 105, 116, 0, 1, 0, 0, 0,
        3,
        102, 105, 108, 116, 101, 114, 0, 5, 0, 0, 0, 0, 16, 115, 107, 105, 112, 0, 0, 0,
        0,
        0, 0]);
    let received = 0;
    let total_bytes = 0;
    const started = performance.now();
    let stopped = performance.now();
    let writes = 0;

    // client.on('data', (data) => {
    //     if (client.destroyed) return;
    //     client.write(message);
    //
    //     // received += data.byteLength;
    //     // while (received >= message.byteLength) {
    //     //     //when we received the complete message back, we send another one
    //     //     client.write(message);
    //     //     writes++;
    //     //     received -= message.byteLength;
    //     // }
    //
    //     total_bytes += data.byteLength;
    //     stopped = performance.now();
    // });

    client.on('error', (error) => {
        console.log('error', error);
    })

    const messages = 10000;
    let resolve: any;
    function bla(data: Buffer) {
        total_bytes += data.byteLength;
        writes++;
        resolve();
    }
    client.on('data', bla);

    for (let i = 0; i < messages; i++) {
        client.write(message);
        await new Promise((resolve2) => {
            resolve = resolve2;
        });
    }
    stopped = performance.now();
    const took = stopped - started;
    console.log('took', took);
    console.log('per message', took/messages);
    console.log('msg/s', 1000/ (took/messages));

    // await bench(10_000, 'net module', async () => {
    //     await new Promise((resolve) => {
    //         client.once('data', () => {
    //             resolve();
    //         });
    //         client.write(Buffer.alloc(2));
    //     });
    // });

    // setTimeout(() => {
    //     client.destroy();
    //
    //     const totalMessages = total_bytes / message.byteLength;
    //     console.log('Total writes:', writes);
    //     console.log('Total time:', (stopped - started), 'ms');
    //     console.log('Total data:', (total_bytes / 1024 / 1024 / 1024), 'GiB');
    //     console.log('Total messages:', (total_bytes / message.byteLength), 'msgs');
    //     console.log('Data throughput:', total_bytes / 1024 / 1024 / ((stopped - started) / 1000), 'MiB/s');
    //     console.log('Message latency:', ((stopped - started) / totalMessages).toLocaleString(undefined, {maximumFractionDigits: 16}), 'ms');
    //     console.log('Message throughput:', totalMessages / ((stopped - started) / 1000), 'msg/s');
    // }, 1*1000);
}

main()