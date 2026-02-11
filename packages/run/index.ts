import { existsSync, readFileSync } from 'fs';
import { register } from 'node:module';
import Module from 'node:module';

import { transpile } from './shared.js';

// Hook CJS resolution to try .ts when .js not found
// @ts-ignore
const originalResolveFilename = Module._resolveFilename;
// @ts-ignore
Module._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    try {
        return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND' && request.endsWith('.js')) {
            const tsRequest = request.replace(/\.js$/, '.ts');
            try {
                return originalResolveFilename.call(this, tsRequest, parent, isMain, options);
            } catch {
                // Fall through to original error
            }
        }
        throw e;
    }
};

// CJS extension handler for require() calls - always outputs CommonJS
// @ts-ignore
Module._extensions['.ts'] = function (module: any, filename: string) {
    const source = readFileSync(filename, 'utf8');
    const { output } = transpile(source, filename, 'commonjs');
    module._compile(output, filename);
};

// @ts-ignore
Module._extensions['.tsx'] = function (module: any, filename: string) {
    const source = readFileSync(filename, 'utf8');
    const { output } = transpile(source, filename, 'commonjs');
    module._compile(output, filename);
};

// ESM loader hooks for import statements
// @ts-ignore
register('./hooks.js', import.meta.url);
