import { type BunPlugin } from 'bun';

import { DeepkitLoader, type DeepkitLoaderOptions } from '@deepkit/type-compiler';

export interface Options {
    /**
     * Glob pattern to include. Defaults to matching .ts and .tsx files.
     */
    include?: RegExp;

    /**
     * Glob pattern to exclude.
     */
    exclude?: RegExp;

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

declare var Bun: any;

/**
 * Bun plugin for Deepkit type reflection.
 *
 * @example
 * ```ts
 * // bunfig.toml or build script
 * import { deepkitType } from '@deepkit/bun';
 *
 * Bun.build({
 *   plugins: [
 *     // Simple usage - enables reflection for all files
 *     deepkitType({ reflection: 'default' })
 *   ]
 * });
 * ```
 *
 * @example
 * ```ts
 * // Respect tsconfig.json settings
 * import { deepkitType } from '@deepkit/bun';
 *
 * Bun.build({
 *   plugins: [
 *     deepkitType({ tsConfig: './tsconfig.json' })
 *   ]
 * });
 * ```
 */
export function deepkitType(options: Options = {}): BunPlugin {
    const loader = new DeepkitLoader({
        tsConfig: options.tsConfig,
        reflection: options.reflection,
    });

    const includePattern = options.include ?? /\.tsx?$/;
    const excludePattern = options.exclude;

    return {
        name: 'Deepkit',
        setup(build: any) {
            build.onLoad({ filter: includePattern }, async (args: any) => {
                // Skip if excluded
                if (excludePattern && excludePattern.test(args.path)) {
                    return;
                }

                const code = await Bun.file(args.path).text();
                const transformed = loader.transform(code, args.path);

                return { contents: transformed };
            });
        },
    };
}
