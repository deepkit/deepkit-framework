import type {
    CompilerHost,
    CompilerOptions,
    ExportDeclaration,
    Expression,
    ImportDeclaration,
    ResolvedModule,
    SourceFile,
    StringLiteral,
} from 'typescript';
import ts from 'typescript';
import * as micromatch from 'micromatch';
import { isAbsolute, join } from 'path';

const {
    createSourceFile,
    resolveModuleName,
    isStringLiteral,
    JSDocParsingMode,
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
 * It automatically reads a SourceFile, binds and caches it.
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
        if (!isStringLiteral(moduleSpecifier)) return;

        return this.resolveSourceFile(from, moduleSpecifier);
    }

    protected resolveImpl(modulePath: StringLiteral, sourceFile: SourceFile): ResolvedModule | undefined {
        if (this.host.resolveModuleNameLiterals !== undefined) {
            const results = this.host.resolveModuleNameLiterals(
                [modulePath], sourceFile.fileName, /*reusedNames*/ undefined,
                this.compilerOptions, sourceFile, undefined
            );
            if (results[0]) return results[0].resolvedModule;
            return;
        }
        if (this.host.resolveModuleNames !== undefined) {
            return this.host.resolveModuleNames([modulePath.text], sourceFile.fileName, /*reusedNames*/ undefined, /*redirectedReference*/ undefined, this.compilerOptions)[0];
        }
        const result = resolveModuleName(modulePath.text, sourceFile.fileName, this.compilerOptions, this.host);
        return result.resolvedModule;
    }

    /**
     * Tries to resolve the .ts/d.ts file path for a given module path.
     * Scans relative paths. Looks into package.json "types" and "exports" (with new 4.7 support)
     *
     * @param sourceFile the SourceFile of the file that contains the import. modulePath is relative to that.
     * @param modulePath the x in 'from x'.
     */
    resolveSourceFile(sourceFile: SourceFile, modulePath: StringLiteral): SourceFile | undefined {
        const result = this.resolveImpl(modulePath, sourceFile);
        if (!result) return;

        // only .ts and .d.ts files are supported
        if (!result.resolvedFileName.endsWith('.ts') && !result.resolvedFileName.endsWith('.d.ts')) {
            return;
        }

        const fileName = result.resolvedFileName;
        if (this.sourceFiles[fileName]) return this.sourceFiles[fileName];

        const source = this.host.readFile(result.resolvedFileName);
        if (!source) return;
        const moduleSourceFile = this.sourceFiles[fileName] = createSourceFile(fileName, source, {
            languageVersion: this.compilerOptions.target || ScriptTarget.ES2018,
            jsDocParsingMode: JSDocParsingMode.ParseNone,
        }, true);

        this.sourceFiles[fileName] = moduleSourceFile;

        //@ts-ignore
        ts.bindSourceFile(moduleSourceFile, this.compilerOptions);

        return moduleSourceFile;
    }
}
