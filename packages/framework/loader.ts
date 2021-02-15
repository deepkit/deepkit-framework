// @ts-ignore
import * as tsNode from 'ts-node/esm';
import { optimizeJSX } from '@deepkit/template';
import { inDebugMode } from '@deepkit/core';
import { importedFiles } from './src/watch';

export async function resolve(specifier: string, context: { parentURL: string }, defaultResolve: typeof resolve): Promise<{ url: string }> {
    const res = await tsNode.resolve(specifier, context, defaultResolve);
    if (res.url) {
        importedFiles.add(res.url.replace('file://', ''));
    }

    return res;
}

export function getFormat(url: any, context: any, defaultGetFormat: any) {
    return tsNode.getFormat(url, context, defaultGetFormat);
}

export async function transformSource(source: any, context: { url: string, format: string }, defaultTransformSource: any) {
    const code = await tsNode.transformSource(source, context, defaultTransformSource);
    if (inDebugMode()) return code; //we don't optimize code in debug-mode, since we break sourcemaps with it.

    if (context.url.endsWith('.tsx')) {
        if (code.source.indexOf('@deepkit/framework/jsx-runtime') === -1) return code;
        if (code.source.startsWith('#!')) {
            //allow shebang
            code.source = code.source.substr(code.source.indexOf('\n'));
        }
        const optimized = optimizeJSX(code.source);
        code.source = optimized;
    }

    return code;
}
