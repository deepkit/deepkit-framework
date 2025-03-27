import { ModuleKind, readConfigFile, ScriptTarget, transpile } from 'typescript';
import { existsSync, readFileSync } from 'fs';
import { dirname, extname } from 'path';
import { readFile, stat } from 'node:fs/promises';

let tsConfigPath = 'tsconfig.json';
let currentPath = process.cwd();

while (currentPath !== '/') {
    const path = `${currentPath}/tsconfig.json`;
    if (existsSync(path)) {
        tsConfigPath = path;
        break;
    }
    const next = dirname(currentPath);
    if (next === currentPath) break;
    currentPath = next;
}

const tsConfig = readConfigFile(tsConfigPath, (path) => readFileSync(path, 'utf8'));
const tsConfigNormalized = Object.assign({}, tsConfig?.config.compilerOptions || {}, {
    module: ModuleKind.ES2022, // Keep as ESNext for ESM support
    target: ScriptTarget.ES2022, // Transpile to ES2020+ for modern ESM support
    configFilePath: tsConfigPath,
    sourceMap: true,
});

async function tryResolveTs(specifier, context, nextResolve) {
    if (extname(specifier) === '.js') {
        const tsSpecifier = specifier.replace(/\.js$/, '.ts');
        try {
            // Check if the .ts file exists before resolving
            await stat(new URL(tsSpecifier, context.parentURL));
            return nextResolve(tsSpecifier, context);
        } catch {
            // If no .ts file is found, fall back to the default resolution
        }
    }
    if (extname(specifier) === '.ts') {
        return { url: specifier, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}

export async function resolve(specifier, context, defaultResolve) {
    return tryResolveTs(specifier, context, defaultResolve);
}

export async function load(url, context, nextLoad) {
    if (extname(url) === '.ts') {
        const path = new URL(url).pathname;
        const source = await readFile(path, 'utf8');
        const transpiled = transpile(source, tsConfigNormalized, path);
        return { format: 'module', source: transpiled, shortCircuit: true };
    }
    return nextLoad(url);
}
