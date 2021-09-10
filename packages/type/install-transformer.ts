#!/usr/bin/env node

/**
 * This script installs the deepkit/type transformer (that extracts automatically types and adds the correct @t decorator) to the typescript node_modules.
 *
 * The critical section that needs adjustment is in the `function getScriptTransformers` in `node_modules/typescript/lib/tsc.js`.
 */

import { dirname, join, relative } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { cwd } from 'process';

function getCode(deepkitDistPath: string, varName: string): string {
    return `
        var typeTransformer = require('${deepkitDistPath}/src/transformer');
        if (typeTransformer) {
            if (!${varName}) ${varName} = {}
            if (!${varName}.before) ${varName}.before = []
            ${varName}.before.push(typeTransformer.transformer);
        }
    `;
}

function injectTransformerForTsc(deepkitDistPath: string, code: string): string {
    if (code.includes(deepkitDistPath)) return code;

    code = code.replace(/function getScriptTransformers\([^)]+\)\s*{/, function (a) {
        return a + '\n    ' + getCode(deepkitDistPath, 'customTransformers');
    });

    return code;
}

function injectTransformerForTypescript(deepkitDistPath: string, code: string): string {
    if (code.includes(deepkitDistPath)) return code;

    code = code.replace(/var customTransformers = (.*);/, function (a) {
        return a + '\n    ' + getCode(deepkitDistPath, 'customTransformers');
    });

    return code;
}

const typeScriptPath = dirname(require.resolve('typescript', {paths: [cwd()]}));
const deepkitDistPath = relative(typeScriptPath, __dirname);
{
    const tscContent = readFileSync(join(typeScriptPath, 'tsc.js'), 'utf8');
    writeFileSync(join(typeScriptPath, 'tsc.js'), injectTransformerForTsc(deepkitDistPath, tscContent));
}

{
    const tscContent = readFileSync(join(typeScriptPath, 'typescript.js'), 'utf8');
    writeFileSync(join(typeScriptPath, 'typescript.js'), injectTransformerForTypescript(deepkitDistPath, tscContent));
}

console.log('Deepkit Type: Injected TypeScript transformer at', typeScriptPath);
