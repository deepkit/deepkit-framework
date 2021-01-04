import { asyncOperation } from "@deepkit/core";
import { BenchSuite } from "../bench";


export async function main() {

    const bench = new BenchSuite('asyncOperation');

    bench.addAsync('new Promise', async () => {
        await new Promise((resolve) => {
            resolve(undefined);
        });
    });

    bench.addAsync('asyncOperation', async () => {
        await asyncOperation((resolve) => {
            resolve(undefined);
        });
    });

    await bench.runAsync();
}