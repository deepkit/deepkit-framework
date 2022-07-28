import * as ts from 'typescript';
import {
    CompilerHost,
    CompilerOptions,
    createSourceFile,
    ExportDeclaration,
    Expression,
    ImportDeclaration,
    resolveModuleName,
    ResolvedModule,
    ScriptTarget,
    SourceFile,
    StringLiteral,
    SyntaxKind
} from 'typescript';

/**
 * A utility to resolve a module path and its declaration.
 *
 * It automatically reads a SourceFile and binds it.
 */
export class Resolver {
    protected sourceFiles: { [fileName: string]: SourceFile } = {};

    constructor(public compilerOptions: CompilerOptions, public host: CompilerHost) {
    }

    resolve(from: SourceFile, importOrExportNode: ExportDeclaration | ImportDeclaration): SourceFile | undefined {
        const moduleSpecifier: Expression | undefined = importOrExportNode.moduleSpecifier;
        if (!moduleSpecifier) return;
        if (moduleSpecifier.kind !== SyntaxKind.StringLiteral) return;

        return this.resolveSourceFile(from.fileName, (moduleSpecifier as StringLiteral).text);
    }

    resolveImpl(modulePath: string, fromPath: string): ResolvedModule | undefined {
        if (this.host.resolveModuleNames !== undefined) {
            return this.host.resolveModuleNames([modulePath], fromPath, /*reusedNames*/ undefined, /*redirectedReference*/ undefined, this.compilerOptions)[0];
        }
        const result = resolveModuleName(modulePath, fromPath, this.compilerOptions, this.host);
        return result.resolvedModule;
    }

    /**
     * Tries to resolve the d.ts file path for a given module path.
     * Scans relative paths. Looks into package.json "types" and "exports" (with new 4.7 support)
     *
     * @param fromPath the path of the file that contains the import. modulePath is relative to that.
     * @param modulePath the x in 'from x'.
     */
    resolveSourceFile(fromPath: string, modulePath: string): SourceFile | undefined {
        const result = this.resolveImpl(modulePath, fromPath);
        if (!result) return;

        const fileName = result.resolvedFileName;
        if (this.sourceFiles[fileName]) return this.sourceFiles[fileName];

        const source = this.host.readFile(result.resolvedFileName);
        if (!source) return;
        const sourceFile = this.sourceFiles[fileName] = createSourceFile(fileName, source, this.compilerOptions.target || ScriptTarget.ES2018, true);

        //@ts-ignore
        ts.bindSourceFile(sourceFile, this.compilerOptions);

        return sourceFile;
    }
}
