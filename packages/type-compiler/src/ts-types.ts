//Contains types and makes certain properties available that are currently marked as @internal and thus not part of the public TS API.
//Certain interfaces do not contain all properties/methods from all internal TS types, because we add only those we actually use.
//This helps to identity which types are actually needed and maybe can be brought up to the TS team as candidates to make them public.

import {
    CompilerOptions,
    ExportDeclaration,
    ImportCall,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportTypeNode,
    ModuleDeclaration,
    Path,
    SourceFile as TSSourceFile,
    Symbol,
    SymbolTable
} from 'typescript';

/**
 * Contains @internal properties that are not yet in the public API of TS.
 */
export interface SourceFile extends TSSourceFile {
    /**
     * If two source files are for the same version of the same package, one will redirect to the other.
     * (See `createRedirectSourceFile` in program.ts.)
     * The redirect will have this set. The redirected-to source file will be in `redirectTargetsMap`.
     */
    redirectInfo?: any;

    externalModuleIndicator?: Node;
    // The first node that causes this file to be a CommonJS module
    commonJsModuleIndicator?: Node;
    // JS identifier-declarations that are intended to merge with globals
    jsGlobalAugmentations?: SymbolTable;

    //part of Node
    symbol?: Symbol;                       // Symbol declared by node (initialized by binding)
}

//redefine because we patched SourceFile
export interface ScriptReferenceHost {
    getCompilerOptions(): CompilerOptions;

    getSourceFile(fileName: string): SourceFile | undefined;

    getSourceFileByPath(path: Path): SourceFile | undefined;

    getCurrentDirectory(): string;
}

//empty because we don't use any of these methods
export interface ModuleSpecifierResolutionHost {
}

//empty because we don't use any of these methods
export interface SourceFileMayBeEmittedHost {

}

//not all methods included since we only use a subset.
export interface EmitHost extends ScriptReferenceHost, ModuleSpecifierResolutionHost, SourceFileMayBeEmittedHost {
    getSourceFiles(): readonly SourceFile[];

    useCaseSensitiveFileNames(): boolean;

    getCurrentDirectory(): string;
}

/**
 * An internal helper that has not yet exposed to transformers.
 */
export interface EmitResolver {
    // getReferencedValueDeclaration(reference: Identifier): Declaration | undefined;

    // getReferencedImportDeclaration(nodeIn: Identifier): Declaration | undefined;

    getExternalModuleFileFromDeclaration(declaration: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ModuleDeclaration | ImportTypeNode | ImportCall): SourceFile | undefined;
}
