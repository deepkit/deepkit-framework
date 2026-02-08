import type { CompilerOptions, SourceFile, TransformationContext } from 'typescript';
import ts from 'typescript';

import { Cache, ReflectionTransformer } from './compiler.js';
import { type Mode } from './config.js';

export interface DeepkitLoaderOptions {
    /**
     * Path to tsconfig.json. If not provided, will search from file's directory.
     */
    tsConfig?: string;

    /**
     * Override reflection mode. If not set, uses tsconfig's reflection option.
     * Set to 'default' to enable reflection for all files regardless of tsconfig.
     * Useful for simple projects without explicit tsconfig reflection configuration.
     */
    reflection?: Mode;

    /**
     * Additional compiler options to merge with defaults.
     */
    compilerOptions?: CompilerOptions;
}

/**
 * A loader for transforming TypeScript files with Deepkit type reflection.
 *
 * Designed for use with bundlers like Vite, Bun, esbuild, etc.
 *
 * @example
 * ```ts
 * // Simple usage - enables reflection for all files
 * const loader = new DeepkitLoader({ reflection: 'default' });
 * const output = loader.transform(code, '/path/to/file.ts');
 * ```
 *
 * @example
 * ```ts
 * // Respect tsconfig.json settings
 * const loader = new DeepkitLoader({ tsConfig: './tsconfig.json' });
 * const output = loader.transform(code, '/path/to/file.ts');
 * ```
 */
export class DeepkitLoader {
    protected options: CompilerOptions;
    protected host: ts.CompilerHost;
    protected printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    protected cache = new Cache();
    protected knownFiles: { [path: string]: string } = {};
    protected sourceFiles: { [path: string]: SourceFile } = {};
    protected loaderOptions: DeepkitLoaderOptions;

    constructor(options: DeepkitLoaderOptions = {}) {
        this.loaderOptions = options;

        this.options = {
            allowJs: true,
            declaration: false,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            ...options.compilerOptions,
        };

        // Set configFilePath if tsConfig is provided
        if (options.tsConfig) {
            this.options.configFilePath = options.tsConfig;
        }

        this.host = ts.createCompilerHost(this.options);

        const originReadFile = this.host.readFile;
        this.host.readFile = (fileName: string) => {
            if (this.knownFiles[fileName]) return this.knownFiles[fileName];
            return originReadFile.call(this.host, fileName);
        };

        // The program should not write any files
        this.host.writeFile = () => {};

        const originalGetSourceFile = this.host.getSourceFile;
        this.host.getSourceFile = (
            fileName: string,
            languageVersion: ts.ScriptTarget,
            onError?: (message: string) => void,
            shouldCreateNewSourceFile?: boolean,
        ): SourceFile | undefined => {
            if (this.sourceFiles[fileName]) return this.sourceFiles[fileName];
            return originalGetSourceFile.call(this.host, fileName, languageVersion, onError, shouldCreateNewSourceFile);
        };
    }

    /**
     * Transform a TypeScript source file with Deepkit type reflection.
     *
     * @param source - The TypeScript source code
     * @param path - Absolute path to the file (required for cross-file type resolution)
     * @returns The transformed JavaScript code
     */
    transform(source: string, path: string): string {
        this.knownFiles[path] = source;
        const sourceFile = ts.createSourceFile(
            path,
            source,
            ts.ScriptTarget.ESNext,
            true,
            path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        this.sourceFiles[path] = sourceFile;

        let newSource = source;

        ts.transform(
            sourceFile,
            [
                (context: TransformationContext) => {
                    const transformer = new ReflectionTransformer(context, this.cache).forHost(this.host);

                    // Only override reflection if explicitly set in options
                    // Otherwise, let the transformer use tsconfig's reflection setting
                    if (this.loaderOptions.reflection) {
                        transformer.withReflection({ reflection: this.loaderOptions.reflection });
                    }

                    return (node: SourceFile): SourceFile => {
                        const transformedFile = transformer.transformSourceFile(node);
                        newSource = this.printer.printNode(ts.EmitHint.SourceFile, transformedFile, transformedFile);
                        return transformedFile;
                    };
                },
            ],
            this.options,
        );

        return newSource;
    }
}
