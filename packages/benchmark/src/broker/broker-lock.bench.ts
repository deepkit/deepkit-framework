import { BrokerDirectClient, BrokerKernel } from "@deepkit/broker";
import 'reflect-metadata';
import { BenchSuite } from "../bench";

export async function main() {
    const kernel = new BrokerKernel();
    const client = new BrokerDirectClient(kernel);

    const bench = new BenchSuite('broker');

    bench.addAsync('lock', async () => {
        const lock = await client.lock('id');
        await lock.unsubscribe();
    });

    await bench.runAsync();
}