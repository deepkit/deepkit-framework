// import {urlToRequest} from 'loader-utils';
import * as ts from 'typescript';
import { CompilerOptions, createCompilerHost, createSourceFile, ScriptTarget, SourceFile, TransformationContext } from 'typescript';
import { ReflectionTransformer } from './compiler.js';
import ScriptKind = ts.ScriptKind;

export class DeepkitLoader {
    protected options: CompilerOptions = {
        allowJs: true,
        declaration: false,
    };

    protected host = createCompilerHost(this.options);

    protected program = ts.createProgram([], this.options, this.host);

    protected printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    protected knownFiles: { [path: string]: string } = {};
    protected sourceFiles: { [path: string]: SourceFile } = {};

    constructor() {
        const originReadFile = this.host.readFile;
        this.host.readFile = (fileName: string) => {
            if (this.knownFiles[fileName]) return this.knownFiles[fileName];
            return originReadFile.call(this.host, fileName);
        };

        //the program should not write any files
        this.host.writeFile = () => {
        };

        const originalGetSourceFile = this.host.getSourceFile;
        this.host.getSourceFile = (fileName: string, languageVersion: ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): SourceFile | undefined => {
            if (this.sourceFiles[fileName]) return this.sourceFiles[fileName];
            return originalGetSourceFile.call(this.host, fileName, languageVersion, onError, shouldCreateNewSourceFile);
        };
    }

    transform(source: string, path: string): string {
        this.knownFiles[path] = source;
        const sourceFile = createSourceFile(path, source, ScriptTarget.ESNext, true, path.endsWith('.tsx') ? ScriptKind.TSX : ScriptKind.TS);
        let newSource = source;

        ts.transform(sourceFile, [
            (context: TransformationContext) => {
                const transformer = new ReflectionTransformer(context).forHost(this.host).withReflectionMode('always');
                return (node: SourceFile): SourceFile => {
                    const sourceFile = transformer.transformSourceFile(node);

                    newSource = this.printer.printNode(ts.EmitHint.SourceFile, sourceFile, sourceFile);
                    return sourceFile;
                };
            }
        ], this.options);

        return newSource;
    }
}
