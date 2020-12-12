import {mkdirSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';
import 'reflect-metadata';
import * as vm from 'vm';
import {getGlobalStore} from '@deepkit/type';
import fg from 'fast-glob';
import fetch from 'node-fetch';
import Module from 'module';

const filter = process.argv[2] || '';

if (filter) console.log('filter by', filter);

const totalResults: { [path: string]: any } = {};
let glob = ['./src/**/*.bench.ts'];

const benchmarkPaths = fg.sync(glob, {onlyFiles: true, unique: true});
const filterRegex = filter ? new RegExp(filter.replace(/\*/, '.*')) : undefined;

for (const benchmarkPath of benchmarkPaths) {
    const id = benchmarkPath.substring('./src/'.length, benchmarkPath.length - '.ts'.length - '.bench'.length);

    if (filterRegex && !filterRegex.exec(id)) continue;

    const onComplete = (name: string, result: { [name: string]: { hz: number, elapsed: number, rme: number, mean: number } }) => {
        if (!totalResults[id]) totalResults[id] = {};
        totalResults[id][name] = result;
    };

    // const script = new vm.Script(`require('./src/bench').BenchSuite.onComplete = onComplete; (require(benchmarkPath).main())`);
    const script = new vm.Script(`console.log('hi')
        console.log(import('./src/bench'));
    `);
    await script.runInThisContext();

    // @ts-ignore
    // const module = new vm.SourceTextModule(
    //     `
    //     import {BenchSuite} from './src/bench';
    //     // import {main} from '${benchmarkPath}';
    //
    //     console.log('${benchmarkPath}');
    //     // export const o = 'asd';
    //     // BenchSuite.onComplete = onComplete;
    //     // (main())
    //     // require('./src/bench').BenchSuite.onComplete = onComplete;
    //     // (require(benchmarkPath).main())
    //     `,
    //     {
    //         identifier: import.meta.url,
    //         initializeImportMeta(meta) {
    //             // Note: this object is created in the top context. As such,
    //             // Object.getPrototypeOf(import.meta.prop) points to the
    //             // Object.prototype in the top context rather than that in
    //             // the contextified object.
    //             meta.prop = {};
    //         }
    //     });
    // Since module has no dependencies, the linker function will never be called.
    // await module.link((spec) => import(spec));
    // await module.link(function (spec) {
    //
    //     return new Promise(async function (resolve, reject) {
    //         const mod: Module = await import( spec );
    //         // const res = new vm.Module();
    //         const names: string[] = [];
    //         for (const i in mod) {
    //             names.push(i);
    //         }
    //         // @ts-ignore
    //         const res = new vm.SyntheticModule(names);
    //
    //         for (const e of names) {
    //             res.setExport(e, mod.exports[e]);
    //         }
    //         // res.exports = mod.exports;
    //         // console.log('mod', mod);
    //         resolve(res);
    //         // resolve(new vm.SyntheticModule(['default'], function () {
    //         //     // @ts-ignore
    //         //     this.setExport('default', mod.default);
    //         // }));
    //     });
    // });
    //
    // await module.evaluate();
}
