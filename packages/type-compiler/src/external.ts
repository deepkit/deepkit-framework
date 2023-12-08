import type {
    EntityName,
    ImportDeclaration, SourceFile,
} from 'typescript';
import ts, { Node, ResolvedModuleFull } from 'typescript';

const {
    isStringLiteral,
} = ts;

import { getEntityName, getNameAsString, hasSourceFile } from './reflection-ast.js';
import { ReflectionConfig } from './compiler.js';
import { Resolver } from './resolver.js';

export interface ExternalLibraryImport {
    declaration: Node;
    name: EntityName;
    sourceFile: SourceFile;
    module: Required<ResolvedModuleFull>;
}

export class External {
    protected sourceFileNames = new Set<string>();

    public compileExternalLibraryImports = new Map<string, Map<string, ExternalLibraryImport>>;

    protected processedEntities = new Set<string>;

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

    public shouldInlineExternalLibraryImport(importDeclaration: ImportDeclaration, entityName: EntityName, config: ReflectionConfig): boolean {
        if (!isStringLiteral(importDeclaration.moduleSpecifier)) return false;
        if (!hasSourceFile(importDeclaration)) return false;
        if (config.options.inlineExternalLibraryImports === true) return true;
        const resolvedModule = this.resolver.resolveImport(importDeclaration);
        if (!resolvedModule.isExternalLibraryImport || !resolvedModule.packageId) return false;
        const imports = config.options.inlineExternalLibraryImports?.[resolvedModule.packageId.name];
        if (!imports) return false;
        if (imports === true) return true;
        if (!importDeclaration.moduleSpecifier.text.startsWith(resolvedModule.packageId.name)) return true;
        const typeName = getEntityName(entityName);
        return imports.includes(typeName);
    }

    public processExternalLibraryImport(typeName: EntityName, declaration: Node, sourceFile: SourceFile, importDeclaration?: ImportDeclaration): ExternalLibraryImport {
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
            }
        }

        this.processedEntities.add(entityName);
        // const libraryFiles = this.processedExternalLibraryImports.get(module.packageId.name) || new Map();
        // const libraryFileEntities = libraryFiles.get(module.resolvedFileName) || new Set();
        // if (libraryFileEntities.has(entityName)) {
        //     return {
        //         name: typeName,
        //         declaration,
        //         sourceFile,
        //         module,
        //     }
        // }
        //
        // libraryFileEntities.add(entityName);
        // libraryFiles.set(module.resolvedFileName, libraryFileEntities);
        // this.processedExternalLibraryImports.set(module.packageId.name, libraryFiles);

        const imports = this.compileExternalLibraryImports.get(module.packageId.name) || new Map<string, ExternalLibraryImport>();
        const externalLibraryImport: ExternalLibraryImport = {
            name: typeName,
            declaration,
            sourceFile,
            module,
        }
        this.compileExternalLibraryImports.set(module.packageId.name, imports.set(entityName, externalLibraryImport));

        if (sourceFile.fileName !== this.sourceFile?.fileName) {
            this.addSourceFile(sourceFile);
        }

        return externalLibraryImport!;
    }
}
