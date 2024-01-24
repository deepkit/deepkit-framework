import { dirname, isAbsolute, join } from 'path';
import type { CompilerOptions, ParseConfigHost } from 'typescript';
import ts from 'typescript';

import { debug, isDebug } from './debug.js';
import { patternMatch } from './resolver.js';

/**
 * Default means reflection is enabled for this file.
 * Never means the whole reflection is disabled for this file.
 * Explicit means that reflection is per default disabled for this file, but each symbol/type
 * in it is allowed to enable it using jsdoc `@reflection`.
 */
export const reflectionModes = ['default', 'explicit', 'never'] as const;
export type Mode = (typeof reflectionModes)[number];
export type RawMode = Mode | '' | boolean | string | string[] | undefined;

// don't use from @deepkit/core since we don't want to have a dependency to @deepkit/core
export function isObject(obj: any): obj is { [key: string]: any } {
    if (!obj) {
        return false;
    }
    return typeof obj === 'object' && !Array.isArray(obj);
}

const defaultMergeStrategy = 'merge';

/**
 * These are the values that can be in the tsconfig.json file.
 */
export interface TsConfigJson {
    extends?: string;
    compilerOptions?: any;

    reflection?: RawMode;

    deepkitCompilerOptions?: {
        /**
         * Either true to activate reflection for all files compiled using this tsconfig,
         * or a list of globs/file paths relative to this tsconfig.json.
         * Globs/file paths can be prefixed with a ! to exclude them.
         */
        reflection?: RawMode;

        /**
         * If a tsconfig extends another tsconfig, this option defines how the reflection/exclude
         * options are merged. The default strategy is `merge`, which means that the reflection/exclude
         * options are merged with the parent tsconfig.json. If set to `replace`, the reflection/exclude
         * options are not merged, but the parent tsconfig.json is ignored.
         */
        mergeStrategy?: 'merge' | 'replace';

        /**
         * List of globs/file paths relative to this tsconfig.json
         * which are then excluded from the type compilation step.
         * Per default a few global .d.ts files are excluded like `lib.dom*.d.ts` and `*typedarrays.d.ts`.
         */
        exclude?: string[];
    };
}

/**
 * Read config and parses under TypeScript specification.
 */
function readTsConfig(parseConfigHost: ParseConfigHost, path: string): TsConfigJson | undefined {
    const configFile = ts.readConfigFile(path, (path: string) => parseConfigHost.readFile(path));
    if (configFile.error) {
        debug(`Failed to read tsconfig ${path}: ${configFile.error.messageText}`);
        return;
    }

    const parsed = ts.parseJsonConfigFileContent(configFile.config, parseConfigHost, dirname(path));
    // errors we ignore entirely
    const ignoredErrors = [
        18003, // No inputs were found in config file.
    ];
    // errors we soft ignore but still log
    const softErrors: number[] = [
        18000, // Circularity detected while resolving configuration
    ];
    const errors = parsed.errors.filter(v => !ignoredErrors.includes(v.code));
    if (errors.length) {
        debug(`Failed to parse tsconfig ${path}: ${parsed.errors.map(v => v.messageText).join(', ')}`);
    }
    const hardErrors = errors.filter(v => !softErrors.includes(v.code));
    if (hardErrors.length) {
        return;
    }

    return Object.assign(configFile.config, {
        compilerOptions: parsed.options,
    });
}

export interface ReflectionConfig {
    /**
     * Allows to exclude type definitions/TS files from being included in the type compilation step.
     * When a global .d.ts is matched, their types won't be embedded (useful to exclude DOM for example)
     */
    exclude?: string[];

    /**
     * Either a boolean indication general reflection mode,
     * or a list of globs to match against.
     */
    reflection?: string[] | Mode;
}

export interface CurrentConfig extends ReflectionConfig {
    compilerOptions: ts.CompilerOptions;
    mergeStrategy?: 'merge' | 'replace';
    extends?: string;
}

export interface ResolvedConfig extends ReflectionConfig {
    path: string; //tsconfig path
    compilerOptions: ts.CompilerOptions;
    mergeStrategy: 'merge' | 'replace';
}

export function reflectionModeMatcher(config: ReflectionConfig, filePath: string): Mode {
    if (Array.isArray(config.exclude)) {
        if (patternMatch(filePath, config.exclude)) return 'never';
    }
    if (Array.isArray(config.reflection)) {
        return patternMatch(filePath, config.reflection) ? 'default' : 'never';
    }
    if (config.reflection === 'default' || config.reflection === 'explicit') return config.reflection;
    return 'never';
}

function ensureStringArray(value: any): string[] {
    if (Array.isArray(value)) return value.map(v => '' + v);
    if ('string' === typeof value) return [value];
    return [];
}

export function parseRawMode(mode: RawMode): string[] | Mode {
    if ('boolean' === typeof mode) return mode ? 'default' : 'never';
    if (mode === 'default' || mode === 'explicit') return mode;
    return ensureStringArray(mode);
}

function resolvePaths(baseDir: string, paths: any): void {
    if (!paths || !Array.isArray(paths)) return;

    for (let i = 0; i < paths.length; i++) {
        if ('string' !== typeof paths[i]) continue;
        if (isAbsolute(paths[i])) continue;
        let path = paths[i];
        let exclude = false;
        if (path.startsWith('!')) {
            exclude = true;
            path = path.substring(1);
        }

        // we treat as relative if it starts with ./ or contains a /
        if (path.startsWith('./') || path.includes('/')) {
            path = join(baseDir, path);
        }
        if (exclude) path = '!' + path;
        paths[i] = path;
    }
}

function appendPaths(strategy: 'merge' | 'replace' = defaultMergeStrategy, parent: string[], existing?: string[]) {
    // important to always return a new array, otherwise we would modify the parent array with subsequent calls
    if (strategy === 'replace') {
        // replace means we stick with existing if it is defined, otherwise we use parent
        return [...(existing || parent)];
    }
    if (!existing) return [...parent];
    return [...parent, ...existing];
}

function applyConfigValues(existing: CurrentConfig, parent: TsConfigJson, baseDir: string) {
    const parentReflection = isObject(parent.deepkitCompilerOptions)
        ? parent.deepkitCompilerOptions?.reflection
        : parent.reflection;

    if (isObject(parent.deepkitCompilerOptions) && 'undefined' === typeof existing.mergeStrategy) {
        existing.mergeStrategy = parent.deepkitCompilerOptions.mergeStrategy;
    }

    if ('undefined' !== typeof parentReflection) {
        const next = parseRawMode(parentReflection);
        if ('undefined' === typeof existing.reflection) {
            existing.reflection = next;
        } else if ('string' === typeof existing.reflection) {
            // if existing is already a string, there is nothing to inherit from parent
        } else if (Array.isArray(next) && Array.isArray(existing.reflection)) {
            existing.reflection = appendPaths(existing.mergeStrategy, next, existing.reflection);
        } else if ('string' === typeof next && Array.isArray(existing.reflection)) {
            // debug(`Warning: config parent tsconfig has reflection=${next}, but child tsconfig has reflection=${JSON.stringify(existing.reflection)}. reflection stays as array.`);
        }
    }

    if (isObject(parent.deepkitCompilerOptions)) {
        if (`undefined` !== typeof parent.deepkitCompilerOptions.exclude) {
            const next = ensureStringArray(parent.deepkitCompilerOptions.exclude);
            existing.exclude = appendPaths(existing.mergeStrategy, next, existing.exclude);
        }
    }

    resolvePaths(baseDir, existing.reflection);
    resolvePaths(baseDir, existing.exclude);

    if (parent.compilerOptions) {
        // typescript already correctly merges the compiler options
        if (Object.keys(existing.compilerOptions).length === 0) {
            Object.assign(existing.compilerOptions, parent.compilerOptions);
        }
    }
    existing.extends = parent.extends;
}

export interface MatchResult {
    tsConfigPath: string;
    mode: (typeof reflectionModes)[number];
}

export const defaultExcluded = [
    'lib.dom*.d.ts',
    '*typedarrays.d.ts',
    'lib.webworker*.d.ts',
    'lib.decorator*.d.ts',
    'lib.es2015.proxy.d.ts',
    'lib.es2020.sharedmemory.d.ts',
    'lib.es2015.core.d.ts',
];

export type Matcher = (path: string) => MatchResult;
export type Resolver = { match: Matcher; config: ResolvedConfig };
export type ReflectionConfigCache = { [path: string]: Resolver };

export function getResolver(
    cache: ReflectionConfigCache,
    host: ParseConfigHost,
    compilerOptions: CompilerOptions,
    sourceFile?: { fileName: string },
    tsConfigPath: string = '',
): Resolver {
    let config: CurrentConfig = {
        // We use the parameter `compilerOptions` only for compilerOptions.configFilePath.
        // We load the compilerOptions manually since transformers don't get the full picture
        // (path aliases are missing for example)
        compilerOptions: {},
    };

    //some builder do not provide the full compiler options (e.g. webpack in nx),
    //so we need to load the file manually and apply what we need.
    if ('string' === typeof compilerOptions.configFilePath) {
        tsConfigPath = compilerOptions.configFilePath;
        if (cache[tsConfigPath]) return cache[tsConfigPath];
        const configFile = readTsConfig(host, compilerOptions.configFilePath);
        if (configFile) applyConfigValues(config, configFile, dirname(compilerOptions.configFilePath));
    } else {
        if (!tsConfigPath && sourceFile) {
            //find tsconfig via sourceFile.fileName
            const baseDir = dirname(sourceFile.fileName);
            const configPath = ts.findConfigFile(baseDir, path => {
                path = isAbsolute(path) ? path : join(baseDir, path);
                return host.fileExists(path);
            });
            if (configPath) {
                //configPath might be relative to passed basedir
                tsConfigPath = isAbsolute(configPath) ? configPath : join(baseDir, configPath);
            }
        }
        if (tsConfigPath) {
            if (cache[tsConfigPath]) return cache[tsConfigPath];
            //configPath might be relative to passed basedir
            const configFile = readTsConfig(host, tsConfigPath);
            if (configFile) applyConfigValues(config, configFile, dirname(tsConfigPath));
        }
    }

    if (tsConfigPath) {
        let basePath = dirname(tsConfigPath);
        let currentConfig = config;
        const seen = new Set<string>();
        seen.add(tsConfigPath);
        //iterate through all configs (this.config.extends) until we have all reflection options found.
        while (currentConfig.extends) {
            const path = join(basePath, currentConfig.extends);
            if (seen.has(path)) break;
            seen.add(path);
            const nextConfig = ts.readConfigFile(path, (path: string) => host.readFile(path));
            if (!nextConfig) break;
            basePath = dirname(path);
            applyConfigValues(currentConfig, nextConfig.config, basePath);
        }
    }

    config.exclude = config.exclude ? [...defaultExcluded, ...config.exclude] : [...defaultExcluded];

    const resolvedConfig: ResolvedConfig = {
        path: tsConfigPath,
        compilerOptions: config.compilerOptions,
        exclude: config.exclude,
        reflection: config.reflection,
        mergeStrategy: config.mergeStrategy || defaultMergeStrategy,
    };

    if (isDebug()) {
        debug(
            `Found config ${resolvedConfig.path}:\nreflection:`,
            resolvedConfig.reflection,
            `\nexclude:`,
            resolvedConfig.exclude,
        );
    }

    const match = (path: string) => {
        const mode = reflectionModeMatcher(config, path);
        return { mode, tsConfigPath };
    };

    return (cache[tsConfigPath] = { config: resolvedConfig, match });
}

export function loadReflectionConfig(
    cache: ReflectionConfigCache,
    host: ParseConfigHost,
    compilerOptions: CompilerOptions,
    sourceFile: { fileName: string },
): MatchResult {
    const config = getResolver(cache, host, compilerOptions, sourceFile);
    return config.match(sourceFile.fileName);
}
