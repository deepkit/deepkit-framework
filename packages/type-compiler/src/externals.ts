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

export interface ExternalLibraryImport { declaration: Node; name: EntityName; sourceFile: SourceFile; module: Required<ResolvedModuleFull>; }

export class Externals {
    public sourceFileNames = new Set<string>();

    public runtimeTypeNames = new Set<string>();

    public libraryImports = new Map<string, Set<ExternalLibraryImport>>;

    protected embeddingLibraryImport?: ExternalLibraryImport;

    public embeddedLibraryVariables = new Set<string>();

    public globalTypes = new Set<string>();

    constructor(protected resolver: Resolver) {}

    setEmbeddingLibraryImport(value: ExternalLibraryImport): void {
        if (this.embeddingLibraryImport) {
            throw new Error('Already embedding module');
        }
        this.embeddingLibraryImport = value;
    }

    getEmbeddingLibraryImport(): ExternalLibraryImport {
        if (!this.embeddingLibraryImport) {
            throw new Error('Not embedding external library import');
        }
        return this.embeddingLibraryImport;
    }

    addGlobalType(typeName: string) {
        this.globalTypes.add(typeName);
    }

    isEmbeddingLibraryImport(): boolean {
        return !!this.embeddingLibraryImport;
    }

    finishEmbeddingLibraryImport(): void {
        delete this.embeddingLibraryImport;
    }

    public hasLibraryImport(entityName: EntityName, module?: Required<ResolvedModuleFull>): boolean {
        if (!module) {
            module = this.getEmbeddingLibraryImport().module;
        }
        const imports = this.libraryImports.get(module.packageId.name);
        if (!imports) return false;
        const typeName = getEntityName(entityName);
        return [...imports].some(d => getNameAsString(d.name) === typeName)
    }

    public addLibraryImport(name: EntityName, declaration: Node, sourceFile: SourceFile, module?: Required<ResolvedModuleFull>): ExternalLibraryImport {
        if (!module) {
            module = this.getEmbeddingLibraryImport().module;
        }
        const imports = this.libraryImports.get(module.packageId.name) || new Set();
        const externalLibraryImport: ExternalLibraryImport = {
            name,
            declaration,
            sourceFile,
            module,
        }
        this.libraryImports.set(module.packageId.name, imports.add(externalLibraryImport));
        // this.embeddingModule = module;
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

    public shouldInlineLibraryImport(importDeclaration: ImportDeclaration, entityName: EntityName, config: ReflectionConfig): boolean {
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
}
