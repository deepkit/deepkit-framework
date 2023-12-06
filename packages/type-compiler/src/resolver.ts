import type {
    CompilerHost,
    CompilerOptions,
    ExportDeclaration,
    Expression,
    ImportDeclaration,
    ResolvedModuleFull,
    SourceFile,
    StringLiteral,
} from 'typescript';
import ts from 'typescript';
import * as micromatch from 'micromatch';
import { isAbsolute } from 'path';

const {
    createSourceFile,
    resolveModuleName,
    isStringLiteral,
    SyntaxKind,
    ScriptTarget,
} = ts;

export const reflectionModes = ['always', 'default', 'never'] as const;

export type ReflectionMode = typeof reflectionModes[number] | '' | boolean | string | string[] | undefined;

export function patternMatch(path: string, patterns: string[], base?: string) {
    const normalized = patterns.map(v => {
        if (v[0] === '!') {
            if (!isAbsolute(v.slice(1))) return `!${base}/${v.substr(1)}`;
            return v;
        }

        if (!isAbsolute(v)) return `${base}/${v}`;
        return v;
    })
    const matched =  micromatch.default([path], normalized, {});
    return matched.length > 0;
}

export function reflectionModeMatcher(
    filePath: string,
    mode: ReflectionMode,
    configPathDir?: string
): typeof reflectionModes[number] {
    if (Array.isArray(mode)) {
        if (!configPathDir) return 'never';
        return patternMatch(filePath, mode, configPathDir) ? 'default' : 'never';
    }
    if ('boolean' === typeof mode) return mode ? 'default' : 'never';
    if (mode === 'default' || mode === 'always') return mode;
    return 'never';
}

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

    resolveExternalLibraryImport(importDeclaration: ImportDeclaration): Required<ResolvedModuleFull> {
        const resolvedModule = this.resolveImport(importDeclaration);
        console.log(resolvedModule);
        if (!resolvedModule.packageId) {
            throw new Error('Missing package id for resolved module');
            /*resolvedModule.packageId = {
                name: (importDeclaration.moduleSpecifier as StringLiteral).text.replace(/[^a-zA-Z0-9]+/g, '_'),
                subModuleName: '',
                version: '',
            };*/
        }
        if (!resolvedModule.isExternalLibraryImport) {
            throw new Error('Resolved module is not an external library import');
        }
        return resolvedModule as Required<ResolvedModuleFull>;
    }

    resolveImport(importDeclaration: ImportDeclaration): ResolvedModuleFull {
        if (!isStringLiteral(importDeclaration.moduleSpecifier)) {
            throw new Error('Invalid import declaration module specifier');
        }
        const resolvedModule = this.resolveImpl(importDeclaration.moduleSpecifier.text, importDeclaration.getSourceFile().fileName);
        if (!resolvedModule) {
            throw new Error('Cannot resolve module');
        }
        return resolvedModule;
    }

    resolveImpl(modulePath: string, fromPath: string): ResolvedModuleFull | undefined {
        if (this.host.resolveModuleNames !== undefined) {
            return this.host.resolveModuleNames([modulePath], fromPath, /*reusedNames*/ undefined, /*redirectedReference*/ undefined, this.compilerOptions)[0] as ResolvedModuleFull | undefined;
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
