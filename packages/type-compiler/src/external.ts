import { EntityName, ImportDeclaration, Node, ResolvedModuleFull, SourceFile, isStringLiteral } from 'typescript';

import { ReflectionConfig } from './config.js';
import { getEntityName, getNameAsString, hasSourceFile } from './reflection-ast.js';
import { Resolver } from './resolver.js';

export interface ExternalLibraryImport {
    declaration: Node;
    name: EntityName;
    sourceFile: SourceFile;
    module: Required<ResolvedModuleFull>;
}

export class External {
    protected sourceFileNames = new Set<string>();

    public compileExternalLibraryImports = new Map<string, Map<string, ExternalLibraryImport>>();

    protected processedEntities = new Set<string>();

    public embeddedLibraryVariables = new Set<string>();

    public knownGlobalTypeNames = new Set<string>();

    public sourceFile?: SourceFile;

    protected embeddingExternalLibraryImport?: ExternalLibraryImport;

    constructor(protected resolver: Resolver) {}

    startEmbeddingExternalLibraryImport(value: ExternalLibraryImport): void {
        if (this.embeddingExternalLibraryImport) {
            throw new Error('Already embedding external library import');
        }
        this.embeddingExternalLibraryImport = value;
    }

    getEmbeddingExternalLibraryImport(): ExternalLibraryImport {
        if (!this.embeddingExternalLibraryImport) {
            throw new Error('Not embedding external library import');
        }
        return this.embeddingExternalLibraryImport;
    }

    isEmbeddingExternalLibraryImport(): boolean {
        return !!this.embeddingExternalLibraryImport;
    }

    finishEmbeddingExternalLibraryImport(): void {
        delete this.embeddingExternalLibraryImport;
    }

    public addSourceFile(sourceFile: SourceFile): void {
        this.sourceFileNames.add(sourceFile.fileName);
    }

    public hasSourceFile(sourceFile: SourceFile): boolean {
        return this.sourceFileNames.has(sourceFile.fileName);
    }

    public shouldInlineExternalLibraryImport(
        importDeclaration: ImportDeclaration,
        entityName: EntityName,
        config: ReflectionConfig,
    ): boolean {
        if (!isStringLiteral(importDeclaration.moduleSpecifier)) return false;
        if (!hasSourceFile(importDeclaration)) return false;
        let resolvedModule;
        try {
            // throws an error if import is not an external library
            resolvedModule = this.resolver.resolveExternalLibraryImport(importDeclaration);
        } catch {
            return false;
        }
        if (config.inlineExternalLibraryImports === true) return true;
        const imports = config.inlineExternalLibraryImports?.[resolvedModule.packageId.name];
        if (!imports) return false;
        if (imports === true) return true;
        if (!importDeclaration.moduleSpecifier.text.startsWith(resolvedModule.packageId.name)) {
            return true;
        }
        const typeName = getEntityName(entityName);
        return imports.includes(typeName);
    }

    public hasProcessedEntity(typeName: EntityName): boolean {
        return this.processedEntities.has(getNameAsString(typeName));
    }

    public processExternalLibraryImport(
        typeName: EntityName,
        declaration: Node,
        sourceFile: SourceFile,
        importDeclaration?: ImportDeclaration,
    ): ExternalLibraryImport {
        const module = importDeclaration
            ? this.resolver.resolveExternalLibraryImport(importDeclaration)
            : this.getEmbeddingExternalLibraryImport().module;

        const entityName = getNameAsString(typeName);
        if (this.processedEntities.has(entityName)) {
            return {
                name: typeName,
                declaration,
                sourceFile,
                module,
            };
        }

        this.processedEntities.add(entityName);

        const imports =
            this.compileExternalLibraryImports.get(module.packageId.name) || new Map<string, ExternalLibraryImport>();
        const externalLibraryImport: ExternalLibraryImport = {
            name: typeName,
            declaration,
            sourceFile,
            module,
        };
        this.compileExternalLibraryImports.set(module.packageId.name, imports.set(entityName, externalLibraryImport));

        if (sourceFile.fileName !== this.sourceFile?.fileName) {
            this.addSourceFile(sourceFile);
        }

        return externalLibraryImport!;
    }
}
