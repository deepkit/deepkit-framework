/**
 * This script installs the deepkit/type transformer (that extracts automatically types and adds the correct @t decorator) to the typescript node_modules.
 *
 * The critical section that needs adjustment is in the `function getScriptTransformers` in `node_modules/typescript/lib/tsc.js`.
 */

//@ts-ignore
import { dirname, join, relative } from 'path';
//@ts-ignore
import { readFileSync, writeFileSync } from 'fs';

function getCode(deepkitDistPath: string): string {
    return `
        var typeTransformer = require('${deepkitDistPath}/src/transformer');
        if (typeTransformer) {
            if (!customTransformers) customTransformers = {}
            if (!customTransformers.before) customTransformers.before = []
            customTransformers.before.push(typeTransformer.transformer);
        }
    `;
}

function injectTransformer(deepkitDistPath: string, code: string): string {
    if (code.includes(deepkitDistPath)) return code;

    return code.replace(/function getScriptTransformers\([^)]+\)\s*{/, function (a) {
        return a + '\n    ' + getCode(deepkitDistPath);
    });
}

//@ts-ignore
const typeScriptPath = dirname(require.resolve('typescript'));
//@ts-ignore
const deepkitDistPath = relative(typeScriptPath, __dirname);
// console.log('typeScriptPath', typeScriptPath);
// console.log('deepkitDistPath', deepkitDistPath);
// console.log('code', injectTransformer(deepkitDistPath, code));

const tscContent = readFileSync(join(typeScriptPath, 'tsc.js'), 'utf8');
writeFileSync(join(typeScriptPath, 'tsc.js'), injectTransformer(deepkitDistPath, tscContent));

console.log('Deepkit Type: Injected TypeScript transformer at', typeScriptPath);
