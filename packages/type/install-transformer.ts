#!/usr/bin/env node

/**
 * This script installs the deepkit/type transformer (that extracts automatically types and adds the correct @t decorator) to the typescript node_modules.
 *
 * The critical section that needs adjustment is in the `function getScriptTransformers` in `node_modules/typescript/lib/tsc.js`.
 */

import { dirname, join, relative } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const to = process.argv[2] || process.cwd();

function getPatchId(id: string): string{
     return 'deepkit_type_patch_' + id;
}

function getCode(deepkitDistPath: string, varName: string, id: string): string {
    return `
        //${getPatchId(id)}
        var typeTransformer = require('${deepkitDistPath}/src/transformer');
        if (typeTransformer) {
            if (!${varName}) ${varName} = {};
            if (!${varName}.before) ${varName}.before = [];
            if (!${varName}.before.includes(typeTransformer.transformer)) ${varName}.before.push(typeTransformer.transformer);
        }
    `;
}

function isPatched(code: string, id: string) {
    return code.includes(getPatchId(id));
}

function patchGetScriptTransformers(deepkitDistPath: string, code: string): string {
    const id = 'patchGetScriptTransformers';
    if (isPatched(code, id)) return code;

    code = code.replace(/function getScriptTransformers\([^)]+\)\s*{/, function (a) {
        return a + '\n    ' + getCode(deepkitDistPath, 'customTransformers', id);
    });

    return code;
}

function patchCustomTransformers(deepkitDistPath: string, code: string): string {
    const id = 'patchCustomTransformers';
    if (isPatched(code, id)) return code;

    code = code.replace(/var customTransformers = (.*);/, function (a) {
        return a + '\n    ' + getCode(deepkitDistPath, 'customTransformers', id);
    });

    return code;
}

const typeScriptPath = dirname(require.resolve('typescript', {paths: [to]}));
const deepkitDistPath = relative(typeScriptPath, __dirname);

{
    let tscContent = readFileSync(join(typeScriptPath, 'tsc.js'), 'utf8');
    tscContent = patchGetScriptTransformers(deepkitDistPath, tscContent)
    tscContent = patchCustomTransformers(deepkitDistPath, tscContent)
    writeFileSync(join(typeScriptPath, 'tsc.js'), tscContent);
}

{
    let tscContent = readFileSync(join(typeScriptPath, 'typescript.js'), 'utf8');
    tscContent = patchGetScriptTransformers(deepkitDistPath, tscContent)
    tscContent = patchCustomTransformers(deepkitDistPath, tscContent)
    writeFileSync(join(typeScriptPath, 'typescript.js'), tscContent);
}

console.log('Deepkit Type: Injected TypeScript transformer at', typeScriptPath);
