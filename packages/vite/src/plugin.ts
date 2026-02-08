import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import { DeepkitLoader, type DeepkitLoaderOptions } from '@deepkit/type-compiler';

export interface Options {
    /**
     * Glob patterns to include. Defaults to ['**\/*.tsx', '**\/*.ts']
     */
    include?: string | string[];

    /**
     * Glob patterns to exclude. Defaults to 'node_modules/**'
     */
    exclude?: string | string[];

    /**
     * Path to tsconfig.json. If not provided, will search from project root.
     */
    tsConfig?: string;

    /**
     * Override reflection mode. If not set, uses tsconfig's reflection option.
     * Set to 'default' to enable reflection for all files regardless of tsconfig.
     * Useful for simple projects without explicit tsconfig reflection configuration.
     */
    reflection?: DeepkitLoaderOptions['reflection'];
}

/**
 * Vite plugin for Deepkit type reflection.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { deepkitType } from '@deepkit/vite';
 *
 * export default {
 *   plugins: [
 *     // Simple usage - enables reflection for all files
 *     deepkitType({ reflection: 'default' })
 *   ]
 * }
 * ```
 *
 * @example
 * ```ts
 * // vite.config.ts - respect tsconfig.json settings
 * import { deepkitType } from '@deepkit/vite';
 *
 * export default {
 *   plugins: [
 *     deepkitType({ tsConfig: './tsconfig.json' })
 *   ]
 * }
 * ```
 */
export function deepkitType(options: Options = {}): Plugin {
    const filter = createFilter(options.include ?? ['**/*.tsx', '**/*.ts'], options.exclude ?? 'node_modules/**');

    const loader = new DeepkitLoader({
        tsConfig: options.tsConfig,
        reflection: options.reflection,
    });

    return {
        name: 'deepkit-type',
        enforce: 'pre',
        transform(code: string, fileName: string) {
            if (!filter(fileName)) return null;

            const transformed = loader.transform(code, fileName);

            return {
                code: transformed,
                map: null,
            };
        },
    };
}
