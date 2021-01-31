import { BrokerClient } from "@deepkit/broker";
import { TcpRpcClientAdapter } from "@deepkit/rpc-tcp";
import { t } from "@deepkit/type";
import { BenchSuite } from "../bench";

class Model {
    @t ready?: boolean;

    @t.array(String) tags: string[] = [];

    @t priority: number = 0;
    @t created: Date = new Date;

    constructor(
        @t public id: number,
        @t public name: string
    ) {
    }
}

export async function main() {
    // const server = new TcpRpcServer(new BrokerKernel(), 'localhost:55552');
    // server.start();

    const tcpAdapter = new TcpRpcClientAdapter('localhost:55552');
    const client = new BrokerClient(tcpAdapter);

    const schema = t.schema({
        v: t.boolean
    });

    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        created: new Date,
        ready: true,
    };

    const key = client.key('key', Model);

    const suite = new BenchSuite('tcp-broker', 3);
    suite.addAsync('set', async () => {
        await key.set(plain);
    });

    suite.addAsync('get', async () => {
        await key.get();
    });

    suite.addAsync('increase', async () => {
        await client.increment('i');
    });

    await suite.runAsync();

    client.disconnect();
    // server.close();
}
