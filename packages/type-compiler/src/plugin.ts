import { createFilter } from '@rollup/pluginutils';
import { cwd } from 'process';
import ts from 'typescript';

import { declarationTransformer, transformer } from './compiler.js';

export interface Options {
    include?: string;
    exclude?: string;
    tsConfig?: string;
    transformers?: ts.CustomTransformers;
    compilerOptions?: ts.CompilerOptions;
    readFile?: (path: string) => string | undefined;
}

export type Transform = (code: string, fileName: string) => { code: string; map?: string } | undefined;

export function deepkitType(options: Options = {}): Transform {
    const filter = createFilter(options.include ?? ['**/*.tsx', '**/*.ts'], options.exclude ?? 'node_modules/**');

    const transformers = options.transformers || {
        before: [transformer],
        after: [declarationTransformer],
    };

    const configFilePath = options.tsConfig || cwd() + '/tsconfig.json';

    const tsConfig = ts.readConfigFile(configFilePath, options.readFile || ts.sys.readFile);

    if (tsConfig.error) {
        throw new Error(
            ts.formatDiagnostic(tsConfig.error, {
                getCanonicalFileName: (fileName: string) => fileName,
                getCurrentDirectory: ts.sys.getCurrentDirectory,
                getNewLine: () => ts.sys.newLine,
            }),
        );
    }

    const compilerOptions = Object.assign(
        {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            configFilePath,
        },
        tsConfig.config,
        options.compilerOptions || {},
    );

    return function transform(code: string, fileName: string) {
        if (!filter(fileName)) return;

        const transformed = ts.transpileModule(code, {
            compilerOptions,
            fileName,
            //@ts-ignore
            transformers,
        });

        return {
            code: transformed.outputText,
            map: transformed.sourceMapText,
        };
    };
}
