import { existsSync } from 'fs';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'path';

import { transpile } from './shared.js';

async function resolveTs(specifier: string, context: any, nextResolve: Function) {
    // Try .ts extension for .js imports or extensionless imports
    const variants = extname(specifier) === '.js' ? [specifier.replace(/\.js$/, '.ts')] : [`${specifier}.ts`];

    for (const tsSpecifier of variants) {
        try {
            const url = new URL(tsSpecifier, context.parentURL);
            await stat(url);
            return nextResolve(url.toString(), context);
        } catch {}
    }

    return nextResolve(specifier, context);
}

export async function resolve(specifier: string, context: any, defaultResolve: Function) {
    return resolveTs(specifier, context, defaultResolve);
}

export async function load(url: string, context: any, nextLoad: Function) {
    if (extname(url) === '.ts') {
        const path = new URL(url).pathname;
        const source = await readFile(path, 'utf8');
        const { output, format } = transpile(source, path);
        return { format, source: output, shortCircuit: true };
    }
    return nextLoad(url);
}
