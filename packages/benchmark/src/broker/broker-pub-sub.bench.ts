import { BrokerDirectClient, BrokerKernel } from "@deepkit/broker";
import { sleep } from "@deepkit/core";
import { t } from "@deepkit/type";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const schema = t.schema({ v: t.number });

    const bench = new BenchSuite('broker');

    let count = 0;
    await client.subscribe('id', schema, (next) => { count++; });

    bench.addAsync('publish subscribed', async () => {
        await client.publish('id', schema, { v: 123 });
    });

    await bench.runAsync();
    console.log('called', count);
}