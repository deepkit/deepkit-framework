import { BenchSuite } from "../bench";

const redis = require("redis");
const client = redis.createClient();

const { promisify } = require("util");
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const incrAsync = promisify(client.incr).bind(client);


export async function main() {

    const suite = new BenchSuite(`node-redis`, 3);

    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        created: new Date,
        ready: true,
    };

    suite.addAsync('set', async () => {
        await setAsync("key", JSON.stringify(plain));
    });

    suite.addAsync('get', async () => {
        const value = JSON.parse(await getAsync("key"));
    });

    suite.addAsync('inc', async () => {
        await incrAsync('i');
    });

    await suite.runAsync();

    client.end();
}