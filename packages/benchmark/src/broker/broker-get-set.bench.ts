import { BrokerDirectClient, BrokerKernel } from "@deepkit/broker";
import { t } from "@deepkit/type";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const bench = new BenchSuite('broker');

    bench.addAsync('set', async () => {
        await client.set('id', schema, { v: 123 });
    });

    bench.addAsync('get', async () => {
        const v = await client.getOrUndefined('id', schema);
    });

    bench.addAsync('get undefined', async () => {
        const v = await client.getOrUndefined('id-unknown', schema);
    });

    bench.addAsync('increment', async () => {
        await client.increment('inc1', 2);
    });

    bench.addAsync('increment get', async () => {
        const v = await client.getIncrement('inc1');
    });

    await bench.runAsync();
}