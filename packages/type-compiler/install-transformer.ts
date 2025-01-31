#!/usr/bin/env node

/**
 * This script installs the deepkit/type transformer (that extracts automatically types and adds the correct @t decorator) to the typescript node_modules.
 *
 * The critical section that needs adjustment is in the `function getScriptTransformers` in `node_modules/typescript/lib/tsc.js`.
 */

import { dirname, join, relative } from 'path';
import { readFileSync, writeFileSync } from 'fs';

let to = process.argv[2] || process.cwd();

function getPatchId(id: string): string {
    return 'deepkit_type_patch_' + id;
}

function getCode(deepkitDistPath: string, varName: string, id: string): string {
    return `
        //${getPatchId(id)}
        try {
            var typeTransformer;
            try {
                typeTransformer = require('@deepkit/type-compiler');
            } catch (error) {
                typeTransformer = require(${JSON.stringify(deepkitDistPath)});
            }
            if (typeTransformer) {
                if (!customTransformers) ${varName} = {};
                if (!${varName}.before) ${varName}.before = [];
                let alreadyPatched = false;
                for (let fn of ${varName}.before) {
                    if (fn && fn.name === 'deepkitTransformer') alreadyPatched = true;
                }
                if (!alreadyPatched) {
                    if (!${varName}.before.includes(typeTransformer.transformer)) ${varName}.before.push(typeTransformer.transformer);

                    if (!${varName}.afterDeclarations) ${varName}.afterDeclarations = [];
                    if (!${varName}.afterDeclarations.includes(typeTransformer.declarationTransformer)) {
                        ${varName}.afterDeclarations.push(typeTransformer.declarationTransformer);
                    }
                }
            }
        } catch (e) {
        }
        //${getPatchId(id)}-end
    `;
}

function isPatched(code: string, id: string) {
    return code.includes(getPatchId(id));
}

function patchGetTransformers(deepkitDistPath: string, code: string): string {
    const id = 'patchGetTransformers';
    if (isPatched(code, id)) return code;

    code = code.replace(/function getTransformers\([^)]+\)\s*{/, function (a) {
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

if (to + '/dist/cjs' === __dirname) {
    to = join(to, '..'); //we exclude type-compiler/node_modules
}

const typeScriptPath = dirname(require.resolve('typescript', { paths: [to] }));
const deepkitDistPath = relative(typeScriptPath, __dirname);

{
    let tscContent = readFileSync(join(typeScriptPath, 'tsc.js'), 'utf8');
    tscContent = patchGetTransformers(deepkitDistPath, tscContent);
    writeFileSync(join(typeScriptPath, 'tsc.js'), tscContent);
}

{
    let tscContent = readFileSync(join(typeScriptPath, 'typescript.js'), 'utf8');
    tscContent = patchGetTransformers(deepkitDistPath, tscContent); //this breaks source-maps, since ts-jest loads the transformer then twice
    // tscContent = patchCustomTransformers(deepkitDistPath, tscContent)
    writeFileSync(join(typeScriptPath, 'typescript.js'), tscContent);
}

console.log('Deepkit Type: Injected TypeScript transformer at', typeScriptPath);
