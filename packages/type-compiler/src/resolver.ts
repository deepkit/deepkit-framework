import type { CompilerHost, CompilerOptions, ExportDeclaration, Expression, ImportDeclaration, ResolvedModule, SourceFile, StringLiteral } from 'typescript';
import ts from 'typescript';
import * as micromatch from 'micromatch';
import { isAbsolute, join } from 'path';

const {
    createSourceFile,
    resolveModuleName,
    SyntaxKind,
    ScriptTarget,
} = ts;

export function patternMatch(path: string, patterns: string[], base?: string) {
    const normalized = patterns.map(v => {
        if (v[0] === '!') {
            if (base && !isAbsolute(v.slice(1))) return '!' + join(base || '', v.substr(1));
            return v;
        }

        if (!isAbsolute(v)) return join(base || '', v);
        return v;
    });
    const matched = micromatch.default([path], normalized, {});
    return matched.length > 0;
}

/**
 * A utility to resolve a module path and its declaration.
 *
 * It automatically reads a SourceFile and binds it.
 */
export class Resolver {
    constructor(
        public compilerOptions: CompilerOptions,
        public host: CompilerHost,
        protected sourceFiles: { [fileName: string]: SourceFile }
    ) {
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
