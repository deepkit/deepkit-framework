import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import 'reflect-metadata';
import * as vm from 'vm';
import fetch from 'node-fetch';
import { classToPlain, getGlobalStore } from '@deepkit/type';
import { BenchmarkRun } from './model';
import * as si from 'systeminformation';
import { execSync } from 'child_process';

const fg = require('fast-glob');

const filters = process.argv.slice(2)
    .map(v => v.startsWith('src/') ? v.substr(4) : v)
    .map(v => v.endsWith('.bench.ts') ? v.slice(0, -'.bench.ts'.length) : v)
    .map(v => v.replace(/\*/, '.*'))
    .map(v => new RegExp(v));

const sendResultsTo = process.env.SEND_TO || '';

if (filters.length) console.log('filter by', filters);

async function main() {
    const totalResults: { [path: string]: any } = {};
    let glob = ['./src/**/*.bench.(ts|tsx)'];

    const benchmarkPaths = fg.sync(glob, { onlyFiles: true, unique: true });

    for (const benchmarkPath of benchmarkPaths) {
        const id = benchmarkPath.substring('./src/'.length, benchmarkPath.length - '.ts'.length - '.bench'.length);

        if (filters.length) {
            let found = false;
            for (const filter of filters) {
                if (filter.exec(id)) {
                    found = true;
                    break;
                }
            }
            if (!found) continue;
        }

        console.log('🏃‍run', id);

        const onComplete = (name: string, result: { [name: string]: { hz: number, elapsed: number, rme: number, mean: number } }) => {
            totalResults[id] = result;
        };

        for (const key in require.cache) {
            delete require.cache[key];
        }
        getGlobalStore().RegisteredEntities = {};
        try {
            const script = new vm.Script(`require('./src/bench').BenchSuite.onComplete = onComplete; (require(benchmarkPath).main())`);
            await script.runInNewContext({ benchmarkPath, require, onComplete });
        } catch (error) {
            console.log('Benchmark errored', error);
        }
    }

    const resultsPath = join(__dirname, 'results');
    mkdirSync(resultsPath, { recursive: true });
    writeFileSync(resultsPath + '/' + (new Date().toJSON()) + '.json', JSON.stringify(totalResults, undefined, 4));

    if (sendResultsTo) {
        console.log('Send to' + sendResultsTo);

        const benchmarkRun = new BenchmarkRun;
        benchmarkRun.data = totalResults;
        const cpu = await si.cpu();
        const mem = await si.mem();
        benchmarkRun.cpuName = cpu.manufacturer + ' ' + cpu.brand;
        benchmarkRun.cpuClock = cpu.speed;
        benchmarkRun.cpuCores = cpu.cores;
        benchmarkRun.memoryTotal = mem.total;

        const os = await si.osInfo();
        benchmarkRun.os = `${os.platform} ${os.distro} ${os.release} ${os.kernel} ${os.arch}`;
        benchmarkRun.commit = execSync('git rev-parse HEAD').toString('utf8').trim();

        await fetch(sendResultsTo, {
            method: 'POST',
            headers: {
                'authorization': process.env.AUTH_TOKEN || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify(classToPlain(BenchmarkRun, benchmarkRun)),
        });
    }
}

main().catch(console.error);
