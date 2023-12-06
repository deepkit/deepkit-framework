import type {
    EntityName,
    ImportDeclaration, SourceFile,
} from 'typescript';
import ts, { Node, ResolvedModuleFull } from 'typescript';

const {
    isStringLiteral,
} = ts;

import { getEntityName, getNameAsString } from './reflection-ast.js';
import { ReflectionConfig } from './compiler.js';
import { Resolver } from './resolver.js';

export interface ExternalLibraryImport {
    declaration: Node;
    name: EntityName;
    sourceFile: SourceFile;
    module: Required<ResolvedModuleFull>;
}

export class External {
    public sourceFileNames = new Set<string>();

    public runtimeTypeNames = new Set<string>();

    public libraryImports = new Map<string, Set<ExternalLibraryImport>>;

    public embeddedLibraryVariables = new Set<string>();

    public globalTypeNames = new Set<string>();

    public sourceFile?: SourceFile;

    protected embeddingExternalLibraryImport?: ExternalLibraryImport;

    constructor(protected resolver: Resolver) {}

    setEmbeddingExternalLibraryImport(value: ExternalLibraryImport): void {
        if (this.embeddingExternalLibraryImport) {
            throw new Error('Already embedding module');
        }
        this.embeddingExternalLibraryImport = value;
    }

    getEmbeddingExternalLibraryImport(): ExternalLibraryImport {
        if (!this.embeddingExternalLibraryImport) {
            throw new Error('Not embedding external library import');
        }
        return this.embeddingExternalLibraryImport;
    }

    addGlobalType(typeName: string) {
        this.globalTypeNames.add(typeName);
    }

    isEmbeddingExternalLibraryImport(): boolean {
        return !!this.embeddingExternalLibraryImport;
    }

    finishEmbeddingExternalLibraryImport(): void {
        delete this.embeddingExternalLibraryImport;
    }

    public hasExternalLibraryImport(
        entityName: EntityName,
        module: Required<ResolvedModuleFull> = this.getEmbeddingExternalLibraryImport().module,
    ): boolean {
        const imports = this.libraryImports.get(module.packageId.name);
        if (!imports) return false;
        const typeName = getEntityName(entityName);
        return [...imports].some(d => getNameAsString(d.name) === typeName)
    }

    public addExternalLibraryImport(name: EntityName, declaration: Node, sourceFile: SourceFile, module?: Required<ResolvedModuleFull>): ExternalLibraryImport {
        if (!module) {
            module = this.getEmbeddingExternalLibraryImport().module;
        }
        const imports = this.libraryImports.get(module.packageId.name) || new Set();
        const externalLibraryImport: ExternalLibraryImport = {
            name,
            declaration,
            sourceFile,
            module,
        }
        this.libraryImports.set(module.packageId.name, imports.add(externalLibraryImport));
        return externalLibraryImport;
    }

    public addRuntimeTypeName(typeName: EntityName): void {
        this.runtimeTypeNames.add(getNameAsString(typeName));
    }

    public addSourceFile(sourceFile: SourceFile): void {
        this.sourceFileNames.add(sourceFile.fileName);
    }

    public hasSourceFile(sourceFile: SourceFile): boolean {
        return this.sourceFileNames.has(sourceFile.fileName);
    }

    public shouldInlineExternalLibraryImport(importDeclaration: ImportDeclaration, entityName: EntityName, config: ReflectionConfig): boolean {
        if (!isStringLiteral(importDeclaration.moduleSpecifier)) return false;
        if (config.options.inlineExternalLibraryImports === true) return true;
        const resolvedModule = this.resolver.resolveExternalLibraryImport(importDeclaration);
        const imports = config.options.inlineExternalLibraryImports?.[resolvedModule.packageId.name];
        if (!imports) return false;
        if (imports === true) return true;
        if (!importDeclaration.moduleSpecifier.text.startsWith(resolvedModule.packageId.name)) return true;
        const typeName = getEntityName(entityName);
        return imports.includes(typeName);
    }

    public embedExternalLibraryImport(typeName: EntityName, declaration: Node, sourceFile: SourceFile, importDeclaration?: ImportDeclaration): ExternalLibraryImport {
        let externalLibraryImport: ExternalLibraryImport;
        if (importDeclaration) {
            const resolvedModule = this.resolver.resolveExternalLibraryImport(importDeclaration);
            externalLibraryImport = this.addExternalLibraryImport(typeName, declaration, sourceFile, resolvedModule);
        } else {
            externalLibraryImport = this.addExternalLibraryImport(typeName, declaration, sourceFile);
        }

        this.addRuntimeTypeName(typeName);

        if (sourceFile.fileName !== this.sourceFile?.fileName) {
            this.addSourceFile(sourceFile);
        }

        return externalLibraryImport;
    }
}
