import { type BunPlugin } from 'bun';
import { cwd } from 'process';
import * as ts from 'typescript';

import { declarationTransformer, transformer } from '@deepkit/type-compiler';

export interface Options {
    include?: string;
    exclude?: string;
    tsConfig?: string;
    transformers?: ts.CustomTransformers;
    compilerOptions?: ts.CompilerOptions;
}

declare var Bun: any;

export function deepkitType(options: Options = {}): BunPlugin {
    return {
        name: 'Deepkit',
        setup(build: any) {
            const transformers = options.transformers || {
                before: [transformer],
                after: [declarationTransformer],
            };

            build.onLoad({ filter: /\.tsx?$/ }, async (args: any) => {
                const configFilePath = options.tsConfig || cwd() + '/tsconfig.json';

                const code = await Bun.file(args.path).text();
                const transformed = ts.transpileModule(code, {
                    //@ts-ignore
                    compilerOptions: Object.assign(
                        {
                            target: ts.ScriptTarget.ESNext,
                            module: ts.ModuleKind.ESNext,
                            sourceMap: false,
                            skipDefaultLibCheck: true,
                            skipLibCheck: true,
                            configFilePath,
                        },
                        options || {},
                    ),
                    fileName: args.path,
                    moduleName: args.namespace,
                    //@ts-ignore
                    transformers,
                });

                return { contents: transformed.outputText };
            });
        },
    };
}
