import {mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import 'reflect-metadata';
import * as vm from 'vm';
import {getGlobalStore} from '@super-hornet/marshal';

const benchmarkPaths = [
    './src/orm/change-detection.ts',
    './src/orm/converter.ts',
    './src/framework/router/resolve.ts',
    './src/marshal/serialization/small-marshal.ts',
    './src/marshal/serialization/small-class-transformer.ts',
    './src/marshal/serialization/small-cerialize.ts',

    './src/marshal/serialization/medium-marshal.ts',
    './src/marshal/serialization/medium-class-transformer.ts',

    './src/marshal/validation/small-marshal.ts',
    './src/marshal/validation/small-io-ts.ts',
    './src/marshal/validation/small-avj.ts',
    './src/marshal/validation/small-quartet.ts',
];

const filter = process.argv[2] || '';

if (filter) console.log('filter by', filter);

async function main() {
    const totalResults: { [path: string]: any } = {};

    for (const benchmarkPath of benchmarkPaths) {
        const id = benchmarkPath.substring('./src/'.length, benchmarkPath.length - 3);

        if (filter && !id.includes(filter)) continue;
        console.log('🏃‍run', id);

        const onComplete = (name: string, benchmarks: any[]) => {
            const result: { [name: string]: any } = {};
            for (const benchmark of benchmarks) {
                result[benchmark.name] = {
                    hz: benchmark.hz,
                    elapsed: benchmark.times.elapsed,
                    rme: benchmark.stats.rme,
                    mean: benchmark.stats.mean,
                };
            }
            if (!totalResults[id]) totalResults[id] = {};
            totalResults[id][name] = result;
        };

        for (const key in require.cache) {
            delete require.cache[key];
        }
        getGlobalStore().RegisteredEntities = {};
        const script = new vm.Script(`require('@super-hornet/core').BenchSuite.onComplete = onComplete; (require(benchmarkPath).main())`);
        await script.runInNewContext({benchmarkPath, require, onComplete});
    }

    const resultsPath = join(__dirname, 'results');
    mkdirSync(resultsPath, {recursive: true});
    writeFileSync(resultsPath + '/' + (new Date().toJSON()) + '.json', JSON.stringify(totalResults, undefined, 4));
}

main();