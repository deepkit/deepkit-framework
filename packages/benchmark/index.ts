/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {writeFileSync, mkdirSync, rmdirSync, readFileSync} from 'fs';
import {basename, dirname, join} from 'path';
import 'reflect-metadata';
import {getGlobalStore} from '@deepkit/type';
import fg from 'fast-glob';
import fetch from 'node-fetch';
import {ensureDir} from 'fs-extra';
import {spawn, spawnSync} from 'child_process';

const filter = process.argv[2] || '';

if (filter) console.log('filter by', filter);

const totalResults: { [path: string]: any } = {};
let glob = ['./src/**/*.bench.ts'];

const benchmarkPaths = fg.sync(glob, {onlyFiles: true, unique: true});
const filterRegex = filter ? new RegExp(filter.replace(/\*/, '.*')) : undefined;
const __dirname = dirname(import.meta.url.replace('file://', ''));
const resultsPath = join(__dirname, 'results');

for (const benchmarkPath of benchmarkPaths) {
    const id = benchmarkPath.substring('./src/'.length, benchmarkPath.length - '.ts'.length - '.bench'.length);

    if (filterRegex && !filterRegex.exec(id)) continue;

    console.log('🏃‍run', id);

    if (!totalResults[id]) totalResults[id] = {};

    const resultPath = join(resultsPath, 'bench', id);
    rmdirSync(resultPath, {recursive: true});
    mkdirSync(resultPath, {recursive: true});

    const script = `
        import {BenchSuite} from './src/bench';
        import {main} from '${benchmarkPath}';
        import {writeFileSync} from 'fs';
        
        BenchSuite.onComplete = function (name, result) {
            writeFileSync(${JSON.stringify(resultPath)} + '/' + name + '.json', JSON.stringify(result));
        }
        
        await main();
    `;

    spawnSync('node', ['--no-warnings', '--input-type=module', '--experimental-specifier-resolution=node', '--loader=ts-node/esm'],
        {input: script, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit']});

    const resultPaths = fg.sync(resultPath + '/*.json', {onlyFiles: true, unique: true});
    for (const path of resultPaths) {
        const result = JSON.parse(readFileSync(path).toString());
        if (!totalResults[id]) totalResults[id] = {};
        const name = basename(path).replace('.json', '');
        totalResults[id][name] = result;
    }
}

mkdirSync(resultsPath, {recursive: true});
writeFileSync(resultsPath + '/' + (new Date().toJSON()) + '.json', JSON.stringify(totalResults, undefined, 4));

const host = process.env['BENCHMARK_HOST'] || 'http://127.0.0.1:8080';
try {
    const res = await fetch(`${host}/benchmark/add`, {
        method: 'POST',
        headers: {
            'Authorization': process.env['BENCHMARK_TOKEN'] || 'notSet',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({created: new Date, data: totalResults}),
    });
    await res.json();
} catch (error) {
    console.log('error sending benchmark data', error.message);
}
