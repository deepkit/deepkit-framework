import * as tsNode from 'ts-node/esm';
import {optimizeJSX} from './src/template/optimize-tsx';
import {inDebugMode} from './src/utils';

export function resolve(specifier: string, context: { parentURL: string }, defaultResolve: typeof resolve): Promise<{ url: string }> {
    return tsNode.resolve(specifier, context, defaultResolve);
}

export function getFormat(url: any, context: any, defaultGetFormat: any) {
    return tsNode.getFormat(url, context, defaultGetFormat);
}

export async function transformSource(source: any, context: { url: string, format: string }, defaultTransformSource: any) {
    const code = await tsNode.transformSource(source, context, defaultTransformSource);
    if (inDebugMode()) return code; //we don't optimize code in debug-mode, since we break sourcemaps with it.

    if (context.url.endsWith('.tsx')) {
        if (code.source.indexOf('@deepkit/framework/jsx-runtime') === -1) return code;
        const optimized = optimizeJSX(code.source);
        code.source = optimized;
    }

    return code;
}
