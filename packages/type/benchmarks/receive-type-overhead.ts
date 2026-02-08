/**
 * Benchmark: ReceiveType overhead measurement
 *
 * Run with: cd packages/type && node --import @deepkit/run benchmarks/receive-type-overhead.ts
 */
import { BenchSuite } from '@deepkit/bench';

import { ReceiveType, deserialize, resolveReceiveType, serialize } from '../index.js';
import { typeOf } from '../src/reflection/reflection.js';

interface Simple {
    name: string;
}

const plainData = { name: 'test' };

function myReceiveType<T>(type?: ReceiveType<T>) {
    return resolveReceiveType(type);
}

const simpleInstance = deserialize<Simple>(plainData);
serialize<Simple>(simpleInstance);
typeOf<Simple>();
myReceiveType<Simple>();
myReceiveType<string>();
myReceiveType<number>();

async function main() {
    const suite = new BenchSuite('type/receive-type-overhead');

    suite.add('serialize<Simple>(data)', () => {
        serialize<Simple>(plainData);
    });
    suite.add('deserialize<Simple>(data)', () => {
        deserialize<Simple>(plainData);
    });
    suite.add('typeOf<Simple>()', () => {
        typeOf<Simple>();
    });
    suite.add('myReceiveType<Simple>()', () => {
        myReceiveType<Simple>();
    });
    suite.add('myReceiveType<string>()', () => {
        myReceiveType<string>();
    });
    suite.add('myReceiveType<number>()', () => {
        myReceiveType<number>();
    });
    suite.add('alternating myReceiveType<string|number>', () => {
        myReceiveType<string>();
        myReceiveType<number>();
    });

    await suite.run();
}

main();
