import {mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import 'reflect-metadata';
import * as vm from 'vm';
import {getGlobalStore} from '@super-hornet/marshal';
const fg = require('fast-glob');

const filter = process.argv[2] || '';

if (filter) console.log('filter by', filter);

async function main() {
    const totalResults: { [path: string]: any } = {};
    let glob = ['./src/**/*.bench.ts'];

    const benchmarkPaths = fg.sync(glob, {onlyFiles: true, unique: true});
    const filterRegex = filter ? new RegExp(filter.replace(/\*/, '.*')) : undefined;

    for (const benchmarkPath of benchmarkPaths) {
        const id = benchmarkPath.substring('./src/'.length, benchmarkPath.length - 3);

        if (filterRegex && !filterRegex.exec(id)) continue;

        console.log('🏃‍run', id);

        const onComplete = (name: string, result: { [name: string]: { hz: number, elapsed: number, rme: number, mean: number } }) => {
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