import {performance} from 'perf_hooks';
import {Exchange} from '../src/exchange/exchange';
import {ExchangeConfig} from '../src/exchange/exchange.config';

(async () => {
    {
        const client = new Exchange(ExchangeConfig.forUrl('/tmp/super-hornet-lock-benchmark'));
        await client.connect();

        const start = performance.now();

        const count = 1_000;
        for (let i = 0; i < count; i++) {
            const lock1 = await client.lock('test-perf-' + i);
            await lock1.unlock();
        }

        //0.0035 takes native lock per item
        //this takes 0.102, that's the price of communicating via webSockets
        console.log(count, 'sequential locks took', performance.now() - start, 'ms', count * (1000 / (performance.now() - start)), 'op/s');
        await client.disconnect();
    }

    {
        const client = new Exchange(ExchangeConfig.forUrl('/tmp/super-hornet-lock-benchmark'));
        await client.connect();
        const start = performance.now();

        const count = 1_000;
        const all: Promise<void>[] = [];
        for (let i = 0; i < count; i++) {
            all.push(client.lock('test-perf-' + i).then((v) => {
                return v.unlock();
            }));
        }

        await Promise.all(all);
        console.log(count, 'concurrent locks took', performance.now() - start, 'ms', count * (1000 / (performance.now() - start)), 'op/s');
        await client.disconnect();
    }
})();
